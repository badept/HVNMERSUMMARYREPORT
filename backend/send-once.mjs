import { writeFile } from 'node:fs/promises';

// Reserve before calling the gateway. A failure after dispatch may mean the
// message was accepted; it must not trigger an automatic retry.
export async function sendOnce({ api, groupId, groupType, text, attemptId, logPath }) {
  const record = { attemptId, groupId, startedAt: new Date().toISOString(), status: 'Unknown' };
  await writeFile(logPath, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
  let result;
  try {
    result = await api.sendMessage({ msg: text }, groupId, groupType);
  } catch {
    throw new Error(`Kết quả chưa rõ (Unknown). Kiểm tra nhóm và mã ${attemptId} trước khi thử lại. Không tự retry.`);
  }
  if (result?.message?.msgId === undefined || result.message.msgId === null) {
    throw new Error(`Gateway chưa xác nhận ID tin nhắn. Giữ Unknown, kiểm tra mã ${attemptId} trong nhóm.`);
  }
  record.status = 'Sent';
  record.messageId = String(result.message.msgId);
  record.finishedAt = new Date().toISOString();
  try {
    await writeFile(logPath, JSON.stringify(record), { mode: 0o600 });
  } catch {
    throw new Error(`Gateway đã xác nhận nhưng lưu log thất bại. Không gửi lại mã ${attemptId}.`);
  }
  return record;
}
