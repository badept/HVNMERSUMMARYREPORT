(async function () {
  'use strict';

  const Mock = window.HvnMockData;
  const remote = window.HvnSupabase;
  const cloudMode = remote?.enabled === true;
  let loginPending = false;
  let refreshPending = false;
  const root = document.getElementById('hvnRoot');
  const DATA_KEY = 'hvn-mer-webview-data-v1';
  const DATABASE_NAME = 'hvn-mer-webview-images-v1';
  const DATA_VERSION = 1;
  const state = {
    data: null,
    user: null,
    screen: 'loading',
    selectedStoreId: '',
    reportDetailReturnScreen: '',
    selectedEmployeeId: '',
    selectedReportId: '',
    selectedPhotoId: '',
    filterDate: localDateISO(),
    filterRegionId: 'all',
    merMonth: localDateISO().slice(0, 7),
    search: '',
    merStoreStatus: 'all',
    teamStatus: 'all',
    expandedEmployeeId: '',
    teamShowAll: false,
    draft: null,
    pendingPhotoFiles: 0,
    savingReport: false,
    reportPreviewOpen: false,
    loginError: '',
    toast: null,
    imageUrls: new Map(),
    imageTasks: new Map()
  };
  let database;
  let toastTimer;

  const icons = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    store: '<path d="M3 9l2-6h14l2 6v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zm1 5v7h16v-7M9 21v-6h6v6"/>',
    report: '<path d="M7 3h8l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v6h6M9 13h7m-7 4h7"/>',
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    region: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    camera: '<path d="M14 5l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4.5L10 5z"/><circle cx="12" cy="13" r="3.5"/>',
    plus: '<path d="M12 5v14m-7-7h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-9h.01"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    logout: '<path d="M10 17l5-5-5-5m5 5H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>'
  };

  function localDateISO(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function shiftDate(value, days) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return localDateISO(date);
  }

  function shiftMonth(value, months) {
    const [year, month] = value.split('-').map(Number);
    const date = new Date(year, month - 1 + months, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function formatMonth(value) {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  }

  function summaryDelivery(channel) {
    return (state.data.deliveries || [])
      .filter(item => item.date === state.filterDate &&
        item.regionId === state.filterRegionId && item.channel === channel)
      .sort((left, right) => right.sentAt.localeCompare(left.sentAt))[0] || null;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function icon(name, size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const [year, month, day] = value.slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.toLocaleDateString('vi-VN')} · ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function slugId() {
    return `R-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function showToast(message, kind = 'success') {
    state.toast = { message, kind };
    render();
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      state.toast = null;
      render();
    }, 3200);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Trình duyệt này không hỗ trợ IndexedDB để lưu ảnh.'));
        return;
      }
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id' });
        }
      };
      request.onerror = () => reject(request.error || new Error('Không thể mở kho ảnh.'));
      request.onblocked = () => reject(new Error('Đóng các tab HVN Mer khác rồi tải lại để mở kho ảnh.'));
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }

  function imageStoreRequest(method, value) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('images', method === 'get' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('images');
      let result;
      let request;
      if (method === 'get') request = store.get(value);
      else if (method === 'delete') request = store.delete(value);
      else if (method === 'clear') request = store.clear();
      else request = store.put(value);
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error || new Error('Không thể lưu hoặc đọc ảnh.'));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('Lỗi trong kho lưu trữ ảnh.'));
      transaction.onabort = () => reject(transaction.error || new Error('Đã hủy thao tác lưu ảnh.'));
    });
  }

  function localDataOrSeed() {
    const stored = localStorage.getItem(DATA_KEY);
    if (stored === null) return seedData();
    let data;
    try {
      data = JSON.parse(stored);
    } catch {
      throw new Error('Dữ liệu demo trên thiết bị bị lỗi. Hãy đặt lại dữ liệu demo trong Cài đặt.');
    }
    if (data.version !== DATA_VERSION || !Array.isArray(data.reports) || !Array.isArray(data.checkIns)) {
      throw new Error('Phiên bản dữ liệu demo không tương thích. Hãy đặt lại dữ liệu demo trong Cài đặt.');
    }
    let updated = false;
    if (!Array.isArray(data.deliveries)) {
      data.deliveries = [];
      updated = true;
    }
    const knownReports = new Set(data.reports.map(report => report.id));
    for (const report of createHistoricalReports()) {
      if (knownReports.has(report.id)) continue;
      data.reports.push(report);
      data.checkIns.push({
        key: checkInKey(report.storeId, report.date),
        storeId: report.storeId,
        employeeId: report.employeeId,
        date: report.date,
        timestamp: report.submittedAt,
        mockLocation: true
      });
      updated = true;
    }
    if (!data.teamFixtureAdded) {
      const fixture = seedData();
      for (const report of fixture.reports.filter(item => item.id.startsWith('DEMO-TEAM-'))) {
        if (data.reports.some(item => item.storeId === report.storeId && item.date === report.date)) continue;
        data.reports.push(report);
        const checkIn = fixture.checkIns.find(item => item.storeId === report.storeId && item.date === report.date);
        if (!data.checkIns.some(item => item.key === checkIn.key)) data.checkIns.push(checkIn);
      }
      data.teamFixtureAdded = true;
      updated = true;
    }
    if (updated) persistData(data);
    return data;
  }

  function createHistoricalReports() {
    return (Mock.historicalReports || []).map(sample => ({
      id: sample.id,
      storeId: sample.storeId,
      employeeId: sample.employeeId,
      regionId: sample.regionId,
      date: shiftDate(localDateISO(), sample.dayOffset),
      submittedAt: `${shiftDate(localDateISO(), sample.dayOffset)}T${sample.time}:00`,
      status: 'submitted',
      display: clone(sample.display),
      stock: clone(sample.stock),
      notes: sample.notes,
      photoIds: [`${sample.id}-front`, `${sample.id}-shelf`],
      photoKinds: [
        { id: `${sample.id}-front`, kind: 'front' },
        { id: `${sample.id}-shelf`, kind: 'shelf' }
      ],
      sample: true
    }));
  }

  function seedData() {
    const date = localDateISO();
    const reports = Mock.sampleReports.map(sample => {
      const report = clone(sample);
      report.date = date;
      report.submittedAt = `${date}T${report.sampleTime}:00`;
      delete report.sampleTime;
      return report;
    });
    reports.push(...createHistoricalReports());
    const checkIns = reports.map(report => ({
      key: checkInKey(report.storeId, report.date),
      storeId: report.storeId,
      employeeId: report.employeeId,
      date: report.date,
      timestamp: report.submittedAt,
      mockLocation: true
    }));
    return { version: DATA_VERSION, reports, checkIns, deliveries: [], teamFixtureAdded: true };
  }

  function checkInKey(storeId, date) {
    return `${storeId}|${date}`;
  }

  function persistData(data = state.data) {
    if (cloudMode) throw new Error('Chế độ Supabase hiện chỉ hỗ trợ SUP xem dữ liệu.');
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } catch {
      throw new Error('Không đủ dung lượng LocalStorage. Hãy xóa dữ liệu demo không cần thiết hoặc thử lại.');
    }
  }

  function samplePhotoSvg(kind, date = localDateISO(), time = '') {
    const front = kind === 'front';
    const scene = front
      ? '<rect x="38" y="75" width="284" height="145" rx="7" fill="#faf8ef"/><rect x="55" y="92" width="250" height="29" rx="4" fill="#008200"/><text x="180" y="112" text-anchor="middle" fill="#fff" font-size="16" font-family="Arial" font-weight="700">CỬA HÀNG · DỮ LIỆU MẪU</text><rect x="62" y="137" width="84" height="83" fill="#b9d8e0"/><rect x="160" y="137" width="55" height="83" fill="#718d7c"/><rect x="229" y="137" width="61" height="83" fill="#b9d8e0"/><circle cx="189" cy="164" r="11" fill="#d2a27e"/><path d="M178 179h22l7 39h-36z" fill="#086745"/>'
      : '<rect x="42" y="57" width="276" height="178" rx="8" fill="#f7f5eb"/><rect x="58" y="74" width="244" height="29" rx="4" fill="#008200"/><text x="180" y="94" text-anchor="middle" fill="#fff" font-size="14" font-family="Arial" font-weight="700">QUẦY TRƯNG BÀY · MẪU</text><path d="M66 126h228M66 170h228M66 214h228" stroke="#718278" stroke-width="6"/><path d="M84 108v132m47-132v132m49-132v132m49-132v132m48-132v132" stroke="#c5cec7" stroke-width="3"/><g fill="#e1ae55"><rect x="72" y="131" width="20" height="31" rx="4"/><rect x="98" y="131" width="20" height="31" rx="4"/><rect x="150" y="175" width="20" height="31" rx="4"/><rect x="177" y="175" width="20" height="31" rx="4"/><rect x="229" y="131" width="20" height="31" rx="4"/><rect x="255" y="131" width="20" height="31" rx="4"/></g>';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="270" viewBox="0 0 360 270"><rect width="360" height="270" fill="#dce8df"/><path d="M0 235h360v35H0z" fill="#bbc9bd"/>${scene}<rect y="237" width="360" height="33" fill="#10261bbd"/><text x="16" y="258" fill="#fff" font-size="11" font-family="Arial" font-weight="700">ẢNH MINH HỌA · ${formatDate(date)}${time ? ` · ${time}` : ''} · BẢN DEMO</text></svg>`;
  }

  async function ensureSampleImages() {
    for (const report of state.data.reports.filter(item => item.sample)) {
      const store = Mock.stores.find(item => item.id === report.storeId);
      for (let index = 0; index < report.photoIds.length; index += 1) {
        const id = report.photoIds[index];
        if (!await imageStoreRequest('get', id)) {
          const kind = index === 0 ? 'front' : 'shelf';
          const timestamp = new Date(report.submittedAt);
          const sampleTime = Number.isNaN(timestamp.getTime())
            ? ''
            : timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          const blob = new Blob([samplePhotoSvg(kind, report.date, sampleTime)], { type: 'image/svg+xml' });
          await imageStoreRequest('put', {
            id, blob, kind, fileName: `anh-minh-hoa-${store.code}-${kind}.svg`,
            watermarkLabel: 'Ảnh minh họa · Dữ liệu demo',
            createdAt: report.submittedAt, sample: true
          });
        }
      }
    }
  }

  function regionById(id) {
    return Mock.regions.find(region => region.id === id);
  }

  function employeeById(id) {
    return Mock.employees.find(employee => employee.id === id);
  }

  function supervisorById(id) {
    return Mock.supervisors.find(person => person.id === id);
  }

  function currentPerson() {
    if (!state.user) return null;
    return state.user.role === 'sup' ? supervisorById(state.user.employeeId) : employeeById(state.user.employeeId);
  }

  function allowedRegionIds() {
    const person = currentPerson();
    return person ? person.regionIds : [];
  }

  function visibleRegions() {
    const allowed = new Set(allowedRegionIds());
    return Mock.regions.filter(region => allowed.has(region.id));
  }

  function visibleStores() {
    const regions = new Set(allowedRegionIds());
    return Mock.stores.filter(store =>
      regions.has(store.regionId) && (state.user.role === 'sup' || store.employeeId === state.user.employeeId)
    );
  }

  function filteredStores(regionId = state.filterRegionId) {
    return visibleStores().filter(store => regionId === 'all' || store.regionId === regionId);
  }

  function reportForStore(storeId, date = state.filterDate) {
    return state.data.reports
      .filter(report => report.storeId === storeId && report.date === date)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))[0] || null;
  }

  function reportsFor(date = state.filterDate, stores = filteredStores()) {
    const storeIds = new Set(stores.map(store => store.id));
    return state.data.reports.filter(report => report.date === date && storeIds.has(report.storeId));
  }

  function aggregate(stores, date = state.filterDate) {
    const reports = reportsFor(date, stores);
    const reported = new Set(reports.map(report => report.storeId));
    const target = stores.reduce((sum, store) => sum + store.target, 0);
    const completedTarget = stores.reduce((sum, store) => sum + (reported.has(store.id) ? store.target : 0), 0);
    const activeEmployees = new Set([
      ...reports.map(report => report.employeeId),
      ...state.data.checkIns
        .filter(checkIn => checkIn.date === date && stores.some(store => store.id === checkIn.storeId))
        .map(checkIn => checkIn.employeeId)
    ]);
    return {
      stores: stores.length,
      target,
      completed: completedTarget,
      pending: Math.max(target - completedTarget, 0),
      reportsSent: reports.filter(report => report.status === 'submitted').length,
      reportTotal: stores.length,
      activeMer: activeEmployees.size,
      percent: target ? Math.round(completedTarget / target * 100) : 0,
      reports
    };
  }

  function merStats(employeeId, date = localDateISO()) {
    const stores = visibleStores().filter(store => store.employeeId === employeeId);
    return aggregate(stores, date);
  }

  function merMonthlySummary(employeeId, month) {
    const stores = visibleStores().filter(store => store.employeeId === employeeId);
    const storeIds = new Set(stores.map(store => store.id));
    const reports = state.data.reports.filter(report =>
      report.employeeId === employeeId &&
      report.date.startsWith(`${month}-`) &&
      storeIds.has(report.storeId)
    );
    const activeDays = new Set(reports.map(report => report.date)).size;
    const visitedStores = new Set(reports.map(report => report.storeId)).size;
    const displayTotals = Object.fromEntries(Mock.displayFields.map(field => [
      field.id,
      reports.reduce((sum, report) => sum + (Number(report.display[field.id]) || 0), 0)
    ]));
    const weekCounts = Array.from({ length: 5 }, (_, index) => ({
      week: index + 1,
      count: reports.filter(report => Math.floor((Number(report.date.slice(8, 10)) - 1) / 7) === index).length
    }));
    return {
      reports,
      assignedStores: stores.length,
      visitedStores,
      activeDays,
      completion: stores.length ? Math.round(visitedStores / stores.length * 100) : 0,
      displayTotals,
      weekCounts
    };
  }

  function checkInFor(storeId, date = localDateISO()) {
    return state.data.checkIns.find(item => item.key === checkInKey(storeId, date)) || null;
  }

  function storeNumber(storeId) {
    const index = Mock.stores.findIndex(store => store.id === storeId);
    return index < 0 ? '—' : String(index + 1).padStart(2, '0');
  }

  function reportLabel(store, date = state.filterDate) {
    if (reportForStore(store.id, date)) return { text: 'Đã báo cáo', kind: 'done' };
    if (checkInFor(store.id, date)) return { text: 'Đã check-in', kind: 'pending' };
    return { text: 'Chưa báo cáo', kind: 'neutral' };
  }

  function displayProgress(value) {
    const width = Math.min(100, Math.max(0, value || 0));
    return `<div class="hv-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width}"><span style="width:${width}%"></span></div>`;
  }

  function statusChip(text, kind = 'done') {
    return `<span class="hv-status ${kind === 'done' ? '' : kind}">${escapeHtml(text)}</span>`;
  }

  function iconButton(action, label, name) {
    return `<button type="button" class="hv-icon-button" data-hv-act="${action}" aria-label="${escapeHtml(label)}">${icon(name, 19)}</button>`;
  }

  function sectionHeading(title, description = '', trailing = '') {
    return `<div class="hv-section-heading"><div><h2>${title}</h2>${description ? `<p>${description}</p>` : ''}</div>${trailing}</div>`;
  }

  function cardHeading(title, description = '', trailing = '') {
    return `<div class="hv-card-heading"><div><h3>${title}</h3>${description ? `<p>${description}</p>` : ''}</div>${trailing}</div>`;
  }

  function button(label, action, options = {}) {
    const classes = ['hv-button', options.kind || '', options.full ? 'full' : '', options.small ? 'small' : ''].filter(Boolean).join(' ');
    const disabled = options.disabled ? 'disabled' : '';
    return `<button type="button" class="${classes}" data-hv-act="${action}" ${disabled}>${options.icon ? icon(options.icon, 17) : ''}${label}</button>`;
  }

  function appHeader(title, subtitle = '') {
    const person = currentPerson();
    const initials = person ? person.name.split(' ').map(part => part[0]).slice(-2).join('') : 'HV';
    return `<header class="hv-header"><div class="hv-header-row"><div class="hv-header-copy"><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div><button type="button" class="hv-avatar" data-hv-act="account" aria-label="Mở tài khoản">${escapeHtml(initials)}</button></div></header>`;
  }

  function dateFilter() {
    return `<label class="hv-field" style="margin:0;max-width:180px"><span class="hv-field-label">Ngày báo cáo</span><input class="hv-input" id="hvDateFilter" type="date" value="${escapeHtml(state.filterDate)}"></label>`;
  }

  function merDateSelector() {
    const today = localDateISO();
    const isToday = state.filterDate === today;
    return `<section class="hv-mer-date-panel" aria-label="Chọn ngày báo cáo"><div class="hv-mer-date-title"><div><span class="hv-overline">NGÀY BÁO CÁO</span><strong>${formatDate(state.filterDate)}</strong></div>${isToday ? statusChip('Hôm nay') : statusChip('Lịch sử', 'pending')}</div><div class="hv-mer-date-controls"><button type="button" class="hv-icon-button" data-hv-act="mer-date-prev" aria-label="Ngày trước">${icon('back', 19)}</button><label class="hv-mer-date-input">${icon('calendar', 17)}<input id="hvMerDatePicker" type="date" value="${escapeHtml(state.filterDate)}" max="${today}" aria-label="Chọn ngày báo cáo"></label><button type="button" class="hv-icon-button" data-hv-act="mer-date-next" aria-label="Ngày sau" ${isToday ? 'disabled' : ''}>${icon('next', 19)}</button><button type="button" class="hv-button small secondary hv-today-button" data-hv-act="mer-date-today" ${isToday ? 'disabled' : ''}>Hôm nay</button></div></section>`;
  }

  function renderMerMonthlySummary() {
    const month = state.merMonth;
    const currentMonth = localDateISO().slice(0, 7);
    const summary = merMonthlySummary(state.user.employeeId, month);
    const maxWeekCount = Math.max(1, ...summary.weekCounts.map(item => item.count));
    const weekBars = summary.weekCounts.map(item => {
      const width = Math.round(item.count / maxWeekCount * 100);
      return `<div class="hv-month-week"><span>Tuần ${item.week}</span><div class="hv-month-bar" role="progressbar" aria-label="Tuần ${item.week}" aria-valuemin="0" aria-valuemax="${maxWeekCount}" aria-valuenow="${item.count}"><i style="width:${width}%"></i></div><strong>${item.count}</strong></div>`;
    }).join('');
    const displayTotals = Mock.displayFields.map(field =>
      `<div class="hv-display-total"><span>${escapeHtml(field.label)}</span><strong>${summary.displayTotals[field.id]}</strong></div>`
    ).join('');
    return `<section class="hv-section hv-monthly-section" aria-labelledby="hvMonthlySummaryTitle"><article class="hv-card"><div class="hv-month-heading"><div><span class="hv-overline">TỔNG QUAN MER</span><h2 id="hvMonthlySummaryTitle">Summary tháng</h2></div><span class="hv-month-mark">${icon('calendar', 18)}</span></div><div class="hv-month-controls"><button type="button" class="hv-icon-button" data-hv-act="mer-month-prev" aria-label="Tháng trước">${icon('back', 19)}</button><label class="hv-month-input"><strong>${escapeHtml(formatMonth(month))}</strong><input id="hvMerMonthPicker" type="month" value="${escapeHtml(month)}" max="${currentMonth}" aria-label="Chọn tháng"></label><button type="button" class="hv-icon-button" data-hv-act="mer-month-next" aria-label="Tháng sau" ${month >= currentMonth ? 'disabled' : ''}>${icon('next', 19)}</button></div><div class="hv-month-kpis"><div><strong>${summary.reports.length}</strong><span>Báo cáo đã lưu</span></div><div><strong>${summary.visitedStores}/${summary.assignedStores}</strong><span>Store đã ghé / được giao</span></div><div><strong>${summary.activeDays}</strong><span>Ngày có hoạt động</span></div><div><strong>${summary.completion}%</strong><span>Độ phủ cửa hàng</span></div></div><div class="hv-month-progress">${displayProgress(summary.completion)}<div class="hv-progress-caption"><span>Độ phủ Store</span><b>${summary.completion}%</b></div></div><div class="hv-month-chart-heading"><strong>Báo cáo theo tuần</strong><span>${summary.reports.length} báo cáo</span></div>${summary.reports.length ? `<div class="hv-month-chart">${weekBars}</div>` : '<div class="hv-month-empty">Chưa có báo cáo trong tháng này.</div>'}<details class="hv-month-display"><summary>Tổng điểm trưng bày theo hạng mục</summary><div class="hv-display-total-grid">${displayTotals}</div></details></article></section>`;
  }

  function regionFilter() {
    const options = visibleRegions().map(region =>
      `<option value="${region.id}" ${state.filterRegionId === region.id ? 'selected' : ''}>${escapeHtml(region.name)}</option>`
    ).join('');
    return `<label class="hv-field" style="margin:0;flex:1;min-width:145px"><span class="hv-field-label">Khu vực</span><select class="hv-select" id="hvRegionFilter"><option value="all" ${state.filterRegionId === 'all' ? 'selected' : ''}>Tất cả khu vực</option>${options}</select></label>`;
  }

  function bottomNavigation() {
    const items = state.user.role === 'sup'
      ? [['dashboard', 'Tổng quan', 'home'], ['employees', 'Đội ngũ & BC', 'people']]
      : [['dashboard', 'Tổng quan', 'home'], ['report-list', 'Báo cáo', 'store'], ['history', 'Lịch sử', 'clock'], ['account', 'Tài khoản', 'user']];
    const selected = state.screen === 'employee-detail' ? 'employees'
      : state.screen === 'report-detail' ? (state.user.role === 'sup' ? 'employees' : 'history')
      : state.screen === 'check-in' || state.screen === 'report-form' ? (state.user.role === 'sup' ? 'reports' : 'report-list')
      : state.screen;
    return `<nav class="hv-nav ${state.user.role === 'sup' ? 'hv-nav-sup' : ''}" aria-label="Điều hướng chính">${items.map(([page, label, image]) => `<button type="button" class="hv-nav-button ${selected === page ? 'active' : ''}" data-hv-route="${page}" aria-current="${selected === page ? 'page' : 'false'}">${icon(image, 20)}<span>${label}</span></button>`).join('')}</nav>`;
  }

  function progressCaption(label, percentage) {
    return `<div class="hv-progress-caption"><span>${label}</span><b>${percentage}%</b></div>`;
  }

  function renderStoreCard(store) {
    const status = reportLabel(store, state.user.role === 'sup' ? state.filterDate : localDateISO());
    const employee = employeeById(store.employeeId);
    const report = reportForStore(store.id, state.user.role === 'sup' ? state.filterDate : localDateISO());
    const action = state.user.role === 'mer' ? 'start-report' : 'open-store-report';
    const actionLabel = state.user.role === 'mer'
      ? report ? 'Xem báo cáo' : 'Check-in · Báo cáo'
      : report ? 'Xem báo cáo' : 'Chưa báo cáo';
    const reportAction = state.user.role === 'sup' && !report
      ? statusChip('Chưa có báo cáo', 'neutral')
      : `<button type="button" class="hv-inline-link" data-hv-act="${state.user.role === 'mer' && report ? 'open-report-detail' : action}" data-return-screen="${state.screen}" ${state.user.role === 'mer' && report ? `data-report-id="${report.id}"` : `data-store-id="${store.id}"`}>${actionLabel} ${icon('next', 14)}</button>`;
    return `<article class="hv-store-row"><div class="hv-row"><div><div class="hv-store-title">${escapeHtml(store.code)} · ${escapeHtml(store.name)}</div><div class="hv-store-meta">${escapeHtml(regionById(store.regionId).name)} · ${escapeHtml(employee ? employee.name : '')}</div></div>${statusChip(status.text, status.kind)}</div><div class="hv-store-foot"><span class="hv-subtle">Target ${store.target}${report ? ` · Gửi ${new Date(report.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>${reportAction}</div></article>`;
  }

  function renderKpi(value, label, help, image, wide = false) {
    return `<article class="hv-kpi ${wide ? 'wide' : ''}"><div class="hv-kpi-icon">${icon(image, 17)}</div><strong>${value}</strong><span>${label}</span></article>`;
  }

  function renderRegionCard(region, date = state.filterDate, selected = false) {
    const stores = filteredStores(region.id);
    const stats = aggregate(stores, date);
    const managed = Mock.employees.filter(employee => employee.regionIds.includes(region.id)).length;
    const visited = stores.filter(store => reportForStore(store.id, date) || checkInFor(store.id, date)).length;
    return `<button type="button" class="hv-region-card ${selected ? 'selected' : ''}" data-hv-act="select-region" data-region-id="${region.id}" aria-label="Lọc khu vực ${escapeHtml(region.name)}"><div class="hv-row"><strong>${escapeHtml(region.name)}</strong></div><div class="hv-region-stats"><div><b>${stats.activeMer}/${managed}</b><span>Hoạt động / Quản lý</span></div><div><b>${visited}/${stats.stores}</b><span>Store đã đi / PLAN</span></div><div><b>${stats.completed}</b><span>Đã báo cáo</span></div><div><b>${stats.pending}</b><span>Chưa báo cáo</span></div></div><div class="hv-region-card-action">${selected ? 'Đang xem khu vực' : 'Xem khu vực'} ${icon('next', 14)}</div></button>`;
  }

  function renderLogin() {
    if (cloudMode) return `<main class="hv-login-wrap"><section class="hv-login"><h1>Đăng nhập SUP</h1><p>Xem dữ liệu từ Supabase.</p><form id="hvLoginForm"><div class="hv-field"><label for="hvUsername">Email</label><input class="hv-input" id="hvUsername" name="username" type="email" autocomplete="username" required></div><div class="hv-field"><label for="hvPassword">Mật khẩu</label><input class="hv-input" id="hvPassword" name="password" type="password" autocomplete="current-password" required></div>${state.loginError ? `<div class="hv-login-error" role="alert">${escapeHtml(state.loginError)}</div>` : ''}${button(loginPending ? 'Đang đăng nhập…' : 'Đăng nhập', 'login', { full: true, disabled: loginPending })}</form><div class="hv-help">Dùng tài khoản được cấp quyền SUP. Tải lại trang sẽ yêu cầu đăng nhập lại.</div></section></main>`;
    return `<main class="hv-login-wrap"><section class="hv-login" aria-labelledby="hv-login-title"><h1 id="hv-login-title">Đăng nhập</h1><p>Đăng nhập demo để mở đúng màn hình theo vai trò.</p><form id="hvLoginForm"><div class="hv-field"><label for="hvUsername">Mã nhân viên</label><input class="hv-input" id="hvUsername" name="username" autocomplete="username" placeholder="Nhập mã nhân viên" required></div><div class="hv-field"><label for="hvPassword">Mật khẩu</label><input class="hv-input" id="hvPassword" name="password" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu" required></div>${state.loginError ? `<div class="hv-login-error" role="alert">${escapeHtml(state.loginError)}</div>` : ''}<div style="margin-top:16px">${button('Đăng nhập', 'login', { full: true })}</div></form><div class="hv-demo-accounts"><div class="hv-overline">Tài khoản demo</div><button type="button" class="hv-demo-account" data-hv-act="fill-login" data-demo-user="mer001"><span>Mer · Phạm Hải Đăng</span><b>mer001 / 123456</b></button><button type="button" class="hv-demo-account" data-hv-act="fill-login" data-demo-user="sup001"><span>Sup · Nguyễn Xuân Toàn</span><b>sup001 / 123456</b></button></div><div class="hv-help">Đăng nhập chỉ mô phỏng frontend; không phải cơ chế xác thực bảo mật.</div></section></main>`;
  }

  function renderLoading() {
    if (cloudMode) return '<main class="hv-loading" role="status"><section class="hv-login"><strong>Đang tải dữ liệu Supabase…</strong></section></main>';
    return `<main class="hv-loading" role="status"><section class="hv-login"><div class="hv-skeleton"></div><strong>Đang mở HVN Mer…</strong><p class="hv-subtle">Đang tải dữ liệu demo và kho ảnh trên thiết bị.</p></section></main>`;
  }

  function renderStorageError() {
    if (cloudMode) return `<main class="hv-login-wrap"><section class="hv-login"><h1>Không thể kết nối</h1><p>${escapeHtml(state.storageError)}</p>${button('Thử lại', 'retry-storage', { full: true })}</section></main>`;
    return `<main class="hv-login-wrap"><section class="hv-login"><h1>Không thể tải dữ liệu</h1><p>${escapeHtml(state.storageError || 'Kho lưu trữ không sẵn sàng.')}</p><div class="hv-help">Ảnh được lưu trên thiết bị bằng IndexedDB; dữ liệu báo cáo được lưu bằng LocalStorage.</div><div class="hv-list" style="margin-top:14px"><button class="hv-button secondary full" data-hv-act="retry-storage">Thử tải lại</button><button class="hv-button danger full" data-hv-act="reset-storage">Xóa dữ liệu demo lỗi và tạo lại</button></div></section></main>`;
  }

  function render() {
    if (!root) return;
    const draftImageIds = new Set((state.draft?.photos || []).filter(photo => !photo.existing).map(photo => photo.id));
    for (const [id, url] of state.imageUrls) {
      if (draftImageIds.has(id)) continue;
      if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
      state.imageUrls.delete(id);
    }
    for (const photo of state.draft?.photos || []) {
      if (!photo.existing && photo.blob && !state.imageUrls.has(photo.id)) {
        state.imageUrls.set(photo.id, URL.createObjectURL(photo.blob));
      }
    }
    if (state.screen === 'loading') {
      root.innerHTML = renderLoading();
    } else if (state.screen === 'storage-error') {
      root.innerHTML = renderStorageError();
    } else if (!state.user) {
      root.innerHTML = renderLogin();
    } else {
      root.innerHTML = `<div class="hv-shell"><div class="hv-phone">${renderScreen()}${bottomNavigation()}</div>${state.selectedPhotoId ? renderPhotoModal() : ''}${state.reportPreviewOpen && state.user.role === 'sup' ? renderSupReportPreview() : ''}${state.toast ? `<div class="hv-toast ${state.toast.kind === 'error' ? 'error' : ''}" role="status">${escapeHtml(state.toast.message)}</div>` : ''}</div>`;
      hydrateVisibleImages();
    }
  }

  function renderScreen() {
    const screens = {
      dashboard: () => state.user.role === 'sup' ? renderSupDashboard() : renderMerDashboard(),
      employees: renderEmployees,
      regions: renderSupDashboard,
      reports: renderReports,
      'report-list': renderMerReportList,
      'check-in': renderCheckIn,
      'report-form': renderReportForm,
      history: renderHistory,
      'employee-detail': renderEmployeeDetail,
      'report-detail': renderReportDetail,
      account: renderAccount
    };
    const screen = screens[state.screen];
    return screen ? screen() : state.user.role === 'sup' ? renderSupDashboard() : renderMerDashboard();
  }

  function renderSupMetric(title, value, baseline, image) {
    const parts = String(value).split('/');
    const number = escapeHtml(parts[0]) + (parts.length > 1 ? '<small> / ' + escapeHtml(parts[1]) + '</small>' : '');
    return '<article class="hv-sup-metric"><div class="hv-sup-metric-title">' + icon(image, 15) + '<h3>' + title + '</h3></div><strong>' + number + '</strong><span>' + baseline + '</span></article>';
  }

  function renderSupMetrics(stores, regions) {
    const stats = aggregate(stores);
    const managed = Mock.employees.filter(employee => regions.some(region => employee.regionIds.includes(region.id))).length;
    return '<div class="hv-kpi-grid">' +
      renderSupMetric('Nhân sự', stats.activeMer + '/' + managed, 'Hoạt động / Quản lý', 'people') +
      renderSupMetric('Store trưng bày', stats.completed + '/' + stats.target, 'Thực hiện / PLAN', 'store') +
      renderSupMetric('Báo cáo đã nhận', stats.reportsSent + '/' + stats.reportTotal, 'Đã nhận / Total PLAN', 'report') +
      renderSupMetric('Hoàn thành', stats.target ? stats.percent + '%' : '—', 'Theo PLAN', 'check') + '</div>';
  }

  function renderSupDashboard() {
    const person = currentPerson();
    const stores = filteredStores();
    const stats = aggregate(stores);
    const regions = visibleRegions().filter(region => state.filterRegionId === 'all' || region.id === state.filterRegionId);
    return appHeader('Báo cáo trong ngày', '<span class="hv-sup-identity">SUP ' + escapeHtml(person.name) + '</span>') + '<main class="hv-content hv-sup-overview">' + (cloudMode ? '<div class="hv-help">Nguồn: Supabase · ' + button(refreshPending ? 'Đang cập nhật…' : 'Cập nhật dữ liệu', 'refresh-supabase', { small: true, disabled: refreshPending }) + '</div>' : '') + '<div class="hv-filter-row">' + dateFilter() + regionFilter() + '</div>' + renderSupMetrics(stores, regions) +
       (state.filterRegionId !== 'all' && regions.length === 1
        ? '<div class="hv-section">' + renderAreaDisplay(stats.reports, regions[0].id) + '</div>'
        : '<section class="hv-section">' + sectionHeading('Tiến độ khu vực') + '<div class="hv-region-grid">' + regions.map(region => renderRegionCard(region)).join('') + '</div></section>' + renderRegionComparison()) + '</main>';
  }

  function renderMerDashboard() {
    const person = currentPerson();
    const stores = visibleStores();
    const date = state.filterDate;
    const historical = date !== localDateISO();
    const reports = reportsFor(date, stores);
    const completed = stores.filter(store => reportForStore(store.id, date)).length;
    const listed = stores.filter(store => state.merStoreStatus === 'all' || (state.merStoreStatus === 'done' ? !!reportForStore(store.id, date) : !reportForStore(store.id, date)))
      .slice().sort((a,b) => Number(!!reportForStore(a.id,date)) - Number(!!reportForStore(b.id,date)) || a.code.localeCompare(b.code));
    const regionNames = person.regionIds.map(id => regionById(id).name).join(' · ');
    return appHeader('Công việc của tôi', '<span class="hv-mer-identity">' + escapeHtml(person.name) + '</span>' + escapeHtml(regionNames)) + '<main class="hv-content hv-mer-work">' + merDateSelector() +
      (historical ? '<div class="hv-callout hv-history-callout">Chỉ xem · Ngày đã chọn</div>' : '') +
      '<div class="hv-kpi-grid">' + renderSupMetric('Actual / Plan', completed + '/' + stores.length, 'Cửa hàng đã báo cáo', 'store') + renderSupMetric('Chưa báo cáo', stores.length - completed, 'Cửa hàng', 'clock') + '</div><div class="hv-section">' + renderAreaDisplay(reports) + '</div><section class="hv-section">' + sectionHeading('Cửa hàng của tôi', stores.length + ' điểm bán') +
      '<div class="hv-team-filters">' + [['all','Tất cả'],['pending','Chưa xong'],['done','Đã báo cáo']].map(([value,label]) => '<button type="button" data-hv-act="mer-store-status" data-status="' + value + '" aria-pressed="' + (state.merStoreStatus === value) + '">' + label + '</button>').join('') + '</div><div class="hv-list">' + (listed.map(store => renderMerDailyStoreCard(store,date,historical)).join('') || '<div class="hv-empty">Không có cửa hàng trong bộ lọc này.</div>') + '</div></section></main>';
  }

  function renderMerDailyStoreCard(store, date, historical) {
    const report = reportForStore(store.id, date);
    const status = report ? statusChip('Đã báo cáo') : statusChip('Chưa báo cáo', 'pending');
    const action = report
      ? `<button type="button" class="hv-button small secondary" data-hv-act="open-report-detail" data-report-id="${escapeHtml(report.id)}">Số liệu & ảnh</button>`
      : !historical
        ? `<button type="button" class="hv-button small" data-hv-act="start-report" data-store-id="${escapeHtml(store.id)}">Báo cáo ${icon('next', 14)}</button>`
        : '';
    return `<article class="hv-store-row hv-mer-day-store"><div class="hv-row"><div class="hv-mer-store-ident"><span class="hv-store-number">${storeNumber(store.id)}</span><div><div class="hv-store-title">${escapeHtml(store.code)} · ${escapeHtml(store.name)}</div><div class="hv-store-meta">${escapeHtml(regionById(store.regionId).name)}</div></div></div>${status}</div><div class="hv-store-foot"><span class="hv-subtle">${report ? `Báo cáo lúc ${new Date(report.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : historical ? 'Chưa có báo cáo ngày này' : checkInFor(store.id, date) ? 'Đã check-in, chưa báo cáo' : 'Chưa có hoạt động'}</span>${action}</div></article>`;
  }

  function renderEmployeeCards(stores = filteredStores()) {
    const allowed = new Set(stores.map(store => store.id));
    const people = Mock.employees.filter(person =>
      person.regionIds.some(regionId => visibleRegions().some(region => region.id === regionId)) &&
      stores.some(store => store.employeeId === person.id)
    );
    if (!people.length) return '<div class="hv-empty">Không có nhân viên trong phạm vi này.</div>';
    return people.map(person => {
      const assigned = Mock.stores.filter(store => allowed.has(store.id) && store.employeeId === person.id);
      const stats = aggregate(assigned);
      const regionName = person.regionIds.map(id => regionById(id).name).join(', ');
      return `<button type="button" class="hv-person-row" data-hv-act="open-employee" data-employee-id="${person.id}"><div class="hv-row"><div class="hv-row" style="justify-content:flex-start"><span class="hv-avatar">${escapeHtml(person.name.split(' ').map(part => part[0]).slice(-2).join(''))}</span><div><div class="hv-store-title">${escapeHtml(person.name)}</div><div class="hv-store-meta">${person.id} · ${escapeHtml(regionName)}</div></div></div>${statusChip(`${stats.completed}/${stats.target}`, stats.pending ? 'pending' : 'done')}</div><div style="margin-top:11px">${displayProgress(stats.percent)}<div class="hv-progress-caption"><span>${assigned.length} Store · ${stats.completed} đã báo cáo</span><span>${stats.percent}%</span></div></div></button>`;
    }).join('');
  }

  function renderEmployees() {
    const stores = filteredStores();
    const people = Mock.employees.filter(person => person.regionIds.some(id => visibleRegions().some(region => region.id === id)) && (state.filterRegionId === 'all' || person.regionIds.includes(state.filterRegionId)));
    const search = state.search.trim().toLocaleLowerCase('vi');
    const matches = value => value.toLocaleLowerCase('vi').includes(search);
    const groups = people.map(person => {
      const assigned = stores.filter(store => store.employeeId === person.id);
      const reports = assigned.map(store => reportForStore(store.id)).filter(Boolean);
      const done = reports.length;
      const complete = assigned.length > 0 && done === assigned.length;
      const personMatch = matches(person.name + ' ' + person.id);
      const matchingStores = assigned.filter(store => matches(store.code + ' ' + store.name));
      if (search && !personMatch && !matchingStores.length) return '';
      if (state.teamStatus === 'done' && !complete || state.teamStatus === 'pending' && complete) return '';
      if (state.teamStatus === 'stores-done' && !done) return '';
      const open = state.expandedEmployeeId === person.id || (search && !personMatch && matchingStores.length > 0);
      const visited = assigned.filter(store => reportForStore(store.id) || checkInFor(store.id)).length;
      const latest = reports.map(report => report.submittedAt).sort().pop();
      const latestText = latest ? new Date(latest).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'}) : '—';
      const listed = (search && !personMatch ? matchingStores : assigned).filter(store => state.teamStatus !== 'stores-done' || reportForStore(store.id)).slice().sort((a,b) => Number(!!reportForStore(a.id)) - Number(!!reportForStore(b.id)) || a.code.localeCompare(b.code));
      const shown = search || state.teamShowAll && state.expandedEmployeeId === person.id ? listed : listed.slice(0,2);
      const rows = shown.map(store => {
        const report = reportForStore(store.id);
        const checkIn = checkInFor(store.id);
        const status = report ? 'Đã báo cáo ' + new Date(report.submittedAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'}) : checkIn ? 'Đã check-in, chưa báo cáo' : 'Chưa có hoạt động';
        const values = report ? '<div class="hv-team-display">' + [['outside','Ngoài kệ'],['glass','Kính'],['coc','COC'],['ge','GE'],['tree','Cây']].map(([key,label]) => '<span>' + label + ' <b>' + (Number(report.display[key]) || 0) + '</b></span>').join('') + '</div>' : '';
        return '<article class="hv-team-store"><strong>' + escapeHtml(store.code + ' · ' + store.name) + '</strong><div class="hv-team-store-status">' + status + '</div>' + values + (report ? '<button type="button" class="hv-inline-link" data-hv-act="open-report-detail" data-report-id="' + escapeHtml(report.id) + '">Số liệu & ảnh ' + icon('next',14) + '</button>' : '') + '</article>';
      }).join('');
      return '<section class="hv-team-person"><button type="button" class="hv-team-toggle" data-hv-act="team-toggle" data-employee-id="' + person.id + '" aria-expanded="' + !!open + '"><div class="hv-row"><strong>' + escapeHtml(person.name) + '</strong><span>' + done + '/' + assigned.length + ' ' + icon(open ? 'back' : 'next',14) + '</span></div><div class="hv-team-meta">' + escapeHtml(person.id + ' · ' + person.regionIds.map(id => regionById(id).name).join(', ')) + (complete ? ' · Hoàn thành' : '') + '</div><div class="hv-team-meta">Đã đi ' + visited + '/' + assigned.length + ' · BC gần nhất ' + latestText + '</div></button>' + (open ? '<div class="hv-team-stores">' + (rows || '<div class="hv-empty">Chưa được giao cửa hàng.</div>') + (shown.length < listed.length ? '<button type="button" class="hv-team-more" data-hv-act="team-more" data-employee-id="' + person.id + '">Xem đủ ' + listed.length + ' cửa hàng</button>' : '') + '</div>' : '') + '</section>';
    }).filter(Boolean).join('');
    const count = stores.filter(store => reportForStore(store.id)).length;
    return appHeader('Đội ngũ & Báo cáo', '<span class="hv-sup-identity">SUP ' + escapeHtml(currentPerson().name) + '</span>') + '<main class="hv-content"><div class="hv-filter-row">' + dateFilter() + regionFilter() + '</div><div class="hv-field"><input class="hv-input" id="hvSearch" type="search" value="' + escapeHtml(state.search) + '" placeholder="Tìm nhân viên, mã hoặc tên store" aria-label="Tìm nhân viên hoặc cửa hàng"></div><div class="hv-team-summary">' + people.length + ' nhân sự · ' + count + '/' + stores.length + ' báo cáo · Còn ' + (stores.length-count) + '</div><div class="hv-team-filters">' + [['all','Tất cả'],['pending','Chưa xong'],['done','Hoàn thành'],['stores-done','CH đã hoàn thành']].map(([value,label]) => '<button type="button" data-hv-act="team-status" data-status="' + value + '" aria-pressed="' + (state.teamStatus===value) + '">' + label + '</button>').join('') + '</div><div class="hv-list">' + (groups || '<div class="hv-empty">Không có nhân viên phù hợp bộ lọc.</div>') + '</div></main>';
  }

  function renderRegionComparison() {
    const rows = visibleRegions().map(region => {
      const stats = aggregate(filteredStores(region.id));
      const managed = Mock.employees.filter(employee => employee.regionIds.includes(region.id)).length;
      return '<tr><th scope="row">' + escapeHtml(region.name) + '</th><td>' + stats.activeMer + '/' + managed  + '</td><td>' + stats.completed + '/' + stats.target + '</td><td>' + stats.pending  + '</td><td>' + (stats.target ? stats.percent + '%' : '—') + '</td></tr>';
    }).join('');
    return '<section class="hv-section"><article class="hv-card">' + cardHeading('So sánh khu vực') + '<div class="hv-table-scroll"><table class="hv-table"><thead><tr><th>Khu vực</th><th>Nhân sự</th><th>Actual / Plan</th><th>Còn lại</th><th>Hoàn thành</th></tr></thead><tbody>' + rows + '</tbody></table></div></article></section>';
  }

  function renderAreaDisplay(reports, regionId = null) {
    const labels = {outside: 'Ngoài kệ / tủ lạnh', glass: 'Mặt kính', coc: 'Quầy thu ngân', ge: 'Đầu kệ', tree: 'Cây bia'};
    const totals = Mock.displayFields.map(field => '<div><span>' + labels[field.id] + '</span><strong>' + (reports.length ? reports.reduce((sum, report) => sum + (Number(report.display[field.id]) || 0), 0) : '—') + '</strong></div>').join('');
    return '<section class="hv-card hv-area-display"><h2>Trưng bày đã ghi nhận</h2><div class="hv-area-display-grid">' + totals + '</div><p>Từ ' + reports.length + ' báo cáo đã nhận</p>' + (regionId ? '<button type="button" class="hv-area-overview-link" data-hv-act="open-completed-stores" data-region-id="' + escapeHtml(regionId) + '">Xem báo cáo tổng quan ' + icon('next', 14) + '</button>' : '') + '</section>';
  }

  function renderReports() {
    if (state.user.role === 'sup') return renderEmployees();
    const stores = filteredStores().filter(store => {
      const employee = employeeById(store.employeeId);
      const search = state.search.toLocaleLowerCase('vi');
      return `${store.code} ${store.name} ${employee.name}`.toLocaleLowerCase('vi').includes(search);
    });
    const stats = aggregate(stores);
    const storeCards = stores.map(store => renderStoreCard(store)).join('');
    return `${appHeader('Báo cáo cửa hàng', `${stats.reportsSent}/${stats.reportTotal} báo cáo đã gửi`)}<main class="hv-content"><div class="hv-filter-row">${dateFilter()}${regionFilter()}</div><div class="hv-field"><input class="hv-input" id="hvSearch" type="search" value="${escapeHtml(state.search)}" placeholder="Tìm mã, cửa hàng hoặc Mer" aria-label="Tìm kiếm báo cáo"></div><section class="hv-section"><div class="hv-list">${storeCards || '<div class="hv-empty"><strong>Không tìm thấy cửa hàng</strong>Thử đổi từ khóa hoặc bộ lọc.</div>'}</div></section></main>`;
  }

  function renderMerReportList() {
    const stores = visibleStores();
    return `${appHeader('Báo cáo điểm bán', `${stores.length} cửa hàng · ${formatDate(localDateISO())}`)}<main class="hv-content"><article class="hv-card">${button('BÁO CÁO ĐIỂM BÁN', 'choose-report-store', { full: true, icon: 'plus' })}<div class="hv-help">Chọn cửa hàng để check-in và ghi nhận trưng bày.</div></article><section class="hv-section">${sectionHeading('Cửa hàng', 'Chọn điểm bán cần báo cáo')}<div class="hv-list">${stores.map(store => renderStoreCard(store)).join('')}</div></section></main>`;
  }

  function renderCheckIn() {
    const store = Mock.stores.find(item => item.id === state.selectedStoreId);
    if (!store || !visibleStores().some(item => item.id === store.id)) return renderNotFound('Không tìm thấy cửa hàng được phân công.');
    const existing = checkInFor(store.id, localDateISO());
    return `${appHeader('Check-in cửa hàng', 'Ghi nhận điểm bán trước khi lập báo cáo.') }<main class="hv-content"><article class="hv-card"><div class="hv-overline">ĐIỂM BÁN ${storeNumber(store.id)}</div><h2 style="margin:5px 0;font-size:17px">${escapeHtml(store.name)}</h2><p class="hv-subtle" style="margin:0">${escapeHtml(store.code)} · ${escapeHtml(regionById(store.regionId).name)}</p><div class="hv-help">${escapeHtml(store.address)}</div><div class="hv-callout warning" style="margin-top:12px">Check-in trong phiên bản demo ghi nhận thời gian trên thiết bị; không xác thực GPS hoặc vị trí thực tế.</div><div style="margin-top:15px">${existing ? `<div class="hv-help">Đã check-in lúc ${formatDateTime(existing.timestamp)}.</div>${button('Tiếp tục báo cáo', 'continue-report', { full: true })}` : button('XÁC NHẬN CHECK-IN', 'confirm-check-in', { full: true, icon: 'check' })}</div></article></main>`;
  }

  function renderReportForm() {
    const store = Mock.stores.find(item => item.id === state.selectedStoreId);
    const draft = state.draft;
    if (!store || !draft || !visibleStores().some(item => item.id === store.id)) return renderNotFound('Không tìm thấy báo cáo hoặc cửa hàng được phân công.');
    const employee = employeeById(state.user.employeeId);
    const photoGroup = kind => draft.photos.filter(photo => photo.kind === kind);
    const totalPhotos = draft.photos.length;
    const frontReady = photoGroup('front').length > 0;
    const shelfReady = photoGroup('shelf').length > 0;
    const photoWarning = photoGroup('front').length && photoGroup('shelf').length
      ? 'Đã có ảnh mặt tiền và ảnh trưng bày.'
      : 'Bắt buộc tải ít nhất 1 ảnh mặt tiền và 1 ảnh quầy kệ.';
    const displayFields = Mock.displayFields.map(field => `<div class="hv-field"><label>${escapeHtml(field.label)}</label><div class="hv-stepper"><button type="button" data-hv-act="stepper" data-field="${field.id}" data-change="-1" aria-label="Giảm ${escapeHtml(field.label)}">−</button><output>${draft.display[field.id]}</output><button type="button" data-hv-act="stepper" data-field="${field.id}" data-change="1" aria-label="Tăng ${escapeHtml(field.label)}">+</button></div></div>`).join('');
    return `${appHeader(draft.editingId ? 'Cập nhật báo cáo' : 'Báo cáo điểm bán', `${escapeHtml(store.code)} · ${formatDate(localDateISO())}`)}<main class="hv-content"><form id="hvReportForm" novalidate><section class="hv-card">${cardHeading('Thông tin cửa hàng')}<div class="hv-field"><label for="hvSerial">STT</label><input id="hvSerial" class="hv-input" value="${storeNumber(store.id)}" readonly></div><div class="hv-field"><label>Mã siêu thị</label><input class="hv-input" value="${escapeHtml(store.code)}" readonly></div><div class="hv-field"><label>Tên siêu thị</label><input class="hv-input" value="${escapeHtml(store.name)}" readonly></div><div class="hv-field"><label>Tên Mer</label><input class="hv-input" value="${escapeHtml(employee.name)}" readonly></div><div class="hv-field"><label>Khu vực</label><input class="hv-input" value="${escapeHtml(regionById(store.regionId).name)}" readonly></div></section><section class="hv-section hv-card">${cardHeading('Số liệu trưng bày', 'Số nguyên từ 0 trở lên')}${displayFields}</section><section class="hv-section hv-card">${cardHeading('Thông tin tồn kho')}<div class="hv-field"><label for="hvExpiry">Hàng cận date</label><input class="hv-input" id="hvExpiry" name="expiry" value="${escapeHtml(draft.stock.expiry)}" maxlength="160" placeholder="Mặt hàng và hạn dùng hoặc Không có"></div><div class="hv-field"><label for="hvPackaging">Bao bì Tết hiện có</label><input class="hv-input" id="hvPackaging" name="packaging" value="${escapeHtml(draft.stock.packaging)}" maxlength="160" placeholder="Loại sản phẩm / bao bì"></div><div class="hv-field"><label for="hvStockNotes">Ghi chú tồn kho</label><textarea class="hv-textarea" id="hvStockNotes" name="stockNotes" maxlength="500" placeholder="Thông tin tồn kho bổ sung">${escapeHtml(draft.stock.notes)}</textarea></div><div class="hv-field"><label for="hvNotes">Ghi chú báo cáo</label><textarea class="hv-textarea" id="hvNotes" name="notes" maxlength="1000" placeholder="Ghi chú trưng bày">${escapeHtml(draft.notes)}</textarea></div></section><section class="hv-section hv-card">${cardHeading('Hình ảnh báo cáo', `${totalPhotos}/2 ảnh tối thiểu`)}<div class="hv-capture-list"><label class="hv-capture" for="hvFrontPhotos">${icon('camera', 21)}<strong>Ảnh mặt tiền + nhân viên</strong><span>Chụp ảnh hoặc tải lên</span></label><label class="hv-capture" for="hvShelfPhotos">${icon('camera', 21)}<strong>Ảnh quầy kệ trưng bày</strong><span>Chụp ảnh hoặc tải lên</span></label></div><input id="hvFrontPhotos" class="hv-hidden-input" type="file" accept="image/*" capture="environment" multiple data-photo-kind="front"><input id="hvShelfPhotos" class="hv-hidden-input" type="file" accept="image/*" capture="environment" multiple data-photo-kind="shelf"><div class="hv-help">${photoWarning} Watermark ghi ngày giờ chụp từ EXIF nếu có; nếu không, ghi rõ giờ tải ảnh.</div>${state.pendingPhotoFiles ? `<div class="hv-callout" role="status">Đang xử lý ${state.pendingPhotoFiles} ảnh và đóng watermark…</div>` : ''}${renderDraftPhotos(draft.photos)}</section><div class="hv-form-actions"><div class="hv-button-row"><button type="button" class="hv-button secondary" data-hv-act="cancel-report" ${state.savingReport || state.pendingPhotoFiles ? 'disabled' : ''}>Hủy</button><button type="button" class="hv-button" data-hv-act="save-report" ${!frontReady || !shelfReady || state.savingReport || state.pendingPhotoFiles ? 'disabled' : ''}>${state.savingReport ? 'Đang lưu…' : draft.editingId ? 'Lưu cập nhật' : 'Lưu báo cáo'}</button></div></div></form></main>`;
  }

  function mediaCaption(photo) {
    return photo.watermarkLabel || (photo.sample ? 'Ảnh minh họa · Dữ liệu demo' : 'Ảnh báo cáo');
  }

  function renderDraftPhotos(photos) {
    if (!photos.length) return '<div class="hv-empty" style="margin-top:10px">Chưa có ảnh. Tải ảnh cho cả hai nhóm ở trên.</div>';
    return `<div class="hv-photos">${photos.map(photo => { const url = state.imageUrls.get(photo.id); return `<figure class="hv-photo"><img ${url ? `src="${escapeHtml(url)}"` : `data-media-id="${escapeHtml(photo.id)}"`} alt="${escapeHtml(mediaCaption(photo))}"><button type="button" class="hv-photo-remove" data-hv-act="remove-photo" data-photo-id="${escapeHtml(photo.id)}" aria-label="Xóa ảnh">${icon('close', 16)}</button><figcaption>${escapeHtml(photo.kind === 'front' ? 'Mặt tiền' : 'Quầy kệ')} · ${escapeHtml(photo.fileName || 'Ảnh')}</figcaption></figure>`; }).join('')}</div>`;
  }

  function renderHistory() {
    const stores = new Map(visibleStores().map(store => [store.id, store]));
    const reports = state.data.reports.filter(report => stores.has(report.storeId)).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    const content = reports.map(report => {
      const store = stores.get(report.storeId);
      return `<article class="hv-store-row"><div class="hv-row"><div><div class="hv-store-title">${formatDate(report.date)} · ${escapeHtml(store.code)}</div><div class="hv-store-meta">${escapeHtml(store.name)}</div></div>${statusChip('Đã gửi')}</div><div class="hv-store-foot"><span class="hv-subtle">Gửi ${new Date(report.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span><button type="button" class="hv-inline-link" data-hv-act="open-report-detail" data-report-id="${report.id}">Xem chi tiết ${icon('next', 14)}</button></div></article>`;
    }).join('');
    return `${appHeader('Lịch sử báo cáo', `${reports.length} báo cáo đã lưu`)}<main class="hv-content"><section class="hv-section"><div class="hv-list">${content || '<div class="hv-empty"><strong>Chưa có báo cáo</strong>Báo cáo đã lưu sẽ hiển thị tại đây.</div>'}</div></section></main>`;
  }

  function renderEmployeeDetail() {
    const employee = employeeById(state.selectedEmployeeId);
    const allEmployees = Mock.employees.filter(person => visibleRegions().some(region => person.regionIds.includes(region.id)));
    if (!employee || !allEmployees.some(person => person.id === employee.id)) return renderNotFound('Không tìm thấy nhân viên trong phạm vi SUP.');
    const stores = visibleStores().filter(store => store.employeeId === employee.id);
    const stats = aggregate(stores);
    const reports = stats.reports;
    const reportByStore = new Map(reports.map(report => [report.storeId, report]));
    return `${appHeader(employee.name, `${employee.id} · ${employee.regionIds.map(id => regionById(id).name).join(', ')}`)}<main class="hv-content"><div class="hv-card"><div class="hv-row"><div><div class="hv-overline">TIẾN ĐỘ NHÂN VIÊN</div><div class="hv-store-title" style="margin-top:4px">${stats.completed}/${stats.target} cửa hàng đã báo cáo</div></div>${statusChip(`${stats.percent}%`)}</div><div style="margin-top:10px">${displayProgress(stats.percent)}</div></div><section class="hv-section">${sectionHeading('Cửa hàng phụ trách', `${stores.length} cửa hàng · ${formatDate(state.filterDate)}`)}<div class="hv-list">${stores.map(store => { const report = reportByStore.get(store.id); return `<article class="hv-store-row"><div class="hv-row"><div><div class="hv-store-title">${escapeHtml(store.code)} · ${escapeHtml(store.name)}</div><div class="hv-store-meta">${escapeHtml(regionById(store.regionId).name)}</div></div>${statusChip(report ? 'Đã báo cáo' : 'Chưa báo cáo', report ? 'done' : 'neutral')}</div>${report ? `<div class="hv-store-foot"><span class="hv-subtle">${report.display.outside + report.display.glass + report.display.coc + report.display.ge + report.display.tree} điểm trưng bày</span><button type="button" class="hv-inline-link" data-hv-act="open-report-detail" data-report-id="${report.id}">Xem số liệu & ảnh ${icon('next', 14)}</button></div><div class="hv-help">${escapeHtml(report.notes || 'Không có ghi chú.')}</div>` : '<div class="hv-store-foot"><span class="hv-subtle">Chưa có số liệu trưng bày</span></div>'}</article>`; }).join('')}</div></section></main>`;
  }

  function renderReportDetail() {
    const report = state.data.reports.find(item => item.id === state.selectedReportId);
    if (!report || !visibleStores().some(store => store.id === report.storeId)) return renderNotFound('Báo cáo không tồn tại trong phạm vi được phân quyền.');
    const store = Mock.stores.find(item => item.id === report.storeId);
    const employee = employeeById(report.employeeId);
    const displayRows = Mock.displayFields.map(field => `<span>${escapeHtml(field.label)}</span><strong>${report.display[field.id]}</strong>`).join('');
    const backAction = state.user.role === 'sup' ? 'back-sup-report' : 'back-mer-report';
    const heading = '<span class="hv-report-header-title"><button type="button" class="hv-report-back" data-hv-act="' + backAction + '" aria-label="Quay lại màn hình trước">' + icon('back', 20) + '</button><span>Chi tiết báo cáo</span></span>';
    return `${appHeader(heading)}<main class="hv-content hv-report-compact"><article class="hv-card">${cardHeading(`${escapeHtml(store.code)} – ${escapeHtml(store.name)}`, 'Báo cáo trưng bày')}<div class="hv-report-values"><span>Khu vực</span><strong>${escapeHtml(regionById(store.regionId).name)}</strong><span>Tên Mer</span><strong>${escapeHtml(employee.name)}</strong><span>Ngày báo cáo</span><strong>${formatDate(report.date)}</strong><span>Thời gian gửi</span><strong>${formatDateTime(report.submittedAt)}</strong>${displayRows}<span>Hàng cận date</span><strong>${escapeHtml(report.stock.expiry || 'Không ghi nhận')}</strong><span>Bao bì Tết hiện có</span><strong>${escapeHtml(report.stock.packaging || 'Không ghi nhận')}</strong><span>Ghi chú tồn kho</span><strong>${escapeHtml(report.stock.notes || '—')}</strong><span>Ghi chú</span><strong>${escapeHtml(report.notes || '—')}</strong></div></article><section class="hv-section hv-card hv-report-photo-card">${sectionHeading('Ảnh báo cáo')}${renderPhotoGallery(report.photoIds, report.photoKinds)}</section></main>`;
  }

  function renderPhotoGallery(photoIds, photoKinds = []) {
    if (!photoIds.length) return '<div class="hv-empty">Báo cáo chưa có ảnh.</div>';
    return `<div class="hv-photos">${photoIds.map((id, index) => {
      const image = state.imageUrls.get(id);
      const kind = photoKinds.find(photo => photo.id === id)?.kind || (index === 0 ? 'front' : 'shelf');
      const caption = kind === 'front' ? 'Mặt tiền + nhân viên' : 'Quầy kệ trưng bày';
      return `<figure class="hv-photo"><button type="button" style="display:block;width:100%;padding:0;border:0;background:transparent" data-hv-act="view-photo" data-photo-id="${escapeHtml(id)}"><img ${image ? `src="${escapeHtml(image)}"` : `data-media-id="${escapeHtml(id)}"`} alt="Ảnh báo cáo ${index + 1}"><figcaption>${caption}</figcaption></button></figure>`;
    }).join('')}</div>`;
  }

  function renderPhotoModal() {
    const url = state.imageUrls.get(state.selectedPhotoId);
    return `<div class="hv-photo-modal" role="dialog" aria-modal="true" aria-label="Ảnh báo cáo"><figure><img ${url ? `src="${escapeHtml(url)}"` : `data-media-id="${escapeHtml(state.selectedPhotoId)}"`} alt="Ảnh báo cáo"><figcaption>Ảnh báo cáo đã lưu trên thiết bị</figcaption><button type="button" class="hv-button secondary" data-hv-act="close-photo">Đóng</button></figure></div>`;
  }

  function renderSupReportPreview() {
    const stats = aggregate(filteredStores());
    const regionName = state.filterRegionId === 'all'
      ? 'Tất cả khu vực được giao'
      : regionById(state.filterRegionId).name;
    const reportText = createSupReportText();
    if (cloudMode) return `<div class="hv-confirm-backdrop"><section class="hv-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="hvReportPreviewTitle"><h2 id="hvReportPreviewTitle">Báo cáo cuối ngày</h2><p>Chế độ xem dữ liệu Supabase. Chưa kết nối gửi báo cáo.</p><pre>${escapeHtml(reportText)}</pre>${button('Đóng', 'close-sup-report-preview', { full: true })}</section></div>`;
    return `<div class="hv-confirm-backdrop" data-hv-act="close-sup-report-preview"><section class="hv-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="hvReportPreviewTitle" aria-describedby="hvReportPreviewDescription"><div class="hv-confirm-heading"><div><div class="hv-overline">KIỂM TRA TRƯỚC KHI GỬI</div><h2 id="hvReportPreviewTitle">Báo cáo cuối ngày</h2><p id="hvReportPreviewDescription">${formatDate(state.filterDate)} · ${escapeHtml(regionName)}</p></div><button type="button" class="hv-icon-button" data-hv-act="close-sup-report-preview" aria-label="Đóng xem trước">${icon('close', 18)}</button></div><div class="hv-preview-stats"><div><span>Mer hoạt động</span><strong>${stats.activeMer}</strong></div><div><span>Đã trưng bày / PLAN</span><strong>${stats.completed}/${stats.target}</strong></div><div><span>Báo cáo nhận / Total PLAN</span><strong>${stats.reportsSent}/${stats.reportTotal}</strong></div><div><span>Hoàn thành</span><strong>${stats.percent}%</strong></div></div><div class="hv-help">Số liệu được tính theo bộ lọc ngày và khu vực trên Dashboard. Kiểm tra nội dung trước khi tiếp tục.</div><details class="hv-preview-details"><summary>Xem nội dung báo cáo</summary><pre>${escapeHtml(reportText)}</pre></details><div class="hv-preview-actions"><button type="button" class="hv-button full" data-hv-act="confirm-sup-system">${icon('send', 17)} Gửi lên hệ thống</button><button type="button" class="hv-button secondary full" data-hv-act="confirm-sup-zalo">${icon('copy', 17)} Copy / chia sẻ Zalo</button></div><div class="hv-subtle hv-preview-disclaimer">Gửi lên hệ thống được mô phỏng và chỉ lưu trên thiết bị. Zalo sẽ mở bảng chia sẻ hoặc sao chép nội dung; chưa gửi tự động.</div></section></div>`;
  }

  function renderAccount() {
    const person = currentPerson();
    const regions = visibleRegions().map(region => region.name).join(' · ');
    const username = state.user.username;
    if (cloudMode) return `${appHeader('Tài khoản')}<main class="hv-content"><article class="hv-card"><h2>${escapeHtml(person.name)}</h2><p>SUP · ${escapeHtml(username)}</p><p>Khu vực: ${escapeHtml(regions)}</p><p>Dữ liệu Supabase · Chế độ xem. Ảnh chưa được kết nối Storage.</p></article>${button('Đăng xuất', 'logout', { full: true })}</main>`;
    return `${appHeader('Tài khoản', 'Đổi tài khoản demo hoặc đặt lại dữ liệu.') }<main class="hv-content"><article class="hv-card"><div class="hv-row"><div class="hv-row" style="justify-content:flex-start"><span class="hv-avatar">${escapeHtml(person.name.split(' ').map(part => part[0]).slice(-2).join(''))}</span><div><div class="hv-store-title">${escapeHtml(person.name)}</div><div class="hv-store-meta">${state.user.role === 'sup' ? 'SUP · Team Sup' : `Mer · ${state.user.employeeId}`}</div></div></div>${statusChip(state.user.role === 'sup' ? 'SUP' : 'MER')}</div><div class="hv-help">Tài khoản: ${escapeHtml(username)}<br>Khu vực được giao: ${escapeHtml(regions)}</div></article><section class="hv-section"><article class="hv-card">${cardHeading('Phiên bản demo')}<div class="hv-subtle">Đăng nhập và phân quyền chỉ mô phỏng frontend. Dữ liệu báo cáo lưu cục bộ; ảnh lưu trong IndexedDB trên thiết bị này.</div><div class="hv-list" style="margin-top:13px"><button type="button" class="hv-demo-account" data-hv-act="switch-account" data-demo-user="mer001"><span>Đăng nhập Mer</span><b>Phạm Hải Đăng</b></button><button type="button" class="hv-demo-account" data-hv-act="switch-account" data-demo-user="sup001"><span>Đăng nhập SUP</span><b>Nguyễn Xuân Toàn</b></button></div></article></section><section class="hv-section"><article class="hv-card">${cardHeading('Dữ liệu trên thiết bị')}<div class="hv-subtle">Đặt lại báo cáo, check-in và ảnh minh họa về dữ liệu ban đầu. Thao tác này xóa dữ liệu demo hiện tại trên thiết bị.</div><div style="margin-top:12px">${button('Đặt lại dữ liệu demo', 'reset-demo', { kind: 'danger', full: true })}</div></article></section><section class="hv-section">${button('Đăng xuất', 'logout', { kind: 'secondary', full: true, icon: 'logout' })}</section></main>`;
  }

  function renderNotFound(message) {
    return `${appHeader('Không tìm thấy', '')}<main class="hv-content"><div class="hv-empty"><strong>Không thể mở nội dung</strong>${escapeHtml(message)}</div></main>`;
  }

  function createMerReportText(store, report) {
    return `${storeNumber(store.id)}. Mã siêu thị: ${store.code}

Tên siêu thị: ${store.name}

Tên Mer: ${employeeById(report.employeeId).name}

${Mock.displayFields.map(field => `${field.label}: ${report.display[field.id]}`).join('\n\n')}

Hàng cận date: ${report.stock.expiry || 'Không ghi nhận'}

Bao bì tết hiện có: ${report.stock.packaging || 'Không ghi nhận'}

Ghi chú:

${report.notes || 'Không có'}`;
  }

  function createSupReportText() {
    const stores = filteredStores();
    const stats = aggregate(stores);
    const regionName = state.filterRegionId === 'all'
      ? visibleRegions().map(region => region.name).join(', ')
      : regionById(state.filterRegionId).name;
    return `Báo cáo cuối ngày

Ngày: ${formatDate(state.filterDate)}

Team Sup: ${currentPerson().name}

Khu vực: ${regionName}

Nhân viên ra thị trường: ${stats.activeMer}

Số Store đã trưng bày / Số Target: ${stats.completed}/${stats.target}

Số báo cáo đã nhận / Total PLAN: ${stats.reportsSent}/${stats.reportTotal}`;
  }

  function prepareDraft(store) {
    if (state.draft && state.selectedStoreId === store.id) return;
    const report = reportForStore(store.id, localDateISO());
    state.draft = {
      editingId: report ? report.id : '',
      display: report ? clone(report.display) : Object.fromEntries(Mock.displayFields.map(field => [field.id, 0])),
      stock: report ? clone(report.stock) : { expiry: '', packaging: '', notes: '' },
      notes: report ? report.notes : '',
      photos: report ? report.photoIds.map((id, index) => ({
        id,
        existing: true,
        kind: report.photoKinds?.find(photo => photo.id === id)?.kind || (index === 0 ? 'front' : 'shelf'),
        fileName: ''
      })) : [],
      removedPhotoIds: []
    };
  }

  function beginReport(storeId) {
    if (state.user.role !== 'mer') {
      showToast('Chỉ tài khoản Mer được tạo báo cáo.', 'error');
      return;
    }
    const store = Mock.stores.find(item => item.id === storeId);
    if (!store || !visibleStores().some(item => item.id === storeId)) {
      showToast('Cửa hàng không nằm trong danh sách được phân công.', 'error');
      return;
    }
    const existingReport = reportForStore(store.id, localDateISO());
    if (existingReport) {
      state.selectedReportId = existingReport.id;
      state.screen = 'report-detail';
      render();
      return;
    }
    if (state.draft && state.selectedStoreId !== store.id) {
      syncDraftFromForm();
      if (!window.confirm('Bỏ bản nháp chưa lưu để chuyển sang cửa hàng khác?')) return;
      state.draft = null;
    }
    state.selectedStoreId = store.id;
    if (!checkInFor(store.id, localDateISO())) {
      state.screen = 'check-in';
      render();
      return;
    }
    prepareDraft(store);
    state.screen = 'report-form';
    render();
  }

  function syncDraftFromForm() {
    const form = root.querySelector('#hvReportForm');
    if (!form || !state.draft) return;
    state.draft.stock.expiry = form.elements.expiry.value.trim();
    state.draft.stock.packaging = form.elements.packaging.value.trim();
    state.draft.stock.notes = form.elements.stockNotes.value.trim();
    state.draft.notes = form.elements.notes.value.trim();
  }

  function validateDraft(store) {
    if (!state.draft) return 'Không tìm thấy nội dung báo cáo.';
    if (reportForStore(store.id, localDateISO())) return 'Cửa hàng đã có báo cáo hôm nay. Không thể tạo báo cáo trùng hoặc ghi đè báo cáo đã lưu.';
    if (!checkInFor(store.id, localDateISO())) return 'Vui lòng check-in cửa hàng trước khi lưu.';
    for (const field of Mock.displayFields) {
      const value = Number(state.draft.display[field.id]);
      if (!Number.isInteger(value) || value < 0) return `${field.label}: nhập số nguyên từ 0 trở lên.`;
    }
    if (!state.draft.photos.some(photo => photo.kind === 'front') ||
        !state.draft.photos.some(photo => photo.kind === 'shelf')) {
      return 'Cần ít nhất 2 ảnh: 1 ảnh mặt tiền có nhân viên và 1 ảnh quầy kệ trưng bày.';
    }
    if (state.draft.stock.expiry.length > 160 || state.draft.stock.packaging.length > 160 ||
        state.draft.stock.notes.length > 500 || state.draft.notes.length > 1000) {
      return 'Một trong các nội dung ghi chú vượt quá độ dài cho phép.';
    }
    return '';
  }

  async function saveReport() {
    if (state.savingReport || state.pendingPhotoFiles) return;
    syncDraftFromForm();
    const store = Mock.stores.find(item => item.id === state.selectedStoreId);
    if (!store || !state.draft || !visibleStores().some(item => item.id === store.id)) {
      showToast('Không tìm thấy cửa hàng được phân công.', 'error');
      return;
    }
    const validationError = validateDraft(store);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }
    state.savingReport = true;
    render();
    try {
      const submittedAt = new Date().toISOString();
      const newPhotos = state.draft.photos.filter(photo => !photo.existing);
      const keptPhotoIds = state.draft.photos.map(photo => photo.id);
      for (const photo of newPhotos) {
        await imageStoreRequest('put', {
          id: photo.id,
          blob: photo.blob,
          kind: photo.kind,
          fileName: photo.fileName,
          watermarkLabel: photo.watermarkLabel,
          capturedAt: photo.capturedAt,
          uploadedAt: photo.uploadedAt,
          sample: false
        });
      }
      const reportId = state.draft.editingId || slugId();
      const report = {
        id: reportId,
        storeId: store.id,
        employeeId: state.user.employeeId,
        regionId: store.regionId,
        date: localDateISO(),
        submittedAt,
        status: 'submitted',
        display: clone(state.draft.display),
        stock: clone(state.draft.stock),
        notes: state.draft.notes,
        photoIds: keptPhotoIds,
        photoKinds: state.draft.photos.map(photo => ({ id: photo.id, kind: photo.kind })),
        sample: false
      };
      const nextData = clone(state.data);
      const currentIndex = nextData.reports.findIndex(item =>
        item.storeId === store.id && item.date === report.date
      );
      if (currentIndex >= 0) {
        report.id = nextData.reports[currentIndex].id;
        nextData.reports[currentIndex] = report;
      } else {
        nextData.reports.push(report);
      }
      persistData(nextData);
      state.data = nextData;
      const usedIds = new Set(nextData.reports.flatMap(item => item.photoIds));
      for (const id of state.draft.removedPhotoIds) {
        if (!usedIds.has(id)) await imageStoreRequest('delete', id);
      }
      state.draft = null;
      state.selectedReportId = report.id;
      state.screen = 'report-detail';
      showToast('Báo cáo đã lưu trên thiết bị.');
    } finally {
      state.savingReport = false;
    }
  }

  async function handlePhotoSelection(input) {
    const kind = input.dataset.photoKind;
    const store = Mock.stores.find(item => item.id === state.selectedStoreId);
    const files = Array.from(input.files || []);
    input.value = '';
    if (!state.draft || !store || !files.length) return;
    state.pendingPhotoFiles += files.length;
    render();
    const added = [];
    try {
      for (const file of files) {
        try {
          const processed = await createWatermarkedImage(file);
          added.push({
            id: slugId(),
            kind,
            blob: processed.blob,
            fileName: file.name,
            watermarkLabel: processed.watermarkLabel,
            capturedAt: processed.capturedAt,
            uploadedAt: processed.uploadedAt,
            existing: false
          });
        } catch (error) {
          showToast(error.message || `Không thể xử lý ảnh ${file.name}.`, 'error');
        }
      }
    } finally {
      state.pendingPhotoFiles = Math.max(0, state.pendingPhotoFiles - files.length);
    }
    if (!added.length) return;
    state.draft.photos.push(...added);
    render();
  }

  async function createWatermarkedImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('Chỉ chấp nhận tệp hình ảnh.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Ảnh quá lớn; vui lòng chọn tệp dưới 15 MB.');
    const capturedAt = await readExifCaptureDate(file);
    const uploadedAt = new Date().toISOString();
    const watermarkedAt = capturedAt || new Date(uploadedAt);
    const watermarkLabel = capturedAt
      ? `Ngày chụp ${formatDate(localDateISO(capturedAt))} · ${watermarkedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
      : `Tải ảnh ${formatDate(localDateISO(new Date(uploadedAt)))} ${watermarkedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · giờ tải ảnh`;
    const bitmap = await decodeImage(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không thể tạo Canvas để đóng watermark lên ảnh.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (typeof bitmap.close === 'function') bitmap.close();
    const fontSize = Math.max(13, Math.round(canvas.width * 0.024));
    const bandHeight = Math.max(42, Math.round(fontSize * 2.45));
    context.fillStyle = 'rgba(0, 30, 12, 0.74)';
    context.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);
    context.fillStyle = '#ffffff';
    context.font = `700 ${fontSize}px Arial, sans-serif`;
    context.textBaseline = 'middle';
    context.fillText('HVN MER', Math.round(fontSize * 0.8), canvas.height - bandHeight * 0.67);
    context.font = `500 ${Math.max(11, Math.round(fontSize * 0.68))}px Arial, sans-serif`;
    context.fillText(watermarkLabel, Math.round(fontSize * 0.8), canvas.height - bandHeight * 0.28);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Không thể xuất ảnh đã đóng watermark.')), 'image/jpeg', 0.86);
    });
    return { blob, capturedAt: capturedAt ? capturedAt.toISOString() : '', uploadedAt, watermarkLabel };
  }

  async function decodeImage(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(file);
      } catch (error) {
        if (error.name !== 'NotSupportedError' && error.name !== 'EncodingError') throw error;
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } catch {
      throw new Error('Không đọc được ảnh này trên trình duyệt. Hãy thử JPG hoặc PNG.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function readExifCaptureDate(file) {
    if (!/jpe?g/i.test(file.type)) return null;
    const bytes = new DataView(await file.arrayBuffer());
    const length = bytes.byteLength;
    if (length < 4 || bytes.getUint16(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 < length) {
      if (bytes.getUint8(offset) !== 0xff) break;
      const marker = bytes.getUint8(offset + 1);
      const size = bytes.getUint16(offset + 2);
      if (size < 2 || offset + size + 2 > length) break;
      if (marker === 0xe1 && size > 10 &&
          bytes.getUint8(offset + 4) === 0x45 &&
          bytes.getUint8(offset + 5) === 0x78 &&
          bytes.getUint8(offset + 6) === 0x69 &&
          bytes.getUint8(offset + 7) === 0x66) {
        const tiff = offset + 10;
        const segmentEnd = offset + size + 2;
        if (tiff + 8 > segmentEnd) {
          offset += size + 2;
          continue;
        }
        const byteOrder = bytes.getUint16(tiff);
        if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) {
          offset += size + 2;
          continue;
        }
        const little = byteOrder === 0x4949;
        const read16 = position => bytes.getUint16(position, little);
        const read32 = position => bytes.getUint32(position, little);
        const firstIfd = tiff + read32(tiff + 4);
        if (firstIfd + 2 > segmentEnd) {
          offset += size + 2;
          continue;
        }
        const ifdCount = read16(firstIfd);
        let exifOffset = 0;
        for (let index = 0; index < ifdCount; index += 1) {
          const entry = firstIfd + 2 + index * 12;
          if (entry + 12 > segmentEnd) break;
          if (read16(entry) === 0x8769) exifOffset = tiff + read32(entry + 8);
        }
        if (exifOffset && exifOffset + 2 <= segmentEnd) {
          const entries = read16(exifOffset);
          for (let index = 0; index < entries; index += 1) {
            const entry = exifOffset + 2 + index * 12;
            if (entry + 12 > segmentEnd) break;
            if (read16(entry) !== 0x9003) continue;
            const count = read32(entry + 4);
            const valueOffset = tiff + read32(entry + 8);
            if (!count || valueOffset + count > segmentEnd) break;
            let value = '';
            for (let character = 0; character < count; character += 1) {
              const code = bytes.getUint8(valueOffset + character);
              if (!code) break;
              value += String.fromCharCode(code);
            }
            const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
            if (!match) return null;
            const [, year, month, day, hour, minute, second] = match;
            const date = new Date(+year, +month - 1, +day, +hour, +minute, +second);
            if (date.getFullYear() !== +year || date.getMonth() !== +month - 1 ||
                date.getDate() !== +day || date.getHours() !== +hour ||
                date.getMinutes() !== +minute || date.getSeconds() !== +second) return null;
            return date;
          }
        }
      }
      if (marker === 0xda || marker === 0xd9) break;
      offset += size + 2;
    }
    return null;
  }

  function navigate(screen) {
    if (state.user.role === 'sup' && screen === 'reports') screen = 'employees';
    if (state.user.role === 'sup' && screen === 'regions') screen = 'dashboard';
    const allowed = state.user.role === 'sup'
      ? ['dashboard', 'employees', 'reports', 'account']
      : ['dashboard', 'report-list', 'history', 'account'];
    if (!allowed.includes(screen)) {
      showToast('Màn hình này không nằm trong vai trò hiện tại.', 'error');
      return;
    }
    if (state.screen === 'report-form' && state.draft) {
      syncDraftFromForm();
      if (!window.confirm('Rời biểu mẫu báo cáo? Bản nháp chưa lưu sẽ được giữ lại để bạn tiếp tục sau.')) return;
    }
    state.screen = screen;
    state.search = '';
    state.selectedPhotoId = '';
    render();
  }

  function applyRemoteSnapshot(snapshot) {
    for (const key of ['regions', 'employees', 'supervisors', 'stores']) Mock[key] = snapshot[key];
    state.data = snapshot.data;
    state.user = snapshot.user;
    state.selectedPhotoId = '';
    state.reportPreviewOpen = false;
  }

  async function authenticate(username, password) {
    if (cloudMode) {
      if (loginPending) return;
      loginPending = true;
      state.loginError = '';
      render();
      try {
        applyRemoteSnapshot(await remote.login(username, password));
        state.filterRegionId = 'all';
        state.filterDate = localDateISO();
        state.search = '';
        state.teamStatus = 'all';
        state.expandedEmployeeId = '';
        state.screen = 'dashboard';
      } catch (error) {
        state.user = null;
        state.loginError = error.message || 'Không thể đăng nhập Supabase.';
      } finally {
        loginPending = false;
        render();
      }
      return;
    }
    const account = Mock.accounts.find(item => item.username === username.trim() && item.password === password);
    if (!account) {
      state.loginError = 'Mã nhân viên hoặc mật khẩu chưa đúng.';
      render();
      return;
    }
    state.user = { username: account.username, role: account.role, employeeId: account.employeeId };
    state.loginError = '';
    state.filterDate = localDateISO();
    state.merMonth = localDateISO().slice(0, 7);
    state.filterRegionId = 'all';
    state.screen = 'dashboard';
    render();
  }

  function switchDemoAccount(username) {
    const account = Mock.accounts.find(item => item.username === username);
    if (!account) {
      showToast('Không tìm thấy tài khoản demo.', 'error');
      return;
    }
    state.user = { username: account.username, role: account.role, employeeId: account.employeeId };
    state.filterRegionId = 'all';
    state.filterDate = localDateISO();
    state.merMonth = localDateISO().slice(0, 7);
    state.screen = 'dashboard';
    state.draft = null;
    state.selectedPhotoId = '';
    state.search = '';
    render();
  }

  async function copyToClipboard(text, successMessage) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showToast(successMessage);
        return true;
      }
    } catch {
      // Some WebViews deny Clipboard API access; use the browser's copy fallback below.
    }
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '0';
    field.style.left = '-9999px';
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } finally {
      field.remove();
    }
    showToast(copied ? successMessage : 'Không thể sao chép. Hãy kiểm tra quyền Clipboard của WebView.', copied ? 'success' : 'error');
    return copied;
  }

  function recordSummaryDelivery(channel, deliveryStatus) {
    if (state.user.role !== 'sup') throw new Error('Chỉ tài khoản SUP được gửi báo cáo tổng hợp.');
    const delivery = {
      id: slugId(),
      date: state.filterDate,
      regionId: state.filterRegionId,
      channel,
      status: deliveryStatus,
      sentAt: new Date().toISOString(),
      senderId: state.user.employeeId
    };
    const nextData = clone(state.data);
    nextData.deliveries.push(delivery);
    persistData(nextData);
    state.data = nextData;
    render();
    return delivery;
  }

  function sendSupReportToSystem() {
    if (state.user.role !== 'sup') {
      showToast('Chỉ tài khoản SUP được gửi báo cáo tổng hợp.', 'error');
      return;
    }
    state.reportPreviewOpen = false;
    recordSummaryDelivery('system', 'demo-sent');
    showToast('Đã ghi nhận gửi demo. Chưa kết nối hệ thống thật.');
  }

  async function sendSupReportToZalo() {
    if (state.user.role !== 'sup') {
      showToast('Chỉ tài khoản SUP được chia sẻ báo cáo tổng hợp.', 'error');
      return;
    }
    state.reportPreviewOpen = false;
    const text = createSupReportText();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Báo cáo cuối ngày HVN Mer', text });
        recordSummaryDelivery('zalo', 'shared');
        showToast('Đã mở chia sẻ qua thiết bị. Chọn Zalo để gửi báo cáo.');
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
        showToast('Không mở được bảng chia sẻ. Đang thử sao chép nội dung.', 'error');
      }
    }
    const copied = await copyToClipboard(text, 'Đã copy nội dung. Hãy dán vào nhóm Zalo để gửi.');
    if (copied) recordSummaryDelivery('zalo', 'copied');
  }

  async function copySelectedMerReport() {
    const report = state.data.reports.find(item => item.id === state.selectedReportId);
    const store = report && Mock.stores.find(item => item.id === report.storeId);
    if (!report || !store || !visibleStores().some(item => item.id === store.id)) {
      showToast('Không tìm thấy báo cáo trong phạm vi được phân quyền.', 'error');
      return;
    }
    await copyToClipboard(createMerReportText(store, report), 'Đã copy nội dung báo cáo gửi Zalo.');
  }

  async function removeReportPhoto(photoId) {
    const report = state.data.reports.find(item => item.id === photoId);
    if (report) {
      if (state.user.role !== 'sup' || !visibleStores().some(store => store.id === report.storeId)) {
        showToast('Không có quyền xóa ảnh báo cáo.', 'error');
        return;
      }
      showToast('Ảnh báo cáo đã lưu không thể xóa trong chế độ xem.', 'error');
      return;
    }
    const photo = state.draft && state.draft.photos.find(item => item.id === photoId);
    if (!photo) return;
    state.draft.photos = state.draft.photos.filter(item => item.id !== photoId);
    if (photo.existing) state.draft.removedPhotoIds.push(photo.id);
    render();
  }

  async function resetDemoData() {
    if (!window.confirm('Đặt lại toàn bộ báo cáo và ảnh demo trên thiết bị này?')) return;
    const replacement = seedData();
    persistData(replacement);
    state.data = replacement;
    await imageStoreRequest('clear');
    for (const url of state.imageUrls.values()) {
      if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    state.imageUrls.clear();
    await ensureSampleImages();
    state.filterDate = localDateISO();
    state.filterRegionId = 'all';
    state.draft = null;
    state.screen = state.user ? 'dashboard' : 'login';
    render();
    showToast('Đã đặt lại dữ liệu demo.');
  }

  async function repairDemoData() {
    if (!window.confirm('Xóa dữ liệu demo hiện tại trên thiết bị và tạo lại dữ liệu ban đầu?')) return;
    if (!database) database = await openDatabase();
    await imageStoreRequest('clear');
    localStorage.removeItem(DATA_KEY);
    state.data = seedData();
    persistData();
    await ensureSampleImages();
    state.user = null;
    state.screen = 'login';
    state.storageError = '';
    render();
    showToast('Đã tạo lại dữ liệu demo.');
  }

  function showSignIn() {
    state.user = null;
    state.draft = null;
    state.selectedPhotoId = '';
    state.reportPreviewOpen = false;
    state.screen = 'login';
    render();
  }

  async function handleClick(event) {
    const reportBackdrop = event.target.closest('.hv-confirm-backdrop');
    if (reportBackdrop && event.target === reportBackdrop) {
      state.reportPreviewOpen = false;
      render();
      return;
    }
    const buttonElement = event.target.closest('button');
    if (!buttonElement || !root.contains(buttonElement)) return;
    event.stopPropagation();
    const action = buttonElement.dataset.hvAct;
    if (cloudMode && ['fill-login', 'switch-account', 'reset-demo', 'reset-storage', 'confirm-sup-system', 'confirm-sup-zalo'].includes(action)) {
      showToast('Chế độ Supabase hiện chỉ hỗ trợ xem dữ liệu; chưa kết nối gửi báo cáo.', 'error');
      return;
    }
    if (state.pendingPhotoFiles || state.savingReport) {
      showToast(state.savingReport ? 'Đang lưu báo cáo. Vui lòng đợi.' : 'Đang xử lý ảnh. Vui lòng đợi hoàn tất.', 'error');
      return;
    }
    if (buttonElement.dataset.hvRoute) {
      navigate(buttonElement.dataset.hvRoute);
      return;
    }
    switch (action) {
      case 'refresh-supabase':
        if (!cloudMode || !state.user || refreshPending) return;
        refreshPending = true;
        render();
        try {
          const snapshot = await remote.load();
          if (!state.user) return;
          applyRemoteSnapshot(snapshot);
          if (!visibleRegions().some(region => region.id === state.filterRegionId)) state.filterRegionId = 'all';
          showToast('Đã cập nhật dữ liệu từ Supabase.');
        } finally {
          refreshPending = false;
          render();
        }
        break;
      case 'login': {
        const form = root.querySelector('#hvLoginForm');
        authenticate(form.elements.username.value, form.elements.password.value);
        break;
      }
      case 'fill-login': {
        const account = Mock.accounts.find(item => item.username === buttonElement.dataset.demoUser);
        if (!account) return;
        root.querySelector('#hvUsername').value = account.username;
        root.querySelector('#hvPassword').value = account.password;
        root.querySelector('#hvPassword').focus();
        break;
      }
      case 'switch-account':
        switchDemoAccount(buttonElement.dataset.demoUser);
        break;
      case 'account':
        navigate('account');
        break;
      case 'go-reports':
        navigate('reports');
        break;
      case 'go-report-list':
      case 'choose-report-store':
        navigate('report-list');
        break;
      case 'mer-store-status':
        if (state.user.role !== 'mer' || !['all', 'pending', 'done'].includes(buttonElement.dataset.status)) break;
        state.merStoreStatus = buttonElement.dataset.status;
        render();
        break;
      case 'team-toggle':
        state.expandedEmployeeId = state.expandedEmployeeId === buttonElement.dataset.employeeId ? '' : buttonElement.dataset.employeeId;
        state.teamShowAll = false;
        render();
        break;
      case 'team-more':
        state.expandedEmployeeId = buttonElement.dataset.employeeId;
        state.teamShowAll = true;
        render();
        break;
      case 'team-status':
        state.teamStatus = buttonElement.dataset.status;
        render();
        break;
      case 'back-sup-report':
        if (state.user.role !== 'sup') break;
        state.screen = ['employees', 'reports', 'employee-detail', 'dashboard'].includes(state.reportDetailReturnScreen) ? state.reportDetailReturnScreen : 'employees';
        render();
        break;
      case 'back-team':
        state.screen = 'employees';
        render();
        break;
      case 'open-completed-stores': {
        const regionId = buttonElement.dataset.regionId;
        if (state.user.role !== 'sup' || !visibleRegions().some(region => region.id === regionId)) break;
        state.filterRegionId = regionId;
        state.teamStatus = 'stores-done';
        state.search = '';
        state.expandedEmployeeId = '';
        state.teamShowAll = false;
        state.screen = 'employees';
        render();
        break;
      }
      case 'select-region': {
        const regionId = buttonElement.dataset.regionId;
        if (!visibleRegions().some(region => region.id === regionId)) {
          showToast('Khu vực này không nằm trong phạm vi SUP.', 'error');
          break;
        }
        state.filterRegionId = regionId;
        state.screen = 'dashboard';
        render();
        break;
      }
      case 'mer-date-prev':
      case 'mer-date-next': {
        if (state.user.role !== 'mer' || state.screen !== 'dashboard') break;
        const nextDate = shiftDate(state.filterDate, action === 'mer-date-prev' ? -1 : 1);
        if (nextDate > localDateISO()) {
          showToast('Không thể xem ngày trong tương lai.', 'error');
          break;
        }
        state.filterDate = nextDate;
        render();
        break;
      }
      case 'mer-date-today':
        if (state.user.role !== 'mer' || state.screen !== 'dashboard') break;
        state.filterDate = localDateISO();
        render();
        break;
      case 'mer-month-prev':
      case 'mer-month-next': {
        if (state.user.role !== 'mer' || state.screen !== 'dashboard') break;
        const nextMonth = shiftMonth(state.merMonth, action === 'mer-month-prev' ? -1 : 1);
        if (nextMonth > localDateISO().slice(0, 7)) {
          showToast('Không thể xem tháng trong tương lai.', 'error');
          break;
        }
        state.merMonth = nextMonth;
        render();
        break;
      }
      case 'back-mer-report':
        if (state.user.role !== 'mer') break;
        state.screen = ['dashboard', 'history', 'report-list'].includes(state.reportDetailReturnScreen) ? state.reportDetailReturnScreen : 'dashboard';
        render();
        break;
      case 'back-mer-dashboard':
        if (state.user.role !== 'mer') break;
        state.screen = 'dashboard';
        render();
        break;
      case 'open-employee':
        state.selectedEmployeeId = buttonElement.dataset.employeeId;
        state.screen = 'employee-detail';
        render();
        break;
      case 'start-report':
        beginReport(buttonElement.dataset.storeId);
        break;
      case 'open-store-report': {
        const store = Mock.stores.find(item => item.id === buttonElement.dataset.storeId);
        const report = store && reportForStore(store.id);
        if (!report) {
          showToast('Chưa có báo cáo cho cửa hàng này trong ngày đã chọn.', 'error');
          break;
        }
        state.reportDetailReturnScreen = buttonElement.dataset.returnScreen || state.screen;
        state.selectedReportId = report.id;
        state.screen = 'report-detail';
        render();
        break;
      }
      case 'confirm-check-in': {
        const store = Mock.stores.find(item => item.id === state.selectedStoreId);
        if (!store || state.user.role !== 'mer' || store.employeeId !== state.user.employeeId) {
          showToast('Không thể check-in: cửa hàng không được phân công cho tài khoản này.', 'error');
          break;
        }
        const checkIn = {
          key: checkInKey(store.id, localDateISO()),
          storeId: store.id,
          employeeId: state.user.employeeId,
          date: localDateISO(),
          timestamp: new Date().toISOString(),
          mockLocation: true
        };
        const nextData = clone(state.data);
        nextData.checkIns = nextData.checkIns.filter(item => item.key !== checkIn.key);
        nextData.checkIns.push(checkIn);
        persistData(nextData);
        state.data = nextData;
        prepareDraft(store);
        state.screen = 'report-form';
        render();
        showToast('Check-in demo đã ghi nhận trên thiết bị.');
        break;
      }
      case 'continue-report': {
        const store = Mock.stores.find(item => item.id === state.selectedStoreId);
        if (!store || !checkInFor(store.id, localDateISO())) {
          showToast('Vui lòng xác nhận check-in trước khi báo cáo.', 'error');
          break;
        }
        prepareDraft(store);
        state.screen = 'report-form';
        render();
        break;
      }
      case 'stepper': {
        const field = buttonElement.dataset.field;
        if (!state.draft || !Mock.displayFields.some(item => item.id === field)) break;
        const delta = Number(buttonElement.dataset.change);
        state.draft.display[field] = Math.max(0, state.draft.display[field] + delta);
        render();
        break;
      }
      case 'remove-photo':
        await removeReportPhoto(buttonElement.dataset.photoId);
        break;
      case 'cancel-report':
        if (!window.confirm('Hủy báo cáo chưa lưu? Nội dung đang nhập sẽ bị xóa.')) break;
        state.draft = null;
        state.screen = 'dashboard';
        render();
        break;
      case 'save-report':
        await saveReport();
        break;
      case 'open-report-detail': {
        const report = state.data.reports.find(item => item.id === buttonElement.dataset.reportId);
        if (!report || !visibleStores().some(store => store.id === report.storeId)) {
          showToast('Báo cáo không tồn tại trong phạm vi được phân quyền.', 'error');
          break;
        }
        state.reportDetailReturnScreen = state.screen;
        state.selectedReportId = report.id;
        state.screen = 'report-detail';
        render();
        break;
      }
      case 'copy-mer-report':
        await copySelectedMerReport();
        break;
      case 'send-sup-system':
      case 'send-sup-zalo':
      case 'open-sup-report-preview':
        if (state.user.role !== 'sup') {
          showToast('Chỉ tài khoản SUP được xem và gửi báo cáo tổng hợp.', 'error');
          break;
        }
        state.reportPreviewOpen = true;
        render();
        break;
      case 'close-sup-report-preview':
        state.reportPreviewOpen = false;
        render();
        break;
      case 'confirm-sup-system':
        sendSupReportToSystem();
        break;
      case 'confirm-sup-zalo':
        await sendSupReportToZalo();
        break;
      case 'view-photo':
        state.selectedPhotoId = buttonElement.dataset.photoId;
        render();
        break;
      case 'close-photo':
        state.selectedPhotoId = '';
        render();
        break;
      case 'reset-demo':
        await resetDemoData();
        break;
      case 'retry-storage':
        boot();
        break;
      case 'reset-storage':
        await repairDemoData();
        break;
      case 'logout':
        showSignIn();
        if (cloudMode) {
          state.data = null;
          for (const key of ['regions', 'employees', 'supervisors', 'stores']) Mock[key] = [];
          await remote.logout();
        }
        break;
      default:
        break;
    }
  }

  function handleChange(event) {
    event.stopPropagation();
    const target = event.target;
    if (target.matches('[data-photo-kind]')) {
      handlePhotoSelection(target).catch(error => showToast(error.message || 'Không thể thêm ảnh.', 'error'));
      return;
    }
    if (target.id === 'hvDateFilter') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(target.value)) {
        showToast('Ngày báo cáo không hợp lệ.', 'error');
        return;
      }
      state.filterDate = target.value;
      render();
    } else if (target.id === 'hvMerDatePicker') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(target.value) || target.value > localDateISO()) {
        showToast('Chỉ có thể chọn ngày hợp lệ đến hôm nay.', 'error');
        return;
      }
      state.filterDate = target.value;
      render();
    } else if (target.id === 'hvMerMonthPicker') {
      if (!/^\d{4}-\d{2}$/.test(target.value) || target.value > localDateISO().slice(0, 7)) {
        showToast('Chỉ có thể chọn tháng hợp lệ đến tháng hiện tại.', 'error');
        return;
      }
      state.merMonth = target.value;
      render();
    } else if (target.id === 'hvRegionFilter') {
      const selected = target.value;
      if (selected !== 'all' && !visibleRegions().some(region => region.id === selected)) {
        showToast('Không thể xem khu vực ngoài phạm vi được giao.', 'error');
        return;
      }
      state.filterRegionId = selected;
      render();
    }
  }

  function handleInput(event) {
    event.stopPropagation();
    if (state.screen === 'report-form' && root.querySelector('#hvReportForm')?.contains(event.target)) {
      syncDraftFromForm();
    }
    if (event.target.id !== 'hvSearch') return;
    state.search = event.target.value;
    const selectionStart = event.target.selectionStart;
    const selectionEnd = event.target.selectionEnd;
    render();
    const input = root.querySelector('#hvSearch');
    if (input) {
      input.focus();
      input.setSelectionRange(selectionStart, selectionEnd);
    }
  }

  function handleSubmit(event) {
    if (event.target.id !== 'hvLoginForm') return;
    event.preventDefault();
    event.stopPropagation();
    const form = event.target;
    authenticate(form.elements.username.value, form.elements.password.value);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && (state.selectedPhotoId || state.reportPreviewOpen)) {
      state.selectedPhotoId = '';
      state.reportPreviewOpen = false;
      render();
    }
  }

  function hydrateVisibleImages() {
    for (const image of root.querySelectorAll('img[data-media-id]')) {
      const id = image.dataset.mediaId;
      if (state.imageUrls.has(id)) {
        image.src = state.imageUrls.get(id);
        continue;
      }
      if (state.imageTasks.has(id)) continue;
      const task = imageStoreRequest('get', id).then(record => {
        if (!record || !record.blob) throw new Error('Không tìm thấy ảnh trong kho trên thiết bị.');
        const url = URL.createObjectURL(record.blob);
        state.imageUrls.set(id, url);
        for (const target of root.querySelectorAll('img[data-media-id]')) {
          if (target.dataset.mediaId === id) target.src = url;
        }
      }).catch(error => {
        showToast(error.message || 'Không thể tải ảnh báo cáo.', 'error');
      }).finally(() => state.imageTasks.delete(id));
      state.imageTasks.set(id, task);
    }
  }

  async function boot() {
    state.screen = 'loading';
    state.storageError = '';
    render();
    if (cloudMode) {
      try {
        remote.validateConfig();
        state.user = null;
        state.screen = 'login';
      } catch (error) {
        state.screen = 'storage-error';
        state.storageError = error.message;
      }
      render();
      return;
    }
    try {
      database = await openDatabase();
      state.data = localDataOrSeed();
      if (localStorage.getItem(DATA_KEY) === null) persistData(state.data);
      await ensureSampleImages();
      state.user = null;
      state.screen = 'login';
    } catch (error) {
      state.user = null;
      state.screen = 'storage-error';
      state.storageError = error.message || 'Không thể đọc dữ liệu trên thiết bị.';
    }
    render();
  }

  root.addEventListener('click', event => {
    handleClick(event).catch(error => showToast(error.message || 'Không thể hoàn tất thao tác.', 'error'));
  });
  root.addEventListener('change', handleChange);
  root.addEventListener('input', handleInput);
  root.addEventListener('submit', handleSubmit);
  document.addEventListener('keydown', handleKeydown);

  render();
  await boot();
})(window);
