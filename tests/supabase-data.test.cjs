const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'supabase-data.js'), 'utf8');

function setup(fetch, overrides = {}) {
  const context = { window: { HvnConfig: {
    mode: 'supabase', supabaseUrl: 'https://fixture.supabase.co',
    publishableKey: 'sb_publishable_test', ...overrides
  } }, URL, AbortSignal, fetch, atob };
  vm.runInNewContext(source, context);
  return context.window.HvnSupabase;
}
const response = (payload, status = 200) => ({ ok: status < 400, status, json: async () => payload });
const fixture = () => ({
  user: { username: 'SUP-001', role: 'sup', employeeId: 'SUP-001' },
  regions: [], employees: [], supervisors: [], stores: [],
  data: { reports: [{ id: 'R1', photoIds: ['not-in-storage'], sample: true }], checkIns: [], deliveries: [] }
});

test('login uses Auth token for RPC and does not invent fixture photos', async () => {
  const calls = [];
  const api = setup(async (url, options) => {
    calls.push({ url, options });
    return response(calls.length === 1 ? { access_token: 'USER-TOKEN' } : fixture());
  });
  const data = await api.login(' sup@example.com ', 'password');
  assert.equal(calls[0].url, 'https://fixture.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(JSON.parse(calls[0].options.body).email, 'sup@example.com');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer USER-TOKEN');
  assert.equal(calls[1].url, 'https://fixture.supabase.co/rest/v1/rpc/hvn_sup_snapshot');
  assert.equal(data.data.reports[0].photoIds.length, 0);
  assert.equal(data.data.reports[0].sample, false);
});

test('RPC permission failure rejects login and clears token', async () => {
  let count = 0;
  const calls = [];
  const api = setup(async (url, options) => {
    calls.push(options);
    count++;
    return count === 1 ? response({ access_token: 'USER-TOKEN' }) : response({}, 403);
  });
  await assert.rejects(api.login('x@y.com', 'password'), /chưa được cấp quyền/);
  await assert.rejects(api.load(), /chưa được cấp quyền/);
  assert.equal(calls[2].headers.Authorization, undefined);
});

test('network errors do not silently fall back to demo', async () => {
  const api = setup(async () => { throw new Error('offline'); });
  await assert.rejects(api.login('x@y.com', 'password'), /offline/);
});

test('rejects secret key and invalid configuration before network access', async () => {
  let calls = 0;
  const api = setup(async () => { calls++; }, { publishableKey: 'sb_secret_FORBIDDEN' });
  await assert.rejects(api.login('x@y.com', 'p'), /khóa bí mật/);
  assert.equal(calls, 0);
  assert.throws(() => setup(() => {}, { supabaseUrl: 'http://example.com' }).validateConfig(), /HTTPS/);
});

test('malformed snapshot is rejected', async () => {
  let count = 0;
  const api = setup(async () => response(++count === 1 ? { access_token: 'TOKEN' } : {}));
  await assert.rejects(api.login('x@y.com', 'p'), /không đúng cấu trúc/);
});

test('logout clears memory token even when remote logout fails', async () => {
  const calls = [];
  const api = setup(async (url, options) => {
    calls.push(options);
    if (url.includes('/logout')) throw new Error('offline');
    return response(url.includes('/token?') ? { access_token: 'TOKEN' } : fixture());
  });
  await api.login('x@y.com', 'p');
  await api.logout();
  await api.load();
  assert.equal(calls[3].headers.Authorization, undefined);
});
