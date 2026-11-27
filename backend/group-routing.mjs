import { readFile } from 'node:fs/promises';

export async function readGroupConfig() {
  let config;
  try { config = JSON.parse(await readFile(new URL('./zalo-groups.json', import.meta.url), 'utf8')); }
  catch { throw new Error('Không đọc được backend/zalo-groups.json. Kiểm tra file JSON.'); }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Không đúng cấu trúc backend/zalo-groups.json.');
  }
  return config;
}

// Validate the ENTIRE plan before any gateway send. Never choose a fallback.
export function buildDeliveryPlan(reports, groups, config) {
  if (!reports.length) throw new Error('Không có khu vực được cấp quyền.');
  const available = new Map(groups.map(group => [group.id, group]));
  const seen = new Set();
  return reports.map(report => {
    if (seen.has(report.regionId)) throw new Error('Không thể tạo hai báo cáo cho cùng một khu vực.');
    seen.add(report.regionId);
    const entry = Object.hasOwn(config, report.regionId) ? config[report.regionId] : null;
    const id = entry?.groupId;
    if (typeof id !== 'string' || !/^\d+$/.test(id)) {
      throw new Error(`Chưa cấu hình groupId hợp lệ cho ${report.regionName} (${report.regionId}) trong backend/zalo-groups.json. Chưa gửi tin nào.`);
    }
    const group = available.get(id);
    if (!group) throw new Error(`Không truy cập được nhóm đã cấu hình cho ${report.regionName}. Chưa gửi tin nào.`);
    return { report, group };
  });
}
