import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeliveryPlan } from '../group-routing.mjs';

const reports = [{ regionId: 'hn', regionName: 'Hà Nội' }, { regionId: 'ct', regionName: 'Cần Thơ' }];
const groups = [{ id: '111', name: 'Nhóm HN' }, { id: '222', name: 'Nhóm CT' }];

test('routes regions by stable group ID regardless of list order', () => {
  const plan = buildDeliveryPlan(reports, [...groups].reverse(), { hn: { groupId: '111' }, ct: { groupId: '222' } });
  assert.equal(plan[0].group.name, 'Nhóm HN');
  assert.equal(plan[1].group.name, 'Nhóm CT');
});

test('both regions may use the same test group and remain separate messages', () => {
  const plan = buildDeliveryPlan(reports, groups, { hn: { groupId: '111' }, ct: { groupId: '111' } });
  assert.equal(plan.length, 2);
  assert.equal(plan[0].group.id, plan[1].group.id);
  assert.notEqual(plan[0].report.regionId, plan[1].report.regionId);
});

test('missing mapping for second region rejects whole plan', () => {
  assert.throws(() => buildDeliveryPlan(reports, groups, { hn: { groupId: '111' } }), /Chưa cấu hình.*Cần Thơ/);
});

test('invalid, numeric, placeholder and unavailable group IDs are rejected', () => {
  for (const groupId of ['', 111, 'GROUP_ID', '111 ', '999']) {
    assert.throws(() => buildDeliveryPlan(reports, groups, { hn: { groupId }, ct: { groupId: '222' } }));
  }
});

test('no reports or duplicate region cannot result in a delivery plan', () => {
  assert.throws(() => buildDeliveryPlan([], groups, {}));
  assert.throws(() => buildDeliveryPlan([reports[0], reports[0]], groups, { hn: { groupId: '111' } }));
});
