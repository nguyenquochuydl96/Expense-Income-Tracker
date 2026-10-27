# HANDOFF — Heo & Mèo Finance (Expense-Income-Tracker)

> File bàn giao phiên làm việc. Khi chuyển sang tài khoản mới hoặc agent khác tiếp nhận, đọc file này là nắm toàn bộ bối cảnh và tiếp tục công việc ngay lập tức.

**Cập nhật lần cuối:** 27/10/2026  
**Repo GitHub:** https://github.com/nguyenquochuydl96/Expense-Income-Tracker  
**Đường dẫn Local:** `C:\Users\huynq\.gemini\antigravity\scratch\Expense-Income-Tracker`  
**Git Author:** `Nguyen Quoc Huy <nguyenquochuy.dl96@gmail.com>`

---

## 1. Tổng quan dự án

Ứng dụng **Heo & Mèo Finance**: Web app quản lý thu chi cá nhân, đối soát số dư và dòng tiền kết nối đồng bộ trực tiếp với Google Sheets và xác thực qua Firebase Auth.

### Công nghệ (Tech Stack)
- **Framework:** React 19.0.1 + Vite 8.3.0
- **Ngôn ngữ:** TypeScript 7.0.2
- **Styling:** Tailwind CSS 4.3.3 (sử dụng plugin `@tailwindcss/vite`)
- **Icons & Animation:** Lucide-react (0.546.0), Motion (12.23.24)
- **Backend / Sync:** Firebase Auth (13.1.0) + Google Sheets API v4

---

## 2. Quy trình làm việc song song (Antigravity & Hermes)

Tương tự như dự án `Boardgame-Collection`:
1. **Agent Hermes**: Chạy trên server Linux (`/home/ubuntu/...`).
2. **Agent Antigravity**: Chạy trên máy Windows local của user (`C:\Users\huynq\.gemini\antigravity\scratch\Expense-Income-Tracker`).
3. **Quy tắc Git:**
   - **Bắt buộc trước khi sửa:** Chạy `git pull origin main` để lấy code mới nhất mà Hermes hoặc user đã push.
   - **Sau khi hoàn tất:** Commit với message rõ ràng, sau đó `git push origin main`.
   - Quyền push/pull trên máy Windows này đã được lưu trong Windows Git Credential Manager, không cần cấu hình thêm key.

---

## 3. Trạng thái hiện tại (Đã hoàn tất 4 Phase)

Toàn bộ 4 giai đoạn cải tiến đã được thực hiện (chi tiết trong `UPGRADE_SUMMARY.md`):
1. **Phase 1: UI/UX Fintech Theme**
   - 4 KPI cards phong cách Glassmorphism (`src/App.tsx`).
   - CategoryBadges tự động theo 20+ danh mục tiếng Việt (`src/utils/categoryIcons.tsx`).
2. **Phase 2: Nhập liệu nhanh & Optimistic Updates**
   - Giao dịch mới hiển thị tức thì trên bảng trước khi sync Google Sheets.
   - Top 6 Category Quick Chips + Context-aware smart amounts gợi ý số tiền (`src/components/AddTransactionModal.tsx`, `src/utils/quickEntry.ts`).
   - Trạng thái đồng bộ chi tiết cho từng dòng mới.
3. **Phase 3: Analytics & Top 3 Categories**
   - Widget Top 3 danh mục chi tiêu lớn nhất (`src/components/AnalyticsCharts.tsx`).
   - Biểu đồ dòng tiền và donut chart phân bổ chi tiêu.
4. **Phase 4: Token Auto-Refresh & Global Sync Badge**
   - Bắt lỗi HTTP 401 Unauthorized từ Google Sheets API để tự động xin lại token và retry request (`src/services/googleSheetsService.ts`).
   - Floating badge hiển thị trạng thái sync toàn cục ở góc dưới màn hình (`src/App.tsx`).

---

## 4. Hướng phát triển tiếp theo

Các tính năng có thể triển khai tiếp theo tùy theo yêu cầu của user:
1. **Backup / Export-Import:** Xuất/nhập file CSV, JSON dự phòng ngoại tuyến.
2. **Quản lý danh mục & Ví tiền:** Cho phép thêm/sửa danh mục tùy chỉnh linh hoạt hơn.
3. **PWA / Mobile responsive:** Tối ưu thanh điều hướng dưới đáy (bottom navigation) cho màn hình điện thoại.
4. **Chạy local test trên Windows:** Nếu cần chạy `npm run dev` / `npm run build` trên máy Windows này, có thể cài Node.js nhanh qua lệnh `winget install OpenJS.NodeJS.LTS`.
