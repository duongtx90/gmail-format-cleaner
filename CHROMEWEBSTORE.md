# Chrome Web Store Listing — Format Cleaner for Gmail

> Last Updated: 2026-10-22

## Store Listing Metadata

**Extension Name** [REQUIRED]
Format Cleaner for Gmail

**Short Description** [REQUIRED] (120 / 132 chars)
Một nút bấm đưa thư về chuẩn: cỡ chữ, font, màu, giãn dòng. Tự làm sạch định dạng khi dán từ Word, Docs, web và VS Code.

**Detailed Description** [REQUIRED] (Plain text with line breaks for CWS)
```
Format Cleaner for Gmail đưa toàn bộ thư Gmail về đúng một chuẩn định dạng duy nhất chỉ với một nút bấm hoặc phím tắt.

Bạn thường xuyên gặp phiền toái khi copy nội dung từ Microsoft Word, Google Docs, Excel, trang web hoặc VS Code vào Gmail khiến thư bị lẫn lộn đủ loại font chữ, kích thước to nhỏ bất thường, màu nền xám/vàng và khoảng cách dòng lộn xộn? Format Cleaner for Gmail giải quyết triệt để vấn đề này ngay lập tức.

TÍNH NĂNG CHÍNH
• Chuẩn hóa 1-click: Nút bấm con lăn sơn thông minh ngay cạnh nút Gửi đưa toàn bộ nội dung về một font, một cỡ chữ, một màu và giãn dòng chuẩn.
• Phím tắt tiện lợi: Nhấn Alt+Shift+F bất kỳ lúc nào khi đang soạn thảo.
• Tự động làm sạch khi dán (Ctrl+V): Nội dung dán từ Word, Docs, web, bảng tính Excel được làm sạch tự động trước khi chèn vào thư.
• Tự động nhận dạng thông minh: Nhận diện danh sách gạch đầu dòng, liên kết web, địa chỉ email và số điện thoại Việt Nam chuẩn xác.
• Bảo toàn thông tin quan trọng: Giữ lại định dạng in đậm, in nghiêng, gạch chân, liên kết, bảng biểu, ảnh đính kèm và chữ ký thư cá nhân.
• Tùy biến linh hoạt: Dễ dàng cấu hình font ưa thích (Arial, Segoe UI, Roboto, Times New Roman...), cỡ chữ, màu sắc và độ giãn dòng trong trang Cài đặt.
• Hoàn tác tức thì: Hỗ trợ nút Hoàn tác ngay trên thanh thông báo nếu muốn quay lại nội dung cũ.

HƯỚNG DẪN SỬ DỤNG
1. Mở Gmail (mail.google.com) và bấm nút Soạn thư.
2. Soạn hoặc dán văn bản từ các nguồn khác vào thư.
3. Bấm vào biểu tượng con lăn sơn cạnh nút Gửi (hoặc nhấn tổ hợp Alt+Shift+F). Toàn bộ thư sẽ lập tức được căn chỉnh theo chuẩn đẹp mắt.
4. Bấm vào biểu tượng tiện ích trên thanh công cụ trình duyệt để tùy chỉnh font, cỡ chữ và màu sắc theo sở thích của bạn.

BẢO MẬT & QUYỀN RIÊNG TƯ
• Tiện ích hoạt động 100% trên máy của bạn (Local on-device).
• Hoàn toàn KHÔNG thu thập, KHÔNG lưu trữ từ xa và KHÔNG gửi bất kỳ nội dung thư hay thông tin cá nhân nào ra bên ngoài.
• Mã nguồn mở hoàn toàn theo giấy phép MIT.

HỖ TRỢ & ĐÓNG GÓP
Mã nguồn và báo lỗi tại GitHub: https://github.com/duongtx90/gmail-format-cleaner
```

**Category** [REQUIRED]
Productivity (Năng suất)

**Single Purpose** [REQUIRED]
Standardizes email typography and formatting in Gmail to a consistent style and cleans up messy pasted content with a single click.

**Primary Language** [REQUIRED]
Vietnamese (or English)

---

## Graphics & Assets Checklist

| Asset | Dimensions | Status | Notes |
|-------|-----------|--------|-------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Cần chụp | Cửa sổ soạn thư Gmail có nút con lăn sơn cạnh nút Gửi |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Cần chụp | So sánh trước và sau khi bấm chuẩn hóa (Before & After) |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Cần chụp | Trang Options tùy chỉnh Font, Size, Giãn dòng, Khung Dán thử |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Tùy chọn | Banner quảng bá nhỏ |

---

## Permissions Justification (Dành cho CWS Review Team)

| Permission / Host | Type | Justification for Google Reviewer |
|-------------------|------|-----------------------------------|
| `storage` | permissions | Used to store user formatting preferences (chosen font family, font size, text color, line height, and auto-formatting toggles) locally across browser sessions. |
| `https://mail.google.com/*` | content_scripts | Required to inject the format cleaning button into the Gmail compose action bar and to clean/standardize rich text formatting inside the compose editor when triggered. |

---

## Privacy & Data Use (Khai báo trên Developer Console)

**Does the extension collect user data?** No

- [x] Data is NOT sold to third parties.
- [x] Data is NOT used for purposes unrelated to the extension's core functionality.
- [x] Data is NOT used for creditworthiness or lending purposes.

**Privacy Policy URL** [REQUIRED]
https://github.com/duongtx90/gmail-format-cleaner/blob/main/PRIVACY.md

---

## Developer Info

- **Publisher / Contact Email**: duongtx90@gmail.com
- **Support URL / Repository**: https://github.com/duongtx90/gmail-format-cleaner
- **License**: MIT
