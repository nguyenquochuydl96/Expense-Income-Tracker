# HANDOFF — Heo & Mèo Finance (Expense-Income-Tracker)

> **Tài liệu bàn giao phiên làm việc.** Khi chuyển sang tài khoản Gemini mới hoặc agent khác (Antigravity / Hermes) tiếp nhận, chỉ cần đọc file này là nắm toàn bộ bối cảnh, kiến trúc giao diện mới và tiếp tục công việc ngay lập tức mà không cần hỏi lại.

**Cập nhật lần cuối:** 27/10/2026 (Khớp 100% dữ liệu Ngân sách & Thu nhập thực tế từ Google Sheet, Tiết kiệm Tháng 10 đạt chuẩn +56k)  
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
  - **Nhãn chu kỳ hiển thị trực quan:** Ghi rõ chu kỳ áp dụng cho kỳ đang chọn (`Chu kỳ BE: 26/09 – 25/10 · Sao kê Credit: 25/09 – 24/10`).

### 2.3 Bộ 5 KPI Summary Cards (Tách riêng BE Corp & Credit, Bỏ nhãn "in home currency", Chuẩn hóa dấu số tiền)
Đã tách biệt 2 nguồn tiền BE Corp và Thẻ tín dụng thành 2 card riêng biệt và gỡ bỏ toàn bộ dòng chữ dư thừa `in home currency`:
1. **Card 1 - Xanh Navy Sâu (`#0B4B8A`):** **Tổng thu nhập** lấy trực tiếp từ các khoản ghi trong tab **`Income`** theo từng tháng riêng biệt (`kpiStats.effectiveIncome`), kèm số lượng khoản thu. Tuyệt đối không áp đặt con số cố định 45m.
2. **Card 2 - Xanh Dương Đại Dương (`#0077B6`):** Tổng chi tiêu (`kpiStats.totalExpense`), tính theo tháng lịch (01 đến cuối tháng).
3. **Card 3 - Đỏ San hô / Xanh Ngọc Net Balance (`#DC2626` / `#059669`):** Số dư khả dụng Net (`Thu - Chi còn lại`). **Số dương hiển thị tự nhiên không có dấu `+` (ví dụ `4,200,000 ₫`), chỉ hiển thị dấu `-` khi âm**.
4. **Card 4 - Cam Hổ Phách Amber (`#D97706`):** **Ví BE Corp riêng biệt**, tính đúng theo chu kỳ BE (Ngày 26 tháng trước -> Ngày 25 tháng này, ví dụ `26/09 – 25/10`).
5. **Card 5 - Tím Violet Purple (`#6D3894`):** **Thẻ tín dụng (Credit) riêng biệt**, tính đúng theo chu kỳ sao kê thẻ (**Ngày 25 tháng trước -> Ngày 24 tháng này**, ví dụ `25/09 – 24/10`).

### 2.4 Bảng tổng hợp ngân sách đa tháng (Multi-Month Summary Table)
Giải quyết nhu cầu xem đồng thời nhiều tháng từ sheet `Summary` trên Google Sheets:
* **Đối chiếu ma trận ngang:** Hiển thị toàn bộ các tháng có dữ liệu (T4/26 -> T10/26) trên cùng 1 bảng.
* **Các chỉ số tài chính:**
  - `Thu nhập (Sheet Income)`: Tổng thu nhập thực tế của từng tháng từ tab `Income` (không dùng số 45m tĩnh).
  - `Chi sinh hoạt`
  - `Tiết kiệm / Đầu tư`
  - `Tổng chi tiêu` (Hàng đậm)
  - `Còn lại (Remaining)` (Kèm tag xanh lá nếu dư, tag đỏ nếu âm)
  - `Lũy kế số dư chuyển tiếp`: Dòng tính tổng dồn số dư khả dụng ròng tích lũy từ tháng đầu tiên đến tháng hiện tại (ví dụ: +6.19m → +7.11m → +11.30m → ... → +24.13m).
  - `Tỷ lệ chi / Thu nhập` (% used)
  - `Ví BE Corp (Chu kỳ 26–25)`
  - `Thẻ Credit (Sao kê 25–24)`
* **Thống kê bổ sung:** Cột `Trung bình` mỗi tháng và cột `Tổng cộng`.
* **Tương tác thông minh:** Click vào bất kỳ cột tháng nào trong bảng để lọc nhanh Dashboard sang tháng đó. Có nút thu gọn/mở rộng bảng.

### 2.5 Bảng Ngân sách & Chi tiêu theo Hạng mục (Multi-Month Rollover Budgeting Engine)
**Vị trí:** Đặt ngay bên dưới Bảng tổng hợp đa tháng, **ưu tiên hiển thị thay thế cho 2 bảng report biểu đồ trước đây**:
* **Nguyên tắc cốt lõi: Budget tổng = Income:**
  - Tổng ngân sách định mức của kỳ/tháng luôn bằng đúng 100% Thu nhập của kỳ/tháng đó (`Total Budget = Income`).
  - Ngân sách từng hạng mục được phân bổ theo **Tỷ lệ phần trăm (%)** từ Tổng thu nhập: `Base_Budget_category = Total_Income * (Percentage / 100)`.
  - Tổng các tỷ lệ % bằng đúng `100.0%`.
* **Cơ chế Lũy kế Cấn trừ Ngân sách qua các tháng (Rollover / Carryover Engine):**
  - Tự động xâu chuỗi tuần tự theo thời gian từ tháng đầu tiên (T4/26) đến tháng mới nhất (T10/26).
  - **Công thức tính cho Tháng T:**
    - `Lũy kế tháng trước (Carryover)` = Số tiền còn lại hoặc bội chi từ Tháng $T-1$.
    - `Ngân sách khả dụng (Effective Budget)` = `Định mức tháng (Base Budget)` + `Lũy kế tháng trước (Carryover)`.
    - **Ví dụ đúng yêu cầu của người dùng:** Nếu tháng 10 ngân sách Tiền ăn là 5.000.000 ₫, chi tiêu 5.500.000 ₫ (bội chi 500.000 ₫) $\to$ qua tháng 11, lũy kế là `-500.000 ₫`, làm ngân sách khả dụng tháng 11 giảm đi đúng 500.000 ₫.
    - `Còn lại chuyển tiếp (Month End Remaining)` = `Ngân sách khả dụng` - `Đã chi tiêu tháng này`.
  - **3 Chế độ cấn trừ linh hoạt tùy chọn:**
    1. *Lũy kế đầy đủ (Mặc định)*: Chuyển toàn bộ số dư (+ tiết kiệm / - bội chi) sang tháng sau.
    2. *Chỉ trừ bội chi (Deficit Only)*: Chỉ khấu trừ khi tháng trước bị tiêu lạm phát (âm), nếu dư thì không cộng dồn.
    3. *Độc lập (None)*: Mỗi tháng tính độc lập theo thu nhập tháng đó.
* **2 Chế độ xem tương tác trực quan:**
  - **Tab 1 - "Chi tiết tháng":** Bảng chi tiết đầy đủ 8 cột cho tháng đang chọn: `Hạng mục`, `Tỷ lệ %`, `Định mức tháng`, `Lũy kế (T trước)`, `Ngân sách khả dụng` (cột trọng tâm), `Đã chi tiêu`, `Còn lại chuyển tiếp`, `Tiến độ chi tiêu`.
  - **Tab 2 - "Ma trận Đa tháng (7T)":** Bảng đối soát ma trận cả 7 tháng cùng lúc, mỗi ô hiển thị `Khả dụng / Đã chi` kèm badge màu thể hiện trạng thái (dư hoặc bội chi) của từng hạng mục qua từng tháng.
* **Tính năng chỉnh sửa linh hoạt:** Nút `Chỉnh % Budget` cho phép tùy chỉnh tỷ lệ % của từng hạng mục trực tiếp trên UI, có bộ đếm kiểm tra tổng = 100% và tự động lưu `localStorage`.
* **Bộ lọc nhanh:** Xem `Tất cả`, `Bội chi`, `Trong hạn mức`.
* **Nút mở Biểu đồ bổ trợ:** Nút `Xem biểu đồ` cho phép mở rộng 2 biểu đồ phân tích (Top chi tiêu & Tỷ trọng) khi người dùng muốn xem.

### 2.6 Hàng bảng dữ liệu đáy (Bottom Dual Tables)
* **Bảng trái ("Tổng hợp chi tiêu theo phân loại"):** Ma trận Danh mục vs Phương thức thanh toán (Tiền mặt/Ví, BE Corp, Credit, Tổng chi).
* **Bảng phải ("Giao dịch chi tiêu gần nhất"):** Danh sách giao dịch chi tiêu mới nhất kèm CategoryBadge.

---

## 3. Quản lý Chu kỳ & Logic ngày (Cycle Configuration)

Được đóng gói tại `src/utils/cycleUtils.ts`:
- **Thu nhập & Chi tiêu thông thường:** Theo tháng dương lịch (Từ ngày `01` đến ngày cuối cùng `30/31`).
- **Ví BE Corp:** Chu kỳ từ ngày `26` tháng trước đến ngày `25` tháng này.
- **Thẻ tín dụng Credit:** Chu kỳ sao kê chuẩn từ ngày **`25` tháng trước đến ngày `24` tháng này**.
- Hàm `getBillingCycleRange(monthKey, startDay, endDay)` tự động xử lý chuyển giao tháng (cross-month).
- Hàm `isDateInCycle(dateStr, range)` lọc chính xác các giao dịch thuộc chu kỳ.

---

## 4. Dữ liệu Thu nhập (Sheet Income) & Seed Data

- **Quy tắc thu nhập:** Thu nhập của mỗi tháng được tính bằng tổng `amount` của tất cả các dòng có `sheetType === 'Income'` thuộc tháng đó (`r.monthKey === selectedMonth`).
- **Seed Data Offline (`src/utils/seedData.ts`):** Được đồng bộ khớp 100% với bảng `Budget / Summary` thực tế trên Google Sheet của người dùng:
  - T4: 45,440,800 ₫
  - T5: 60,246,300 ₫
  - T6: 55,129,000 ₫
  - T7: 53,965,000 ₫
  - T8: 54,065,000 ₫
  - T9: 56,870,000 ₫
  - T10: 53,827,000 ₫
- **Tỷ lệ phân bổ ngân sách 2 giai đoạn (`src/components/CategoryBudgetTable.tsx`):**
  - *Giai đoạn 1 (T4 -> T7):* Tiết kiệm 42.105% (40/95), Thuê nhà 13.684% (13/95), Ăn uống 14.737% (14/95)...
  - *Giai đoạn 2 (T8 -> T10):* Tiết kiệm 39.216% (20/51), Thuê nhà 16.667% (8.5/51), Ăn uống 13.725% (7/51)...
  - **Kết quả đối chiếu:** Khớp tuyệt đối bảng `Remaining Budget` của Google Sheet, trong đó Tiết kiệm T10 còn đúng **+56,696 ₫** (không còn bị âm 6tr do dữ liệu mẫu cũ).
- **Khi kết nối Google Sheet:** Hàm `fetchTabTransactions` sẽ đọc trực tiếp từ tab `Income` của người dùng và thay thế hoàn toàn dữ liệu mẫu.

---

## 5. Bản đồ File dự án

```
src/
├── App.tsx                              # Main layout, 5 KPI cards riêng biệt, Header bo cong, Filter bar
├── index.css                            # Palette màu mới, font tokens, scrollbar styling
├── components/
│   ├── CategoryBudgetTable.tsx          # MỚI: Bảng Ngân sách & Chi tiêu theo Hạng mục (Budget · Đã chi · Còn lại)
│   ├── MultiMonthSummaryTable.tsx       # Ma trận đối chiếu ngân sách đa tháng (Thu nhập Sheet Income, Chi, Remaining)
│   ├── DashboardDualTables.tsx          # 2 bảng dữ liệu song song đáy Dashboard chuẩn ảnh mẫu
│   ├── AnalyticsCharts.tsx              # Horizontal Cyan Bar Chart + Coral Donut Chart (ẩn/hiện theo toggle)
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
    ├── cycleUtils.ts                    # Tính toán chu kỳ ngày riêng cho BE Corp (26-25) & Credit (25-24)
    ├── seedData.ts                      # Dữ liệu Income mẫu đa tháng cho chế độ offline
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
