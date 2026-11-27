import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Reuse the frontend's authenticated RPC adapter, including config validation.
export async function readSupSnapshot(email, password) {
  if (!email || !password) throw new Error('Chưa điền SUPABASE_EMAIL và SUPABASE_PASSWORD trong backend/.env.');
  const context = { window: {}, URL, AbortSignal, atob, fetch };
  vm.createContext(context);
  for (const file of ['../supabase-config.js', '../supabase-data.js']) {
    vm.runInContext(await readFile(new URL(file, import.meta.url), 'utf8'), context);
  }
  const adapter = context.window.HvnSupabase;
  if (!adapter.enabled) throw new Error('Chưa bật mode supabase trong supabase-config.js.');
  try { return await adapter.login(email, password); }
  finally { await adapter.logout(); }
}

export function buildRegionReports(snapshot, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error('Không đúng ngày báo cáo YYYY-MM-DD.');
  }
  const supervisor = snapshot.supervisors.find(person => person.id === snapshot.user.employeeId);
  if (!supervisor) throw new Error('Không tìm thấy SUP trong dữ liệu.');
  const formattedDate = date.split('-').reverse().join('/');
  return snapshot.regions.filter(region => supervisor.regionIds.includes(region.id)).map(region => {
    const stores = snapshot.stores.filter(store => store.regionId === region.id);
    const storeIds = new Set(stores.map(store => store.id));
    const reports = snapshot.data.reports.filter(report => report.date === date && storeIds.has(report.storeId));
    const reported = new Set(reports.map(report => report.storeId));
    const active = new Set([
      ...reports.map(report => report.employeeId),
      ...snapshot.data.checkIns.filter(item => item.date === date && storeIds.has(item.storeId)).map(item => item.employeeId)
    ]);
    const target = stores.reduce((sum, store) => sum + store.target, 0);
    const completed = stores.reduce((sum, store) => sum + (reported.has(store.id) ? store.target : 0), 0);
    const received = reports.filter(report => report.status === 'submitted').length;
    return {
      regionId: region.id, regionName: region.name, date,
      activeMer: active.size, completed, target, received, plannedStores: stores.length,
      text: `Báo cáo cuối ngày\n\nNgày: ${formattedDate}\n\nTeam Sup: ${supervisor.name}\n\nKhu vực: ${region.name}\n\nNhân viên ra thị trường: ${active.size}\n\nSố Store đã trưng bày / Số Target: ${completed}/${target}\n\nSố báo cáo đã nhận / Total PLAN: ${received}/${stores.length}`
    };
  });
}
