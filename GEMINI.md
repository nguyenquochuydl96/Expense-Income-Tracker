# Project Rules & Context: Heo & Mèo Finance (Expense-Income-Tracker)

Dự án này là ứng dụng web quản lý thu chi cá nhân tích hợp Google Sheets API và Firebase Auth.

## Bắt buộc đọc khi bắt đầu phiên làm việc
1. Đọc file `HANDOFF.md` ở thư mục gốc để nắm toàn bộ tiến độ, kiến trúc và các việc đang mở.
2. Tuân thủ nghiêm ngặt cẩm nang `UI_UX_AND_DEV_GUIDE.md` về tiêu chuẩn thiết kế UI/UX (Impeccable & Tailwind v4) và kỷ luật phát triển Superpowers (Quy trình 6 bước, không code mò, TDD bắt buộc cho logic tính toán).

## Quy tắc thiết kế UI/UX & Kỷ luật Code
- **Bảng màu:** Trung tính sạch (Slate/Gray), Xanh ngọc (Emerald) cho thu nhập/tài sản dương, Đỏ (Rose) cho chi tiêu/cảnh báo.
- **Tiện ích class:** Sử dụng hàm `cn()` tại `src/utils/cn.ts` (`clsx` + `tailwind-merge`) khi ghép class động hoặc conditional classes.
- **Kỷ luật phát triển:** Lên kế hoạch rõ ràng trước khi sửa code, kiểm tra kỹ lưỡng `tsc --noEmit && npm run build` trước khi commit.

## Quy tắc làm việc & Git
1. **Phối hợp song song với Agent Hermes:**
   - Dự án được phát triển song song giữa Antigravity (trên Windows local) và Hermes (trên Linux server).
   - Trước khi sửa bất kỳ file nào: Chạy `git pull origin main`.
   - Sau khi hoàn thành và kiểm tra: Tạo commit và chạy `git push origin main`.
2. **Ngôn ngữ giao tiếp:** User sử dụng tiếng Việt. Giải thích ngắn gọn, rõ ràng, dễ hiểu.
3. **Môi trường:**
   - Framework: React 19 + Vite 8 + TypeScript + Tailwind CSS 4.
   - Nếu cần chạy local build / dev server trên Windows: Sử dụng Node.js (cài qua `winget install OpenJS.NodeJS.LTS` nếu chưa có).
