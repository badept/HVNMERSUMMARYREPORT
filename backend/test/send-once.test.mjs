import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sendOnce } from '../send-once.mjs';

async function fixture(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'hvn-zalo-test-'));
  try { await run(path.join(dir, 'attempt.json')); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('confirmed send records ID; same attempt cannot dispatch twice', () => fixture(async logPath => {
  let calls = 0;
  const options = { api: { sendMessage: async () => { calls++; return { message: { msgId: '123' } }; } }, groupId: 'test', groupType: 1, text: 'test', attemptId: 'a', logPath };
  const record = await sendOnce(options);
  assert.equal(record.status, 'Sent');
  await assert.rejects(sendOnce(options), { code: 'EEXIST' });
  assert.equal(calls, 1);
}));

test('ambiguous gateway failure stays Unknown and never retries', () => fixture(async logPath => {
  let calls = 0;
  await assert.rejects(sendOnce({ api: { sendMessage: async () => { calls++; throw new Error('timeout'); } }, groupId: 'test', groupType: 1, text: 'test', attemptId: 'b', logPath }), /Unknown/);
  assert.equal(JSON.parse(await readFile(logPath, 'utf8')).status, 'Unknown');
  assert.equal(calls, 1);
}));

test('missing message ID is not reported as Sent', () => fixture(async logPath => {
  await assert.rejects(sendOnce({ api: { sendMessage: async () => ({ message: null }) }, groupId: 'test', groupType: 1, text: 'test', attemptId: 'c', logPath }), /Unknown/);
  assert.equal(JSON.parse(await readFile(logPath, 'utf8')).status, 'Unknown');
}));
