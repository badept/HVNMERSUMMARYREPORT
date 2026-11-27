-- Run AFTER sup-test-fixture.sql in the TEST project SQL Editor.
begin;
create table if not exists ffa_sup_test.user_supervisors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  supervisor_id text not null references ffa_sup_test.supervisors(id)
);
alter table ffa_sup_test.user_supervisors enable row level security;
revoke all on all tables in schema ffa_sup_test from public, anon, authenticated;
revoke all on schema ffa_sup_test from public, anon, authenticated;

-- Only this RPC is exposed. The caller cannot choose another SUP ID.
-- SECURITY DEFINER intentionally reads private fixture tables; permission is
-- checked using auth.uid() and a mapping only the database admin can change.
create or replace function public.hvn_sup_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sup ffa_sup_test.supervisors%rowtype;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select s.* into sup
  from ffa_sup_test.supervisors s
  join ffa_sup_test.user_supervisors u on u.supervisor_id = s.id
  where u.user_id = auth.uid();
  if not found then
    raise exception 'Supervisor access required' using errcode = '42501';
  end if;

  with allowed_stores as (
    select * from ffa_sup_test.stores s where sup."regionIds" ? s."regionId"
  )
  select jsonb_build_object(
    'user', jsonb_build_object('username', sup.id, 'role', 'sup', 'employeeId', sup.id),
    'regions', coalesce((select jsonb_agg(to_jsonb(r) order by r.id)
      from ffa_sup_test.regions r where sup."regionIds" ? r.id), '[]'::jsonb),
    'supervisors', jsonb_build_array(to_jsonb(sup)),
    'employees', coalesce((select jsonb_agg(to_jsonb(e) order by e.id)
      from ffa_sup_test.employees e where e."regionIds" ?| array(select jsonb_array_elements_text(sup."regionIds"))), '[]'::jsonb),
    'stores', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from allowed_stores s), '[]'::jsonb),
    'data', jsonb_build_object(
      'version', 1, 'teamFixtureAdded', true, 'deliveries', '[]'::jsonb,
      'reports', coalesce((select jsonb_agg(to_jsonb(r) order by r.id)
        from ffa_sup_test.reports r join allowed_stores s on s.id = r."storeId"), '[]'::jsonb),
      'checkIns', coalesce((select jsonb_agg(to_jsonb(c) order by c.key)
        from ffa_sup_test.check_ins c join allowed_stores s on s.id = c."storeId"), '[]'::jsonb)
    )
  ) into result;
  return result;
end;
$$;
revoke all on function public.hvn_sup_snapshot() from public, anon, authenticated;
grant usage on schema public to authenticated;
grant execute on function public.hvn_sup_snapshot() to authenticated;
notify pgrst, 'reload schema';
commit;

-- After creating an Auth user, run separately with YOUR actual user UUID:
-- insert into ffa_sup_test.user_supervisors (user_id, supervisor_id)
-- values ('YOUR-AUTH-USER-UUID'::uuid, 'SUP-001')
-- on conflict (user_id) do update set supervisor_id = excluded.supervisor_id;
