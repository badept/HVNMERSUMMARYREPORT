((global) => {
  const regions = [
    { id: 'hn', name: 'Hà Nội', shortName: 'Hà Nội' },
    { id: 'ct', name: 'Cần Thơ', shortName: 'Cần Thơ' }
  ];

  const accounts = [
    {
      username: 'mer001',
      password: '123456',
      role: 'mer',
      employeeId: 'MER-001'
    },
    {
      username: 'sup001',
      password: '123456',
      role: 'sup',
      employeeId: 'SUP-001'
    }
  ];

  const employees = [
    {
      id: 'MER-001',
      name: 'Phạm Hải Đăng',
      role: 'mer',
      regionIds: ['hn'],
      username: 'mer001'
    },
    {
      id: 'MER-002',
      name: 'Nguyễn Văn A',
      role: 'mer',
      regionIds: ['hn'],
      username: 'nv-a'
    },
    {
      id: 'MER-003',
      name: 'Trần Văn B',
      role: 'mer',
      regionIds: ['ct'],
      username: 'tv-b'
    }
  ];

  const supervisors = [
    {
      id: 'SUP-001',
      name: 'Nguyễn Xuân Toàn',
      title: 'Team Sup',
      regionIds: ['hn', 'ct']
    }
  ];

  const stores = [
    { id: 'HN-001', code: 'HN-001', name: 'WinMart Times City', regionId: 'hn', employeeId: 'MER-001', target: 1, address: '458 Minh Khai, Hai Bà Trưng' },
    { id: 'HN-002', code: 'HN-002', name: 'WinMart+ Cầu Giấy', regionId: 'hn', employeeId: 'MER-001', target: 1, address: '17 Duy Tân, Cầu Giấy' },
    { id: 'HN-003', code: 'HN-003', name: 'BRG Mart Hoàng Quốc Việt', regionId: 'hn', employeeId: 'MER-001', target: 1, address: '106 Hoàng Quốc Việt, Cầu Giấy' },
    { id: 'HN-004', code: 'HN-004', name: 'WinMart Royal City', regionId: 'hn', employeeId: 'MER-001', target: 1, address: '72A Nguyễn Trãi, Thanh Xuân' },
    { id: 'HN-005', code: 'HN-005', name: 'WinMart+ Long Biên', regionId: 'hn', employeeId: 'MER-002', target: 1, address: 'Sài Đồng, Long Biên' },
    { id: 'CT-001', code: 'CT-001', name: 'WinMart Cần Thơ', regionId: 'ct', employeeId: 'MER-003', target: 1, address: '84 Mậu Thân, Ninh Kiều' },
    { id: 'CT-002', code: 'CT-002', name: 'Co.opmart Cần Thơ', regionId: 'ct', employeeId: 'MER-003', target: 1, address: '1 Hòa Bình, Ninh Kiều' },
    { id: 'CT-003', code: 'CT-003', name: 'WinMart+ Ninh Kiều', regionId: 'ct', employeeId: 'MER-003', target: 1, address: '28 Nguyễn Trãi, Ninh Kiều' },
    { id: 'CT-004', code: 'CT-004', name: 'Lotte Mart Cần Thơ', regionId: 'ct', employeeId: 'MER-003', target: 1, address: '84 Mậu Thân, Ninh Kiều' },
    { id: 'CT-005', code: 'CT-005', name: 'WinMart+ Cái Răng', regionId: 'ct', employeeId: 'MER-003', target: 1, address: 'Quốc lộ 1A, Cái Răng' }
  ];

  function createReport(id, storeId, employeeId, regionId, time, values) {
    return {
      id,
      storeId,
      employeeId,
      regionId,
      date: '',
      submittedAt: '',
      sampleTime: time,
      status: 'submitted',
      display: values.display,
      stock: values.stock,
      notes: values.notes,
      photoIds: [`${id}-front`, `${id}-shelf`],
      sample: true
    };
  }

  const sampleReports = [
    createReport('SAMPLE-HN-001', 'HN-001', 'MER-001', 'hn', '08:35', {
      display: { outside: 1, glass: 1, coc: 1, ge: 0, tree: 1 },
      stock: { expiry: 'Không có hàng cận date.', packaging: 'Tiger 330ml', notes: 'Đã bổ sung sản phẩm ở khu vực tủ mát.' },
      notes: 'Trưng bày gọn, đủ nhận diện thương hiệu.'
    }),
    createReport('SAMPLE-HN-002', 'HN-002', 'MER-001', 'hn', '10:10', {
      display: { outside: 1, glass: 0, coc: 1, ge: 1, tree: 0 },
      stock: { expiry: '2 lon, hạn dùng 12/12/2026.', packaging: 'Tiger lon 330ml', notes: 'Đã báo quản lý cửa hàng xử lý hàng cận date.' },
      notes: 'Đầu kệ đã được sắp xếp lại.'
    }),
    createReport('SAMPLE-HN-005', 'HN-005', 'MER-002', 'hn', '11:25', {
      display: { outside: 1, glass: 1, coc: 0, ge: 1, tree: 0 },
      stock: { expiry: 'Không ghi nhận.', packaging: 'Tiger và Heineken lon 330ml', notes: '' },
      notes: 'Hoàn thành kiểm tra và cập nhật ảnh.'
    }),
    createReport('SAMPLE-CT-001', 'CT-001', 'MER-003', 'ct', '08:50', {
      display: { outside: 1, glass: 1, coc: 0, ge: 1, tree: 0 },
      stock: { expiry: '1 thùng, hạn dùng 20/12/2026.', packaging: 'Tiger lon 330ml', notes: 'Ưu tiên xuất lô gần hạn.' },
      notes: 'Đã bổ sung trưng bày ngoài kệ.'
    }),
    createReport('SAMPLE-CT-002', 'CT-002', 'MER-003', 'ct', '10:40', {
      display: { outside: 1, glass: 0, coc: 1, ge: 0, tree: 1 },
      stock: { expiry: 'Không có.', packaging: 'Heineken lon 330ml', notes: '' },
      notes: 'Quầy kệ sạch, dễ quan sát.'
    }),
    createReport('SAMPLE-CT-003', 'CT-003', 'MER-003', 'ct', '13:20', {
      display: { outside: 1, glass: 1, coc: 1, ge: 0, tree: 0 },
      stock: { expiry: 'Không ghi nhận.', packaging: 'Tiger lon 330ml', notes: '' },
      notes: 'Đã kiểm tra kho và quầy thu ngân.'
    })
  ];

  const historicalReports = [
    {
      id: 'DEMO-HISTORY-YESTERDAY-HN001',
      dayOffset: -1,
      storeId: 'HN-001',
      employeeId: 'MER-001',
      regionId: 'hn',
      time: '09:05',
      display: { outside: 1, glass: 1, coc: 0, ge: 1, tree: 0 },
      stock: { expiry: 'Không ghi nhận.', packaging: 'Tiger lon 330ml', notes: '' },
      notes: 'Đã bổ sung đầu kệ.'
    },
    {
      id: 'DEMO-HISTORY-YESTERDAY-HN003',
      dayOffset: -1,
      storeId: 'HN-003',
      employeeId: 'MER-001',
      regionId: 'hn',
      time: '11:20',
      display: { outside: 1, glass: 0, coc: 1, ge: 0, tree: 1 },
      stock: { expiry: '1 thùng, hạn dùng 18/12/2026.', packaging: 'Heineken lon 330ml', notes: 'Đã báo cửa hàng ưu tiên xuất lô gần hạn.' },
      notes: 'Hoàn tất trưng bày khu rau thịt.'
    },
    {
      id: 'DEMO-HISTORY-FULL-HN001',
      dayOffset: -2,
      storeId: 'HN-001',
      employeeId: 'MER-001',
      regionId: 'hn',
      time: '08:40',
      display: { outside: 1, glass: 1, coc: 1, ge: 1, tree: 1 },
      stock: { expiry: 'Không có hàng cận date.', packaging: 'Tiger lon 330ml', notes: '' },
      notes: 'Đủ các vị trí trưng bày theo yêu cầu.'
    },
    {
      id: 'DEMO-HISTORY-FULL-HN002',
      dayOffset: -2,
      storeId: 'HN-002',
      employeeId: 'MER-001',
      regionId: 'hn',
      time: '10:15',
      display: { outside: 1, glass: 1, coc: 0, ge: 1, tree: 0 },
      stock: { expiry: 'Không ghi nhận.', packaging: 'Tiger lon 330ml', notes: '' },
      notes: 'Kệ hàng gọn và đủ nhãn giá.'
    },
    {
      id: 'DEMO-HISTORY-FULL-HN003',
      dayOffset: -2,
      storeId: 'HN-003',
      employeeId: 'MER-001',
      regionId: 'hn',
      time: '12:00',
      display: { outside: 1, glass: 0, coc: 1, ge: 1, tree: 0 },
      stock: { expiry: 'Không ghi nhận.', packaging: 'Heineken lon 330ml', notes: '' },
      notes: 'Đã kiểm tra quầy thu ngân.'
    },
    {
      id: 'DEMO-HISTORY-FULL-HN004',
      dayOffset: -2,
      storeId: 'HN-004',
      employeeId: 'MER-001',
      regionId: 'hn',
      time: '14:25',
      display: { outside: 1, glass: 1, coc: 1, ge: 0, tree: 1 },
      stock: { expiry: 'Không có.', packaging: 'Tiger lon 330ml', notes: '' },
      notes: 'Hoàn thành kiểm tra các vị trí được giao.'
    },
    {
      id: 'DEMO-HISTORY-WEEK-HN002',
      dayOffset: -7,
      storeId: 'HN-002',
      employeeId: 'MER-001',
      regionId: 'hn',
      time: '09:30',
      display: { outside: 1, glass: 1, coc: 0, ge: 0, tree: 0 },
      stock: { expiry: '2 lon, hạn dùng 20/12/2026.', packaging: 'Tiger lon 330ml', notes: '' },
      notes: 'Theo dõi hàng cận date ở lần ghé tiếp theo.'
    }
  ];

  // Stable demo teams with varied workloads and completion.
  const teams = [
    ['hn', 'HN', ['Đỗ Minh Anh','Lê Quốc Huy','Vũ Thu Hà','Nguyễn Đức Long','Hoàng Ngọc Mai','Bùi Tuấn Kiệt','Phan Thanh Tâm','Đặng Hải Yến','Trịnh Minh Quân','Đinh Thảo Vy'], [5,4,3,2,5,1,3,0,4,0]],
    ['ct', 'CT', ['Lê Minh Khang','Nguyễn Thùy Linh','Trần Hoàng Phúc','Phạm Ngọc Hân','Võ Thành Đạt','Đặng Bảo Trâm','Huỳnh Gia Bảo','Bùi Kim Ngân','Đỗ Quốc Bảo','Phan Mỹ Duyên','Lý Anh Tuấn','Mai Thanh Thảo','Châu Nhật Minh'], [3,1,4,0,2,3,1,0,2,4,1,0,2]]
  ];
  let employeeNumber = 4;
  for (const [regionId, prefix, names, completions] of teams) {
    names.forEach((name, index) => {
      const employeeId = 'MER-' + String(employeeNumber++).padStart(3, '0');
      employees.push({id: employeeId, name, role: 'mer', regionIds: [regionId], username: employeeId.toLowerCase()});
      const workload = regionId === 'hn' ? [5,4,6,4,5][index % 5] : [4,5,4,3,6][index % 5];
      const district = (regionId === 'hn' ? ['Đống Đa','Ba Đình','Tây Hồ','Hoàng Mai','Nam Từ Liêm'] : ['Ninh Kiều','Cái Răng','Bình Thủy','Ô Môn','Thốt Nốt'])[index % 5];
      for (let visit = 0; visit < workload; visit++) {
        const code = prefix + '-' + (101 + index * 10 + visit);
        stores.push({id: code, code, name: ['WinMart+','Co.op Food','WinMart'][visit % 3] + ' ' + district + ' ' + (index + 1) + '.' + (visit + 1), regionId, employeeId, target: 1, address: (20 + index * 7 + visit * 12) + ' đường ' + district});
        if (visit >= completions[index]) continue;
        const time = String(8 + visit).padStart(2,'0') + ':' + String(10 + (index * 7 + visit * 11) % 45).padStart(2,'0');
        sampleReports.push(createReport('DEMO-TEAM-' + code, code, employeeId, regionId, time, {
          display: {outside: 1 + (index + visit) % 3, glass: (index + visit) % 2, coc: (index + 2 * visit) % 3, ge: (index + visit + 1) % 2, tree: index % 3 === 0 ? 1 : 0},
          stock: {expiry: index % 4 === 0 ? '2 thùng cần ưu tiên xuất trong tháng.' : 'Không ghi nhận.', packaging: visit % 2 ? 'Heineken lon 330ml' : 'Tiger lon 330ml', notes: index % 4 === 0 ? 'Đã thông tin cho quản lý cửa hàng.' : ''},
          notes: ['Đã bổ sung sản phẩm và nhãn giá.','Hoàn tất kiểm tra quầy kệ.','Đã sắp xếp lại vị trí trưng bày.'][(index + visit) % 3]
        }));
      }
    });
  }

  const displayFields = [
    { id: 'outside', label: 'Ngoài kệ chính / tủ lạnh có bia HVN' },
    { id: 'glass', label: 'Mặt kính' },
    { id: 'coc', label: 'Quầy thu ngân (COC)' },
    { id: 'ge', label: 'Đầu kệ (GE)' },
    { id: 'tree', label: 'Cây bia (khu rau thịt)' }
  ];

  global.HvnMockData = {
    accounts,
    regions,
    employees,
    supervisors,
    stores,
    sampleReports,
    historicalReports,
    displayFields
  };
})(window);
