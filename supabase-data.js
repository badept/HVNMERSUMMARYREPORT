((global) => {
  'use strict';
  let accessToken = '';
  const config = global.HvnConfig || {};
  const enabled = config.mode === 'supabase';

  function validateConfig() {
    if (!enabled) return;
    let url;
    try { url = new URL(config.supabaseUrl); } catch { throw new Error('Chưa cấu hình Supabase URL trong supabase-config.js.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('Supabase URL phải là địa chỉ HTTPS của project, không kèm đường dẫn.');
    }
    const key = config.publishableKey || '';
    let legacyRole = '';
    try { legacyRole = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch { /* Not a legacy JWT. */ }
    if (!key.startsWith('sb_publishable_') && legacyRole !== 'anon') {
      throw new Error('Chỉ dùng Publishable key hoặc anon key; không dùng khóa bí mật.');
    }
  }

  async function request(endpoint, body, token = accessToken) {
    validateConfig();
    const response = await fetch(config.supabaseUrl.replace(/\/$/, '') + endpoint, {
      method: 'POST',
      headers: {
        apikey: config.publishableKey,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new Error('Đăng nhập không hợp lệ hoặc phiên đã hết hạn. Hãy đăng nhập lại.');
      if (response.status === 403) throw new Error('Tài khoản chưa được cấp quyền SUP. Kiểm tra user_supervisors.');
      throw new Error('Không thể tải dữ liệu Supabase. Kiểm tra tài khoản, SQL kết nối và quyền truy cập.');
    }
    return payload;
  }

  async function load() {
    const snapshot = await request('/rest/v1/rpc/hvn_sup_snapshot', {});
    if (!snapshot || !snapshot.user || !snapshot.data || !['regions', 'employees', 'supervisors', 'stores'].every(key => Array.isArray(snapshot[key])) || !Array.isArray(snapshot.data.reports) || !Array.isArray(snapshot.data.checkIns)) {
      throw new Error('Dữ liệu Supabase không đúng cấu trúc. Kiểm tra hvn_sup_snapshot.');
    }
    // Fixture IDs do not point to uploaded Storage files. Do not invent photos.
    snapshot.data.reports = snapshot.data.reports.map(report => ({ ...report, photoIds: [], photoKinds: [], sample: false }));
    return snapshot;
  }

  async function login(email, password) {
    accessToken = '';
    try {
      const session = await request('/auth/v1/token?grant_type=password', { email: email.trim(), password }, '');
      if (!session?.access_token) throw new Error('Supabase không trả phiên đăng nhập.');
      accessToken = session.access_token;
      return await load();
    } catch (error) {
      accessToken = '';
      throw error;
    }
  }

  async function logout() {
    const token = accessToken;
    accessToken = '';
    if (token) await request('/auth/v1/logout', {}, token).catch(() => {});
  }

  global.HvnSupabase = { enabled, validateConfig, login, load, logout };
})(window);
