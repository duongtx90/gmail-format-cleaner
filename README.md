# Format Cleaner for Gmail

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](manifest.json)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)

> Extension Chrome (Manifest V3) đưa thư Gmail về **một chuẩn định dạng duy nhất** chỉ bằng một nút bấm hoặc phím tắt. Tự động làm sạch định dạng khi dán từ Word, Excel, Docs, web và VS Code.

---

## Tính năng nổi bật

| Tính năng | Mô tả chi tiết |
|---|---|
| 🎨 **Nút con lăn sơn** cạnh nút Gửi | Chuẩn hóa toàn bộ thư về một chuẩn: một font, một cỡ chữ, một màu, giãn dòng đồng nhất |
| ⌨️ **Phím tắt Alt+Shift+F** | Kích hoạt chuẩn hóa ngay lập tức trong khi đang gõ |
| 📋 **Tự làm sạch khi dán (Ctrl+V)** | Tự động loại bỏ rác định dạng từ Word, Google Docs, Excel, VS Code; tự nhận diện list, link, SĐT |
| ↩️ **Hoàn tác tức thì** | Nút Hoàn tác ngay trên thanh thông báo nếu muốn trở lại nội dung ban đầu |
| 🛡️ **Bảo mật tuyệt đối** | Xử lý 100% trên trình duyệt (Local DOM), không lưu trữ, không truyền dữ liệu ra ngoài |

### Những gì được chuẩn hóa:

- **Cỡ chữ**: mọi kiểu 12pt, 13px, 1.2em, Small/Large của Gmail đều về một cỡ chuẩn. Dòng ngắn có chữ to vượt trội (tiêu đề) chuyển thành chữ đậm.
- **Màu nền**: xóa hết (highlight vàng, nền đen của code…).
- **Màu chữ, font**: về chuẩn (có tùy chọn giữ màu chữ).
- **Code**: font monospace, giữ nguyên thụt lề, khung nền xám nhạt (có thể tắt).
- **Dòng trống**: nhiều dòng trống liền nhau gộp còn một; đoạn văn dán từ Word/Docs cách nhau một dòng.
- **Giữ lại**: đậm, nghiêng, gạch chân, gạch ngang, link, danh sách, bảng, căn giữa/phải.
- **Tự nhận dạng** (bật/tắt riêng từng mục trong trang cài đặt):
  - Dòng bắt đầu bằng `-` `*` `•` hoặc `1.` `2.` / `a)` `b)` → danh sách thật; thụt vào 2 dấu cách → mục con.
  - `https://…`, `www.…`, tên miền `.vn` `.com` … → link; địa chỉ email → link gửi thư.
  - Số điện thoại Việt Nam (0912 345 678, 0912.345.678, +84 24 3826 1234, hotline 1900/1800) → link gọi.
  - Không nhận nhầm: năm ("2026."), số thập phân ("12.5%"), mã đơn hàng dài, ngày tháng, số thứ tự đứng một mình. Không đụng vào nội dung trong khung code.
- **Không đụng vào**: chữ ký, phần thư trích dẫn khi trả lời, ảnh, chip Drive.

---

## Hướng dẫn cài đặt

### Cách 1: Chế độ nhà phát triển (Developer Mode)

1. Tải hoặc clone mã nguồn này về máy:
   ```bash
   git clone https://github.com/duongtx90/gmail-format-cleaner.git
   ```
2. Mở trình duyệt Chrome và truy cập `chrome://extensions`.
3. Bật gạt **Developer mode** (góc trên bên phải).
4. Bấm **Load unpacked** (Tải tiện ích đã giải nén), chọn thư mục vừa clone.
5. Tải lại trang Gmail (`https://mail.google.com`). Mở cửa sổ soạn thư, bạn sẽ thấy biểu tượng con lăn sơn cạnh nút **Gửi**.

### Cách 2: Triển khai nội bộ doanh nghiệp (Google Workspace)

- **Google Workspace**: Đăng extension ở chế độ *Private* cho domain công ty, sau đó vào Admin Console → Devices → Chrome → Apps & extensions để cài đặt bắt buộc cho nhân viên.
- Có thể cấu hình sẵn chuẩn định dạng của công ty bằng cách đổi giá trị `DEFAULTS` trong `src/sanitizer.js`.

---

## Quyền hạn & Bảo mật (Privacy)

- Quyền yêu cầu: chỉ `storage` (lưu cài đặt cục bộ) và chạy trên `https://mail.google.com/*`.
- Không sử dụng Gmail API, không gửi dữ liệu ra bên ngoài.
- Chi tiết xem tại [PRIVACY.md](PRIVACY.md).
- Thông tin xuất bản Chrome Web Store xem tại [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md).

---

## Cấu trúc thư mục

```
├── manifest.json       # Cấu hình extension (Manifest V3)
├── src/
│   ├── sanitizer.js    # Bộ chuẩn hóa HTML (thuần JS)
│   ├── content.js      # Gắn nút, phím tắt, xử lý dán, hoàn tác
│   ├── content.css     # Định kiểu nút chuẩn hóa & thông báo
│   └── background.js   # Service worker quản lý mở trang cài đặt
├── options/            # Giao diện cài đặt & khung dán thử
├── icons/              # Bộ icon 16, 32, 48, 128px
├── CHROMEWEBSTORE.md   # Hướng dẫn & nội dung đăng lên Chrome Web Store
├── PRIVACY.md          # Chính sách quyền riêng tư
└── LICENSE             # MIT License
```

---

## License

Phát hành dưới giấy phép [MIT](LICENSE). Tự do sử dụng, chỉnh sửa và phân phối.
