# HANDOFF — Heo & Mèo Finance (Expense-Income-Tracker)

> **Tài liệu bàn giao phiên làm việc.** Khi chuyển sang tài khoản Gemini mới hoặc agent khác (Antigravity / Hermes) tiếp nhận, chỉ cần đọc file này là nắm toàn bộ bối cảnh, kiến trúc giao diện mới và tiếp tục công việc ngay lập tức mà không cần hỏi lại.

**Cập nhật lần cuối:** 27/10/2026 (Tách biệt KPI BE Corp & Credit, tính chu kỳ sao kê riêng, thêm Bảng tổng hợp ngân sách đa tháng Multi-Month Summary)  
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

## 2. Giao diện & Tính năng đã hoàn thiện

### 2.1 Top Banner (Dark Navy Curved Header)
* **Màu sắc:** Nền Dark Navy (`#132247`) với góc bo cong đặc trưng phía dưới bên phải (`rounded-br-[36px] sm:rounded-br-[48px]`).
* **Logo & Title:** Logo tròn 2 lớp (HM), tiêu đề "Billing dashboard for Heo & Mèo", nhãn phụ `HEOMEO.FINANCE`.
* **Action Buttons:**
  - Nút tím nhạt Lavender: "Xem sổ chi tiết" / "Về Dashboard".
  - Nút tím đậm Dark Purple: "+ Thêm giao dịch" mở popup nhập liệu nhanh.

### 2.2 Floating Filter Bar
* Thanh lọc nổi với nền trắng, viền mảnh:
  - **Dropdown Kỳ thống kê:** Icon lịch 📅 chọn theo tháng (T4/26 -> T10/26 hoặc Tất cả).
  - **Dropdown Danh mục:** Lọc nhanh theo danh mục chi tiêu (`Ăn uống`, `Tiết kiệm`, `Thuê nhà`,...).
  - **Nhãn chu kỳ hiển thị trực quan:** Ghi rõ chu kỳ áp dụng cho kỳ đang chọn (`Chu kỳ BE: 26/09 – 25/10 · Sao kê Credit: 20/09 – 19/10`).

### 2.3 Bộ 5 KPI Summary Cards (Đã tách riêng BE Corp & Credit, Bỏ nhãn "in home currency")
Đã tách biệt 2 nguồn tiền BE Corp và Thẻ tín dụng thành 2 card riêng biệt và gỡ bỏ toàn bộ dòng chữ dư thừa `in home currency`:
1. **Card 1 - Xanh Navy Sâu (`#0B4B8A`):** Tổng thu nhập (`kpiStats.effectiveIncome`), click để mở nhanh form ghi thu.
2. **Card 2 - Xanh Dương Đại Dương (`#0077B6`):** Tổng chi tiêu (`kpiStats.totalExpense`), tính theo tháng lịch (01 đến cuối tháng).
3. **Card 3 - Đỏ San hô / Xanh Ngọc Net Balance (`#DC2626` / `#059669`):** Số dư khả dụng Net (`Thu - Chi còn lại`).
4. **Card 4 - Cam Hổ Phách Amber (`#D97706`):** **Ví BE Corp riêng biệt**, tính đúng theo chu kỳ BE (Mặc định: Ngày 26 tháng trước -> Ngày 25 tháng này).
5. **Card 5 - Tím Violet Purple (`#6D3894`):** **Thẻ tín dụng (Credit) riêng biệt**, tính đúng theo chu kỳ sao kê thẻ (Mặc định: Ngày 20 tháng trước -> Ngày 19 tháng này).

### 2.4 Bảng tổng hợp ngân sách đa tháng (Multi-Month Summary Table)
Giải quyết nhu cầu xem đồng thời nhiều tháng từ sheet `Summary` trên Google Sheets:
* **Đối chiếu ma trận ngang:** Hiển thị toàn bộ các tháng có dữ liệu (T4/26 -> T10/26) trên cùng 1 bảng.
* **Các chỉ số tài chính:**
  - `Thu nhập / Budget`
  - `Chi sinh hoạt`
  - `Tiết kiệm / Đầu tư`
  - `Tổng chi tiêu` (Hàng đậm)
  - `Còn lại (Remaining)` (Kèm tag xanh lá nếu dư, tag đỏ nếu âm)
  - `Tỷ lệ tiêu / Ngân sách` (% used)
  - `Ví BE Corp (Chu kỳ)`
  - `Thẻ Credit (Sao kê)`
* **Thống kê bổ sung:** Cột `Trung bình` mỗi tháng và cột `Tổng cộng`.
* **Tương tác thông minh:** Click vào bất kỳ cột tháng nào trong bảng để lọc nhanh Dashboard sang tháng đó. Có nút thu gọn/mở rộng bảng.

### 2.5 Hàng biểu đồ giữa (Middle Row)
* **Bên trái (Horizontal Bar Chart - 60%):** Biểu đồ thanh ngang màu xanh Cyan (`#38BDF8`) hiển thị Top các danh mục chi tiêu lớn nhất.
* **Bên phải (Coral Donut Chart - 40%):** Biểu đồ hình tròn khuyết với dải màu san hô / hồng đào hiển thị tỷ trọng chi tiêu.

### 2.6 Hàng bảng dữ liệu đáy (Bottom Dual Tables)
* **Bảng trái ("Tổng hợp chi tiêu theo phân loại"):** Ma trận Danh mục vs Phương thức thanh toán (Tiền mặt/Ví, BE Corp, Credit, Tổng chi).
* **Bảng phải ("Giao dịch chi tiêu gần nhất"):** Danh sách giao dịch chi tiêu mới nhất kèm CategoryBadge.

---

## 3. Quản lý Chu kỳ & Logic ngày (Cycle Configuration)

Được đóng gói tại `src/utils/cycleUtils.ts`:
- **Thu nhập & Chi tiêu thông thường:** Theo tháng dương lịch (Từ ngày `01` đến ngày cuối cùng `30/31`).
- **Ví BE Corp:** Chu kỳ từ ngày `26` tháng trước đến ngày `25` tháng này.
- **Thẻ tín dụng Credit:** Chu kỳ sao kê từ ngày `20` tháng trước đến ngày `19` tháng này.
- Hàm `getBillingCycleRange(monthKey, startDay, endDay)` tự động xử lý chuyển giao tháng (cross-month).
- Hàm `isDateInCycle(dateStr, range)` lọc chính xác các giao dịch thuộc chu kỳ.

---

## 4. Tình trạng kết nối Google Sheet (Sync Status)

- **Trạng thái hiện tại:** App đang chạy với **Dữ liệu mẫu Seed Data** nội bộ (1,235 giao dịch lịch sử từ file seed đính kèm trong repo).
- **Để đồng bộ Live với Google Sheet của bạn:**
  1. Chuyển sang tab **Google Sheet (Chưa sync)** trên thanh điều hướng app.
  2. Nhấn **"Đăng nhập Google"** để cấp quyền đọc/ghi.
  3. Dán đường link Google Sheet cá nhân (chứa các sheet `Thu chi`, `Check tiền`, `Summary`).
  4. App đã hỗ trợ tự động nhận diện tab `Summary` / `Tổng hợp` và tab `Check tiền` để tải dữ liệu ngân sách và cấu hình chu kỳ.

---

## 5. Bản đồ File dự án

```
src/
├── App.tsx                              # Main layout, 5 KPI cards riêng biệt, Header bo cong, Filter bar
├── index.css                            # Palette màu mới, font tokens, scrollbar styling
├── components/
│   ├── MultiMonthSummaryTable.tsx       # MỚI: Ma trận đối chiếu ngân sách đa tháng (Budget, Chi, Remaining)
│   ├── DashboardDualTables.tsx          # 2 bảng dữ liệu song song đáy Dashboard chuẩn ảnh mẫu
│   ├── AnalyticsCharts.tsx              # Horizontal Cyan Bar Chart + Coral Donut Chart
│   ├── TransactionLedgerTable.tsx       # Bảng sổ cái đầy đủ 6 cột chuẩn Google Sheet
│   ├── AddTransactionModal.tsx          # Modal thêm giao dịch mới
│   ├── ReconcileCheckTienView.tsx       # Màn hình Check tiền & đối soát số dư ví/thẻ
│   └── SheetSyncPanel.tsx               # Màn hình kết nối & đồng bộ Google Sheets 2 chiều
├── services/
│   ├── firebaseAuth.ts                  # Google OAuth & Firebase Auth
│   └── googleSheetsService.ts           # Fetch & Append Google Sheets API (với fetchSummarySheet)
├── types/
│   └── finance.ts                       # Định nghĩa TypeScript cho giao dịch, tài khoản, cấu hình chu kỳ
└── utils/
    ├── cycleUtils.ts                    # MỚI: Tính toán chu kỳ ngày riêng cho BE Corp (26-25) & Credit (20-19)
    ├── categoryIcons.tsx                # Mapping 20+ danh mục tiếng Việt với icon Lucide & màu
    ├── csvParser.ts                     # Parser CSV, format tiền tệ VNĐ, ngày tháng
    └── quickEntry.ts                    # Phân tích tần suất chi tiêu, gợi ý số tiền thông minh
```

---

## 6. Hướng dẫn tiếp tục làm việc & phối hợp với Hermes

- **Trên Windows (Antigravity):**
  - Node.js portable: `C:\Users\huynq\node-v20.18.0-win-x64`
  - Chạy dev: `npm run dev`
  - Build: `npm run build`
  - Push lên GitHub: `git push origin main`
- **Trên Linux (Hermes):**
  - Trước khi code: Chạy `git pull origin main`
  - Sau khi xong: Commit và push lại lên GitHub để đồng bộ song song 2 bên.
