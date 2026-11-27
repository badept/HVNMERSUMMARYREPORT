import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { buildRegionReports } from '../sup-report.mjs';

async function snapshot() {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../../mock-data.js', import.meta.url), 'utf8'), context);
  const mock = context.window.HvnMockData;
  return { ...mock, user: { employeeId: 'SUP-001' }, data: {
    reports: mock.sampleReports.map(report => ({ ...report, date: '2026-11-27' })), checkIns: []
  } };
}

test('one message per region with exactly the SUP template and regional counts', async () => {
  const reports = buildRegionReports(await snapshot(), '2026-11-27');
  assert.equal(reports.length, 2);
  const hn = reports.find(item => item.regionId === 'hn');
  const ct = reports.find(item => item.regionId === 'ct');
  assert.equal(hn.activeMer, 10);
  assert.equal(hn.completed, 30);
  assert.equal(hn.target, 53);
  assert.equal(ct.activeMer, 11);
  assert.equal(ct.completed, 26);
  assert.equal(ct.target, 62);
  assert.equal(hn.text, 'Báo cáo cuối ngày\n\nNgày: 27/11/2026\n\nTeam Sup: Nguyễn Xuân Toàn\n\nKhu vực: Hà Nội\n\nNhân viên ra thị trường: 10\n\nSố Store đã trưng bày / Số Target: 30/53\n\nSố báo cáo đã nhận / Total PLAN: 30/53');
  assert.doesNotMatch(ct.text, /Hà Nội/);
});

test('empty date does not reuse reports from another day', async () => {
  const reports = buildRegionReports(await snapshot(), '2026-11-28');
  for (const report of reports) {
    assert.equal(report.completed, 0);
    assert.equal(report.activeMer, 0);
    assert.equal(report.received, 0);
    assert.ok(report.target > 0);
  }
});

test('only assigned regions; check-in without report counts as active', async () => {
  const data = await snapshot();
  data.supervisors[0].regionIds = ['hn'];
  data.data.checkIns = [{ storeId: 'HN-104', employeeId: 'CHECKIN-ONLY', date: '2026-11-27' }];
  const reports = buildRegionReports(data, '2026-11-27');
  assert.equal(reports.length, 1);
  assert.equal(reports[0].activeMer, 11);
  assert.equal(reports[0].completed, 30);
  assert.throws(() => buildRegionReports(data, '2026-02-30'), /ngày báo cáo/);
});
