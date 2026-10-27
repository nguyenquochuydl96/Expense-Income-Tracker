# HANDOFF — Heo & Mèo Finance (Expense-Income-Tracker)

> **Tài liệu bàn giao phiên làm việc.** Khi chuyển sang tài khoản Gemini mới hoặc agent khác (Antigravity / Hermes) tiếp nhận, chỉ cần đọc file này là nắm toàn bộ bối cảnh, kiến trúc giao diện mới và tiếp tục công việc ngay lập tức mà không cần hỏi lại.

**Cập nhật lần cuối:** 27/10/2026 (Redesign Dashboard theo phong cách Coupler.io / Xero Billing Dashboard)  
**Repo GitHub:** https://github.com/nguyenquochuydl96/Expense-Income-Tracker  
**Đường dẫn Local:** `C:\Users\huynq\.gemini\antigravity\scratch\Expense-Income-Tracker`  
**Git Author:** `Nguyen Quoc Huy <nguyenquochuy.dl96@gmail.com>`

---

## 1. Tổng quan dự án

Ứng dụng **Heo & Mèo Finance**: Web app quản lý thu chi cá nhân, đối soát số dư và dòng tiền kết nối đồng bộ trực tiếp 2 chiều với Google Sheets API và Firebase Auth.

### Stack kỹ thuật
- **Frontend:** React 19.0.1 + Vite 8.3.0
- **Ngôn ngữ:** TypeScript 7.0.2
- **Styling:** Tailwind CSS 4.3.3 (plugin `@tailwindcss/vite`)
- **Icons & Animation:** Lucide-react (0.546.0), Motion (12.23.24)
- **Backend / Sync:** Firebase Auth (13.1.0) + Google Sheets API v4

---

## 2. Giao diện mới: Xero / Coupler.io Billing Dashboard Style

Đã hoàn thành toàn bộ việc redesign giao diện Dashboard theo đúng chuẩn thiết kế mẫu:

### 2.1 Top Banner (Dark Navy Curved Header)
* **Màu sắc:** Nền Dark Navy (`#132247`) với góc bo cong đặc trưng phía dưới bên phải (`rounded-br-[36px] sm:rounded-br-[48px]`).
* **Logo & Title:** Logo tròn 2 lớp (HM), tiêu đề "Billing dashboard for Heo & Mèo", nhãn phụ `HEOMEO.FINANCE`.
* **Action Buttons:**
  - Nút tím nhạt Lavender: "Xem sổ chi tiết" / "Về Dashboard".
  - Nút tím đậm Dark Purple: "+ Thêm giao dịch" mở popup nhập liệu nhanh.

### 2.2 Floating Filter Bar
* Thanh lọc nổi với nền trắng, viền mảnh:
  - **Dropdown Kỳ thống kê:** Icon lịch 📅 chọn theo tháng (T4/26 -> T10/26 hoặc Tất cả).
  - **Dropdown Danh mục:** Tương tự dropdown "Customer" trong ảnh mẫu, cho phép lọc nhanh theo danh mục chi tiêu (`Ăn uống`, `Tiết kiệm`, `Thuê nhà`,...).

### 2.3 Bộ 4 KPI Summary Cards (Chuẩn màu & bố cục ảnh mẫu)
Mỗi card có màu đơn sắc nổi bật, số tiền lớn màu trắng ở giữa và dòng ghi chú `in home currency` in nghiêng ở góc dưới:
1. **Card 1 - Xanh Navy Sâu (`#0B4B8A`):** Tổng thu nhập (`kpiStats.effectiveIncome`), click để mở nhanh form ghi thu.
2. **Card 2 - Xanh Dương Đại Dương (`#0077B6`):** Tổng chi tiêu (`kpiStats.totalExpense`), click chuyển sang Sổ giao dịch.
3. **Card 3 - Xanh Ngọc/Lục Bảo (`#059669`):** Số dư khả dụng Net Balance (`kpiStats.netBalance`), click chuyển sang Check tiền.
4. **Card 4 - Tím Violet (`#6D3894`):** Phát sinh BE Corp & Thẻ tín dụng Credit (`totalCredit + totalBeCorp`).

### 2.4 Hàng biểu đồ giữa (Middle Row)
* **Bên trái (Horizontal Bar Chart - 60%):** Biểu đồ thanh ngang màu xanh Cyan (`#38BDF8`) hiển thị Top các danh mục chi tiêu lớn nhất. Tên danh mục bên trục Y, số tiền hiển thị trực tiếp trên thanh, kèm thước đo giá trị ở đáy. Có nút chuyển đổi xem biểu đồ dòng tiền theo tháng.
* **Bên phải (Coral Donut Chart - 40%):** Biểu đồ hình tròn khuyết với dải màu san hô / hồng đào (Coral/Salmon `#F87171`, `#FB7185`, `#F43F5E`,...). Hiển thị trực tiếp số % lên từng lát cắt lớn và danh sách chú thích (legend) dạng chấm tròn bên phải.

### 2.5 Hàng bảng dữ liệu đáy (Bottom Dual Tables)
Hai bảng dữ liệu song song chuẩn theo mẫu:
* **Bảng trái ("Tổng hợp chi tiêu theo phân loại" - AR Aging Summary style):**
  - Cột: Danh mục | Tiền mặt/Ví | BE Corp | Credit | Tổng chi.
  - Các ô số được tô nền màu pastel nhẹ: Tiền mặt (xám nhạt), BE Corp (xanh lá nhạt), Credit (xanh cyan nhạt), và cột Tổng chi được highlight màu đào ấm (`bg-rose-50 text-rose-900`).
* **Bảng phải ("Giao dịch chi tiêu gần nhất" - Unpaid Invoices style):**
  - Cột: Món hàng | Danh mục (kèm CategoryBadge) | Ngày | Số tiền (tô nền màu đào ấm).

---

## 3. Bản đồ File dự án

```
src/
├── App.tsx                              # Main layout, State trung tâm, 4 KPI cards, Filter bar, Header
├── index.css                            # Palette màu mới, font tokens, scrollbar styling
├── components/
│   ├── DashboardDualTables.tsx          # MỚI: 2 bảng dữ liệu song song đáy Dashboard chuẩn ảnh mẫu
│   ├── AnalyticsCharts.tsx              # CẬP NHẬT: Horizontal Cyan Bar Chart + Coral Donut Chart
│   ├── TransactionLedgerTable.tsx       # Bảng sổ cái đầy đủ 6 cột chuẩn Google Sheet
│   ├── AddTransactionModal.tsx          # Modal thêm giao dịch mới (Smart Amount suggestions, Quick Chips)
│   ├── ReconcileCheckTienView.tsx       # Màn hình Check tiền, quản lý ví thực tế & chu kỳ thẻ
│   └── SheetSyncPanel.tsx               # Màn hình kết nối & đồng bộ Google Sheets 2 chiều
├── services/
│   ├── firebaseAuth.ts                  # Google OAuth & Firebase Auth
│   └── googleSheetsService.ts           # Fetch & Append Google Sheets API (với Auto Token Refresh 401)
├── types/
│   └── finance.ts                       # Định nghĩa TypeScript cho giao dịch, tài khoản, cấu hình chu kỳ
└── utils/
    ├── categoryIcons.tsx                # Mapping 20+ danh mục tiếng Việt với icon Lucide & màu
    ├── csvParser.ts                     # Parser CSV đính kèm, format tiền tệ VNĐ, ngày tháng
    └── quickEntry.ts                    # Phân tích tần suất chi tiêu, gợi ý số tiền thông minh
```

---

## 4. Hướng dẫn tiếp tục làm việc khi chuyển sang tài khoản mới

Khi bạn đăng nhập tài khoản Gemini mới:
1. **Mở thư mục workspace:** `C:\Users\huynq\.gemini\antigravity\scratch\Expense-Income-Tracker`
2. **Nhắn cho Agent mới:**  
   > *"Đọc file HANDOFF.md và tiếp tục phát triển app Heo & Mèo Finance giúp mình."*
3. Agent sẽ tự động đọc `GEMINI.md` và `HANDOFF.md`, nắm trọn vẹn toàn bộ kiến trúc và thiết kế mới này.

---

## 5. Quy tắc phối hợp song song với Hermes
* **Hermes** làm việc trên môi trường Linux server (`/home/ubuntu/...`).
* **Antigravity** làm việc trên Windows local (`C:\Users\huynq\...`).
* Trước khi code: Luôn chạy `git pull origin main`.
* Sau khi hoàn thành: Commit và chạy `git push origin main`.
