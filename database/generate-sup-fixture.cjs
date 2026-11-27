// Generate an isolated Supabase fixture from the existing frontend demo.
// Usage: node database/generate-sup-fixture.cjs [YYYY-MM-DD]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const date = process.argv[2] || new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
  throw new Error('Expected a valid YYYY-MM-DD');
}
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'mock-data.js'), 'utf8'), context);
const mock = context.window.HvnMockData;
const shifted = offset => {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};
const reports = mock.sampleReports.map(({ sampleTime, ...report }) => ({
  ...report, date, submittedAt: `${date}T${sampleTime}:00+07:00`
}));
reports.push(...mock.historicalReports.map(sample => ({
  id: sample.id, storeId: sample.storeId, employeeId: sample.employeeId,
  regionId: sample.regionId, date: shifted(sample.dayOffset),
  submittedAt: `${shifted(sample.dayOffset)}T${sample.time}:00+07:00`,
  status: 'submitted', display: sample.display, stock: sample.stock,
  notes: sample.notes, photoIds: [`${sample.id}-front`, `${sample.id}-shelf`],
  photoKinds: [{ id: `${sample.id}-front`, kind: 'front' }, { id: `${sample.id}-shelf`, kind: 'shelf' }],
  sample: true
})));
const checkIns = reports.map(report => ({
  key: `${report.storeId}|${report.date}`, storeId: report.storeId,
  employeeId: report.employeeId, date: report.date,
  timestamp: report.submittedAt, mockLocation: true
}));
// Validate fixture relationships before generating SQL.
const stores = new Map(mock.stores.map(store => [store.id, store]));
const employees = new Set(mock.employees.map(employee => employee.id));
const keys = new Set();
for (const report of reports) {
  const store = stores.get(report.storeId);
  const key = `${report.storeId}|${report.date}`;
  if (!store || !employees.has(report.employeeId) || store.employeeId !== report.employeeId || store.regionId !== report.regionId || keys.has(key)) {
    throw new Error(`Invalid fixture relationship or duplicate store/day: ${report.id}`);
  }
  keys.add(key);
}
const definitions = {
  regions: 'id text primary key, name text not null, "shortName" text not null',
  employees: 'id text primary key, name text not null, role text not null, "regionIds" jsonb not null, username text not null',
  supervisors: 'id text primary key, name text not null, title text not null, "regionIds" jsonb not null',
  stores: 'id text primary key, code text not null, name text not null, "regionId" text not null references ffa_sup_test.regions(id), "employeeId" text not null references ffa_sup_test.employees(id), target integer not null check (target > 0), address text not null',
  reports: 'id text primary key, "storeId" text not null references ffa_sup_test.stores(id), "employeeId" text not null references ffa_sup_test.employees(id), "regionId" text not null references ffa_sup_test.regions(id), date date not null, "submittedAt" timestamptz not null, status text not null check (status = \'submitted\'), display jsonb not null, stock jsonb not null, notes text not null, "photoIds" jsonb not null, "photoKinds" jsonb, sample boolean not null, unique ("storeId", date)',
  check_ins: 'key text primary key, "storeId" text not null references ffa_sup_test.stores(id), "employeeId" text not null references ffa_sup_test.employees(id), date date not null, timestamp timestamptz not null, "mockLocation" boolean not null, unique ("storeId", date)'
};
const data = { regions: mock.regions, employees: mock.employees, supervisors: mock.supervisors, stores: mock.stores, reports, check_ins: checkIns };
let sql = `-- Generated fixture. Test project only. Business date: ${date}\n-- Uses a dedicated schema; does not change public tables or create login accounts.\n-- Re-run on the same schema/date skips existing IDs; does not reset edited rows.\nbegin;\ncreate schema if not exists ffa_sup_test;\nrevoke all on schema ffa_sup_test from public, anon, authenticated;\n`;
for (const [table, columns] of Object.entries(definitions)) {
  const json = JSON.stringify(data[table]);
  if (json.includes('$fixture$')) throw new Error('SQL delimiter collision');
  sql += `\ncreate table if not exists ffa_sup_test.${table} (${columns});\nalter table ffa_sup_test.${table} enable row level security;\ninsert into ffa_sup_test.${table}\nselect * from jsonb_populate_recordset(null::ffa_sup_test.${table}, $fixture$${json}$fixture$::jsonb)\non conflict do nothing;\n`;
}
sql += `
-- Mirrors the frontend's static store assignments as PLAN, not a real daily plan.
-- One submitted report per store/day in this fixture.
create or replace view ffa_sup_test.vw_sup_daily_progress
with (security_invoker = true) as
with days as (
  select distinct date from ffa_sup_test.reports
  union select '${date}'::date
), totals as (
  select d.date, s."regionId" as region_id,
    count(*)::integer as planned_stores,
    sum(s.target)::integer as target,
    sum(case when r.id is not null then s.target else 0 end)::integer as completed,
    count(r.id)::integer as reports_received,
    count(distinct coalesce(r."employeeId", c."employeeId"))::integer as active_mer
  from days d cross join ffa_sup_test.stores s
  left join ffa_sup_test.reports r on r."storeId" = s.id and r.date = d.date
  left join ffa_sup_test.check_ins c on c."storeId" = s.id and c.date = d.date
  group by d.date, s."regionId"
)
select t.*, rg.name as region_name,
  (select count(*)::integer from ffa_sup_test.employees e
   where e."regionIds" ? t.region_id) as managed_mer,
  t.target - t.completed as pending,
  round(100.0 * t.completed / nullif(t.target, 0))::integer as percent
from totals t join ffa_sup_test.regions rg on rg.id = t.region_id;

-- SQL-only snapshot matching the arrays read by the current frontend.
-- This does not connect app.js to Supabase.
create or replace view ffa_sup_test.vw_frontend_snapshot
with (security_invoker = true) as
select
  (select jsonb_agg(to_jsonb(x) order by x.id) from ffa_sup_test.regions x) as regions,
  (select jsonb_agg(to_jsonb(x) order by x.id) from ffa_sup_test.employees x) as employees,
  (select jsonb_agg(to_jsonb(x) order by x.id) from ffa_sup_test.supervisors x) as supervisors,
  (select jsonb_agg(to_jsonb(x) order by x.id) from ffa_sup_test.stores x) as stores,
  jsonb_build_object(
    'version', 1,
    'reports', (select jsonb_agg(to_jsonb(x) order by x.id) from ffa_sup_test.reports x),
    'checkIns', (select jsonb_agg(to_jsonb(x) order by x.key) from ffa_sup_test.check_ins x),
    'deliveries', '[]'::jsonb,
    'teamFixtureAdded', true
  ) as data;
commit;

-- Expected on a fresh fixture: 2 regions, 26 employees, 1 SUP,
-- 115 stores, 63 reports, 63 check-ins.
select 'regions' as entity, count(*) from ffa_sup_test.regions
union all select 'employees', count(*) from ffa_sup_test.employees
union all select 'supervisors', count(*) from ffa_sup_test.supervisors
union all select 'stores', count(*) from ffa_sup_test.stores
union all select 'reports', count(*) from ffa_sup_test.reports
union all select 'check_ins', count(*) from ffa_sup_test.check_ins;

-- Expected: hn 30/53 (57%); ct 26/62 (42%).
select * from ffa_sup_test.vw_sup_daily_progress
where date = '${date}' order by region_id;
`;
const output = path.join(__dirname, 'sup-test-fixture.sql');
fs.writeFileSync(output, sql, 'utf8');
console.log(JSON.stringify({ output, date, counts: Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])) }, null, 2));
