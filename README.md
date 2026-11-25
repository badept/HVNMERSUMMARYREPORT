# HVN Mer · Mobile Webview

## Chạy ứng dụng

1. Mở thư mục này bằng VS Code.
2. Chạy `index.html` với Live Server hoặc một máy chủ tĩnh tại `localhost`.
3. Dùng một trong hai tài khoản demo:

| Vai trò | Mã nhân viên | Mật khẩu | Tên |
|---|---|---|---|
| Mer | `mer001` | `123456` | Phạm Hải Đăng |
| SUP | `sup001` | `123456` | Nguyễn Xuân Toàn |

Màn hình tài khoản có thể chuyển vai trò demo và đặt lại dữ liệu trên thiết bị.

## Cấu trúc frontend

- `index.html`: trang Webview và điểm khởi chạy ứng dụng.
- `app.css`: giao diện mobile-first, các component dùng chung và responsive.
- `mock-data.js`: tài khoản, nhân viên, khu vực, cửa hàng và báo cáo demo.
- `app.js`: giao diện, điều hướng, xử lý báo cáo và lưu trữ phía trình duyệt.

Ứng dụng không cần backend, API hoặc package bổ sung. Dữ liệu báo cáo/check-in lưu trong `LocalStorage`; ảnh được xử lý và đóng watermark trên `Canvas`, rồi lưu trong `IndexedDB`. Chọn ảnh hỗ trợ nhiều tệp; ảnh cần có cả nhóm mặt tiền và quầy kệ. Watermark dùng thời gian chụp từ EXIF nếu có, hoặc ghi rõ giờ tải ảnh.

Nếu WebView hạn chế Clipboard API, ứng dụng thử phương thức sao chép dự phòng của trình duyệt. Quyền truy cập camera/chia sẻ phụ thuộc trình duyệt; dùng `localhost` hoặc HTTPS để có tương thích tốt hơn.

Dashboard SUP cho phép gửi báo cáo cuối ngày theo bộ lọc tới hệ thống demo (ghi nhận cục bộ, không kết nối API), hoặc mở bảng chia sẻ của thiết bị/copy nội dung để gửi qua Zalo.

Dashboard Mer có thể chọn ngày để xem Summary và báo cáo lịch sử ở chế độ chỉ đọc. Dữ liệu demo có ngày hoàn thành toàn bộ, hoàn thành một phần và ngày chưa có báo cáo.

SUP có thể mở báo cáo tổng quan riêng của từng khu vực; màn hình chi tiết vẫn giữ lối chuyển giữa các khu vực được giao và không thay đổi bộ lọc tổng quan.

Đây là đăng nhập/phân quyền mô phỏng frontend, không phải xác thực bảo mật. Vai trò Mer chỉ giới hạn dữ liệu trong giao diện; không dùng bản demo để bảo vệ dữ liệu thật.
