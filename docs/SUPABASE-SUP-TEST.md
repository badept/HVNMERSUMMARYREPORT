# Kết nối SUP với Supabase test

Phạm vi: đăng nhập SUP bằng Supabase Auth, đọc dữ liệu và cập nhật thủ công bằng nút trên Dashboard. Chế độ demo vẫn mặc định hoạt động. Chưa kết nối ghi dữ liệu MER, API nguồn, ảnh Storage hoặc tự gửi Zalo. Không tự chuyển về dữ liệu demo khi Supabase lỗi.

## 1. Chuẩn bị database

Trong project **field-force-test**, mở SQL Editor và chạy lần lượt:

1. Toàn bộ `database/sup-test-fixture.sql`.
2. Toàn bộ `database/sup-api.sql`.

Không cần đưa schema `ffa_sup_test` vào Exposed schemas. Giữ `public` trong Exposed schemas và bật Data API. Frontend chỉ gọi RPC `public.hvn_sup_snapshot`. RPC kiểm tra `auth.uid()` và mapping quản trị trong schema riêng; không mở bảng fixture cho anon/authenticated. Chỉ dùng script trên database test.

## 2. Tạo tài khoản SUP

Supabase → Authentication → Users → Add user → Create new user. Dùng email và mật khẩu của bạn; xác nhận email hoặc dùng tùy chọn Auto Confirm nếu có trong môi trường test. Không dùng mật khẩu demo `123456`.

Copy User UID, rồi chạy SQL sau, thay UUID mẫu bằng UID thật:

```sql
insert into ffa_sup_test.user_supervisors (user_id, supervisor_id)
values ('YOUR-AUTH-USER-UUID'::uuid, 'SUP-001')
on conflict (user_id) do update
set supervisor_id = excluded.supervisor_id;
```

UID không phải API key. Mật khẩu không được đưa vào SQL, Git hoặc chat. Tài khoản không có mapping sẽ bị RPC từ chối; không có đăng ký tự động từ ứng dụng.

## 3. Cấu hình frontend

Lấy Project URL và **Publishable key** trong bảng kết nối/API Keys của project. Legacy anon key cũng được hỗ trợ. Sửa `supabase-config.js`:

```js
window.HvnConfig = {
  mode: 'supabase',
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  publishableKey: 'sb_publishable_YOUR_PUBLIC_KEY'
};
```

Đây là cấu hình công khai trong trình duyệt. Tuyệt đối không dùng secret key, service_role, database password. App là HTML/JS tĩnh: thêm biến môi trường Vercel không tự điền cấu hình vào file này.

## 4. Test local

Mở `index.html` bằng Live Server hoặc máy chủ HTTP tĩnh. Đăng nhập bằng email/mật khẩu Auth vừa tạo. Chọn **27/11/2026** vì fixture hiện được sinh cho ngày này.

Kết quả toàn bộ khu vực: 21/26 nhân sự hoạt động, 56/115 Store, 56/115 báo cáo, 49%. Hà Nội 30/53 (57%); Cần Thơ 26/62 (42%).

Test thay đổi từ database, không ghi từ trình duyệt:

```sql
update ffa_sup_test.reports
set display = jsonb_set(display, '{glass}', '9'::jsonb),
    notes = 'TEST: dữ liệu cập nhật từ Supabase'
where id = 'SAMPLE-HN-001';
```

Trên Dashboard bấm **Cập nhật dữ liệu**, mở báo cáo HN-001 ngày 27/11/2026: Mặt kính = 9 và ghi chú mới. Sửa display không làm thay đổi KPI số Store hoàn thành. Hoàn nguyên sau test:

```sql
update ffa_sup_test.reports
set display = jsonb_set(display, '{glass}', '1'::jsonb),
    notes = 'Trưng bày gọn, đủ nhận diện thương hiệu.'
where id = 'SAMPLE-HN-001';
```

Kiểm tra thêm:

- Sai mật khẩu: không vào Dashboard.
- Auth user không có mapping: không đọc được dữ liệu.
- Network lỗi: báo lỗi, không thay bằng dữ liệu demo; cập nhật lỗi giữ snapshot cũ.
- Ngày không có báo cáo: không có báo cáo, KPI hoàn thành = 0 theo PLAN tĩnh.
- Đăng xuất: quay lại đăng nhập; tải lại trang cũng yêu cầu đăng nhập lại.
- `mode: 'demo'`: đăng nhập mer001/sup001 và kho dữ liệu cục bộ vẫn như trước.

Token chỉ giữ trong bộ nhớ, không ghi LocalStorage; chưa refresh phiên tự động. Khi phiên hết hạn, đăng xuất rồi đăng nhập lại. Chưa tự polling/realtime: dùng nút cập nhật. Không tải ảnh fixture giả từ IndexedDB trong chế độ cloud.

Nếu cần ngày test khác, sinh lại SQL bằng `node database/generate-sup-fixture.cjs YYYY-MM-DD` trên fixture mới. Chạy lại seed hiện tại không reset các ID đã có, không dịch ngày bản ghi cũ.

## 5. Deploy Vercel

Sau khi local đạt: commit/push các thay đổi project tới nhánh Vercel đang theo dõi và kiểm tra deployment thành công. Nếu deploy thủ công, deploy lại toàn bộ project. Trên URL Vercel đăng nhập và lặp lại bài test cập nhật trên. Không có bước build/package mới.

## Giới hạn

Đây là tích hợp POC trên fixture, không phải schema production. PLAN vẫn là phân công cửa hàng tĩnh giống code cũ. Snapshot tải toàn bộ lịch sử thuộc phạm vi SUP, phù hợp bộ dữ liệu nhỏ; trước khi dùng dữ liệu lớn cần phân trang/lọc ngày phía server. Các trường photoIds chưa trỏ tới Storage nên frontend hiển thị không có ảnh. Các nút gửi báo cáo không thực thi trong chế độ Supabase.
