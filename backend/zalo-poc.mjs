import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { sendOnce } from './send-once.mjs';
import { readSupSnapshot, buildRegionReports } from './sup-report.mjs';
import { readGroupConfig, buildDeliveryPlan } from './group-routing.mjs';

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), '.private');
const sessionFile = path.join(directory, 'session.json');
const qrPath = path.join(directory, 'login-qr.png');
const command = process.argv[2];

async function main() {
  if (!['login', 'test', 'report', 'groups'].includes(command)) throw new Error('Dùng npm run zalo:login, zalo:test, zalo:groups, zalo:preview hoặc zalo:report trong thư mục backend.');
  if (['login', 'test'].includes(command) && !stdin.isTTY) throw new Error('Chạy trong Terminal tương tác của VS Code.');
  let date;
  let preview = false;
  let mapping;
  if (command === 'report') {
    const args = process.argv.slice(3);
    const rest = [];
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--preview') preview = true;
      else if (args[index] === '--date' && args[index + 1]) date = args[++index];
      else rest.push(args[index]);
    }
    if (rest.length) throw new Error('Không đúng tham số. Dùng --date YYYY-MM-DD và/hoặc --preview.');
    date ||= new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Không đúng ngày báo cáo YYYY-MM-DD.');
    mapping = await readGroupConfig();
  }
  const { Zalo, ThreadType, LoginQRCallbackEventType } = await import('zca-js');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const zalo = new Zalo({ logging: false, checkUpdate: false });
  let api;
  if (command === 'login') {
    let credentials;
    const qrTasks = [];
    api = await zalo.loginQR({ qrPath }, event => {
      if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
        qrTasks.push(event.actions.saveToFile(qrPath).then(() => {
          console.log('Mở file QR trên máy, dùng Zalo điện thoại quét và xác nhận:');
          console.log(qrPath);
        }));
      } else if (event.type === LoginQRCallbackEventType.GotLoginInfo) {
        credentials = event.data;
      } else if (event.type === LoginQRCallbackEventType.QRCodeExpired || event.type === LoginQRCallbackEventType.QRCodeDeclined) {
        event.actions.abort();
        console.log('QR hết hạn hoặc bị từ chối. Chạy lại lệnh login nếu muốn tiếp tục.');
      }
    });
    await Promise.all(qrTasks);
    if (!credentials) throw new Error('Không nhận được thông tin phiên.');
    await writeFile(sessionFile, JSON.stringify(credentials), { mode: 0o600 });
    await unlink(qrPath).catch(() => {});
    console.log('Đăng nhập thành công. Đã lưu phiên riêng trên máy; chưa gửi tin.');
    return;
  }

  let credentials;
  try { credentials = JSON.parse(await readFile(sessionFile, 'utf8')); }
  catch { throw new Error('Chưa có phiên. Chạy npm run zalo:login trước.'); }
  try { api = await zalo.login(credentials); }
  catch { throw new Error('Không khôi phục được phiên hoặc lỗi kết nối. Kiểm tra mạng; nếu phiên hết hạn, chạy npm run zalo:login.'); }

  const { gridVerMap } = await api.getAllGroups();
  const ids = Object.keys(gridVerMap || {});
  if (!ids.length) throw new Error('Tài khoản chưa có nhóm. Tạo nhóm test rồi chạy lại.');
  const groups = [];
  // Small sequential batches avoid one oversized request for all memberships.
  for (let index = 0; index < ids.length; index += 20) {
    const info = await api.getGroupInfo(ids.slice(index, index + 20));
    for (const [id, group] of Object.entries(info.gridInfoMap || {})) groups.push({ id, name: group.name || '(không tên)' });
  }
  if (!groups.length) throw new Error('Không đọc được thông tin nhóm.');
  if (command === 'groups') {
    console.log('Copy ID nhóm vào backend/zalo-groups.json, không dùng số thứ tự:');
    groups.forEach(group => console.log(`${group.name} [${group.id}]`));
    return;
  }
  if (command === 'report') {
    const snapshot = await readSupSnapshot(process.env.SUPABASE_EMAIL, process.env.SUPABASE_PASSWORD);
    const reports = buildRegionReports(snapshot, date);
    const plan = buildDeliveryPlan(reports, groups, mapping);
    for (const { report, group } of plan) {
      console.log(`\nNHÓM ĐÍCH: ${group.name} [${group.id}]\n${report.text}\n`);
    }
    if (preview) { console.log('Xem trước hoàn tất. Không gửi tin nào.'); return; }
    for (const { report, group } of plan) {
      const attemptId = `HVN-${report.regionId}-${date}-${randomUUID()}`;
      console.log(`Đang gửi ${report.regionName}, mã theo dõi local ${attemptId}...`);
      await sendOnce({ api, groupId: group.id, groupType: ThreadType.Group, text: report.text, attemptId, logPath: path.join(directory, `${attemptId}.json`) });
      console.log(`Sent: ${report.regionName}. Kiểm tra tin thực tế trên điện thoại.`);
    }
    return;
  }
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    console.log('Các nhóm của tài khoản (không gửi danh sách này vào chat):');
    groups.forEach((group, index) => console.log(`${index + 1}. ${group.name} [${group.id}]`));
    const answer = (await terminal.question('Nhập số thứ tự NHÓM TEST, hoặc Enter để hủy: ')).trim();
    if (!answer) return;
    if (!/^\d+$/.test(answer)) throw new Error('Số thứ tự không hợp lệ.');
    const group = groups[Number(answer) - 1];
    if (!group) throw new Error('Số thứ tự không hợp lệ.');
    const attemptId = `HVN-POC-${randomUUID()}`;
    const text = `KIỂM THỬ KẾT NỐI HVN\nĐây là tin thử nghiệm, chưa phải báo cáo vận hành.\nTiếng Việt: Hà Nội – Cần Thơ.\nMã test: ${attemptId}\nThời gian: ${new Date().toISOString()}`;
    console.log(`\nNHÓM ĐÍCH: ${group.name} [${group.id}]\n\n${text}\n`);
    const confirm = await terminal.question('Chỉ gửi 1 tin tới nhóm trên. Gõ GUI để xác nhận, Enter để hủy: ');
    if (confirm.trim() !== 'GUI') { console.log('Đã hủy, không gửi.'); return; }
    const record = await sendOnce({ api, groupId: group.id, groupType: ThreadType.Group, text, attemptId, logPath: path.join(directory, `${attemptId}.json`) });
    console.log(`Sent: Gateway xác nhận, mã test ${record.attemptId}. Kiểm tra tin trên điện thoại; Sent không có nghĩa đã đọc.`);
  } finally {
    terminal.close();
  }
}

main().catch(error => {
  // Never dump raw SDK errors: they may contain authentication/request details.
  const message = error.message || '';
  const ownMessage = /^(Dùng |Chạy |Không |Chưa |Tài khoản |Số thứ tự |Kết quả |Gateway )/.test(message);
  console.error(ownMessage ? message : 'POC lỗi khi kết nối thư viện/Zalo. Kiểm tra npm install, mạng và phiên. Không gửi cookie/session vào chat.');
  process.exitCode = 1;
});
