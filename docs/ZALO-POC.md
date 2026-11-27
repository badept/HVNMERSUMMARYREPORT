# POC gửi từ Zalo cá nhân

Dashboard SUP đã được người dùng xác nhận đọc Supabase đúng bằng ảnh màn hình. Bước hiện tại là kiểm chứng gateway Zalo, chưa nối trigger hoặc gửi dữ liệu hàng loạt.

`zca-js` là thư viện không chính thức, có rủi ro tài khoản bị khóa. Dùng tài khoản thử nghiệm và nhóm có đồng ý nhận tin. Tham khảo https://github.com/RFS-ADRENO/zca-js . POC pin phiên bản 2.4.0, không đưa session vào frontend/Vercel.

## 1. Chuẩn bị

- Tài khoản Zalo test đăng nhập trên điện thoại.
- Tạo nhóm `HVN AUTOMATION TEST`, có tài khoản gửi và một người nhận test đồng ý tham gia.
- Không cần thay Supabase ở bước này.
- Không mở thư mục backend hoặc session bằng web server công khai. `.gitignore` loại session khỏi Git; `.vercelignore` loại toàn bộ backend khỏi bản deploy giao diện. Nếu dùng hosting khác phải tự loại thư mục này.

## 2. Cài thư viện

VS Code → Terminal → New Terminal, từ root project:

```powershell
cd backend
npm install --ignore-scripts
```

Lưu package-lock.json khi cài thành công; dùng npm ci --ignore-scripts để tái lập về sau. Cài đặt lỗi mạng không chứng minh API Zalo lỗi; gửi thông báo npm đã che thông tin nhạy cảm.

## 3. Đăng nhập QR

```powershell
npm run zalo:login
```

Terminal in đường dẫn `backend/.private/login-qr.png`. Mở file trực tiếp bằng VS Code/ứng dụng xem ảnh. Dùng Zalo trên điện thoại quét QR và xác nhận đăng nhập. Nếu có yêu cầu xác minh bổ sung, thực hiện chính thức trên điện thoại, không tìm cách bỏ qua. QR hết hạn: chạy lại lệnh.

Kết quả: `Đăng nhập thành công... chưa gửi tin.` Phiên lưu tại `backend/.private/session.json`. Không gửi file phiên hoặc ảnh QR vào chat; không commit chúng.

## 4. Khôi phục phiên và gửi một tin

```powershell
npm run zalo:test
```

Chương trình đọc phiên đã lưu, liệt kê nhóm, yêu cầu nhập số thứ tự. Chọn đúng `HVN AUTOMATION TEST`, kiểm tra tên/ID và nội dung được in. Gõ `GUI` để gửi đúng một tin; Enter hủy. Không chọn nhóm vận hành thật.

Kết quả Gateway `Sent` phải được đối chiếu bằng tin thực tế trên điện thoại, bao gồm tiếng Việt và mã `HVN-POC-...`. Nhật ký mỗi lần thử nằm trong `.private`, không chứa nội dung phiên. Timeout hoặc không có ID xác nhận giữ `Unknown`: kiểm tra nhóm trước khi chạy lại; một lần chạy mới sẽ tạo mã test mới và có thể tạo thêm tin. Không có tự retry.

## 5. Gửi mẫu báo cáo SUP, mỗi khu vực một tin

Sau khi tin kiểm tra kết nối đã nhận thành công, dùng lệnh riêng:

1. Trong `backend`, copy `.env.example` thành `.env` (PowerShell: `Copy-Item .env.example .env`). Nếu đã có `.env`, sửa file đó, không ghi đè cấu hình cũ.
2. Điền `SUPABASE_EMAIL` và `SUPABASE_PASSWORD` bằng tài khoản SUP đã đăng nhập được trên Dashboard. Đây là thông tin cục bộ, không gửi vào chat/Git. Giữ mật khẩu trong dấu nháy kép; nếu có dấu nháy kép bên trong dùng dấu nháy đơn bao ngoài phù hợp cú pháp dotenv.
3. Chạy `npm run zalo:groups` để lấy tên/ID nhóm. Chỉ liệt kê, không gửi tin.
4. Điền ID dạng chuỗi vào `backend/zalo-groups.json`, ví dụ cấu trúc sau (thay ID minh họa bằng ID thật):

```json
{
  "hn": { "groupId": "111111111111111111" },
  "ct": { "groupId": "222222222222222222" }
}
```

5. Có thể dùng cùng ID nhóm test cho cả hai khu vực. Chương trình gửi hai tin riêng, không gộp. Dùng **ID nhóm**, không dùng số thứ tự hoặc tên. Giữ ID trong dấu nháy để không mất độ chính xác số lớn.
6. Xem trước: `npm run zalo:preview -- --date 2026-11-27`. Lệnh xác minh nhóm và đọc dữ liệu Supabase, hiện nội dung nhưng không gửi.
7. Gửi: `npm run zalo:report -- --date 2026-11-27`. Lệnh gửi ngay theo mapping, **không hỏi chọn nhóm hoặc gõ GUI**. Nếu không truyền `--date`, mặc định ngày hiện tại theo Asia/Ho_Chi_Minh. Fixture hiện có cần ngày 2026-11-27.

Mapping được kiểm tra đầy đủ trước khi gửi khu vực đầu tiên; thiếu ID hoặc không đọc được nhóm thì dừng toàn bộ. Chưa điền ID thật nên file mẫu mặc định không gửi được. Sửa file JSON để đổi nhóm các lần sau; không cần sửa mã nguồn hoặc Supabase. Nhóm phải cho tài khoản gửi quyền nhắn tin; việc đọc được nhóm không đảm bảo quyền gửi luôn còn hiệu lực.

Lệnh đọc snapshot Supabase bằng Auth/RPC đã có, không dùng số liệu hardcode. Mỗi khu vực được cấp quyền nhận một tin theo mẫu `createSupReportText` trong frontend. Hà Nội: 10 nhân viên, 30/53 Store và báo cáo; Cần Thơ: 11 nhân viên, 26/62. Không có dữ liệu trong ngày thì hiện 0 theo PLAN tĩnh, không lấy số liệu ngày khác. Ở chế độ test, khu vực không có báo cáo vẫn có một tin tổng hợp 0.

Chưa có cron 5 phút hoặc chống lặp giữa các lần chạy thủ công. Mỗi lần chạy lệnh gửi là một lượt gửi mới. Nếu lỗi khi gửi khu vực thứ hai thì khu vực đầu có thể đã nhận; chương trình dừng, kiểm tra tin/log trước khi chạy lại. Mã theo dõi nằm trong console/log, không thêm vào template báo cáo. Không cần cài thêm package cho lệnh báo cáo; dùng lại phiên Zalo đã lưu. `zalo:test` vẫn là kiểm tra kết nối tương tác như cũ; `zalo:login` vẫn chỉ đăng nhập QR.

## 6. Điều kiện đạt

1. QR đăng nhập được.
2. Lệnh test khôi phục phiên ở tiến trình mới được.
3. Một tin đúng nhóm, đúng tiếng Việt xuất hiện trên điện thoại.
4. Enter ở bước xác nhận không gửi gì.

Gửi lại kết quả PASS/FAIL hoặc thông báo lỗi đã che thông tin riêng; không gửi danh sách nhóm/session. Khi đạt mới thêm queue, mapping nhóm nhận và backend đọc Supabase để tự gửi báo cáo. Vercel frontend không giữ phiên Zalo; tự động khi máy cá nhân tắt cần backend Cloud chạy liên tục.
