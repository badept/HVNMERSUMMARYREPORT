const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('cloud boot/login/refresh/logout bypass local storage and render SUP data', async () => {
  const handlers = {};
  const form = { elements: { username: { value: 'sup@example.com' }, password: { value: 'test' } } };
  const root = {
    innerHTML: '', addEventListener: (name, callback) => { handlers[name] = callback; },
    querySelector: () => form, querySelectorAll: () => [], contains: () => true
  };
  let refreshes = 0;
  const context = {
    window: { setTimeout: () => 0, clearTimeout: () => {} },
    document: { getElementById: () => root, addEventListener: () => {} },
    localStorage: { getItem: () => { throw new Error('Cloud must not read demo data'); } },
    URL, console
  };
  vm.createContext(context);
  vm.runInContext(read('mock-data.js'), context);
  const mock = context.window.HvnMockData;
  const snapshot = () => ({
    regions: mock.regions, employees: mock.employees, supervisors: mock.supervisors,
    stores: mock.stores, user: { username: 'SUP-001', role: 'sup', employeeId: 'SUP-001' },
    data: { reports: [], checkIns: [], deliveries: [] }
  });
  context.window.HvnSupabase = {
    enabled: true, validateConfig: () => {}, login: async () => snapshot(),
    load: async () => { refreshes++; return snapshot(); }, logout: async () => {}
  };
  await vm.runInContext(read('app.js'), context);
  assert.match(root.innerHTML, /Đăng nhập SUP/);
  assert.doesNotMatch(root.innerHTML, /123456/);
  const click = async action => {
    const button = { dataset: { hvAct: action } };
    handlers.click({ target: { closest: selector => selector === 'button' ? button : null }, stopPropagation() {} });
    await new Promise(resolve => setImmediate(resolve));
  };
  await click('login');
  assert.match(root.innerHTML, /Nguyễn Xuân Toàn/);
  assert.match(root.innerHTML, /Nguồn: Supabase/);
  assert.match(root.innerHTML, /115/);
  await click('refresh-supabase');
  assert.equal(refreshes, 1);
  await click('logout');
  assert.match(root.innerHTML, /Đăng nhập SUP/);
  assert.equal(mock.stores.length, 0);
});
