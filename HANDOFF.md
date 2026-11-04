# HANDOFF — Heo & Mèo Finance (Expense-Income-Tracker)

> **Tài liệu bàn giao phiên làm việc.** Khi chuyển sang tài khoản Gemini mới hoặc agent khác (Antigravity / Hermes) tiếp nhận, chỉ cần đọc file này là nắm toàn bộ bối cảnh, kiến trúc giao diện mới và tiếp tục công việc ngay lập tức mà không cần hỏi lại.

**Cập nhật lần cuối:** 03/11/2026 (Hoàn tất MoM Breakdown trong Báo cáo tháng, Smart Filter Chips trong Sổ giao dịch, Privacy Mode mặc định ON, Pacing Alert tối ưu hóa)  
**Repo GitHub:** https://github.com/nguyenquochuydl96/Expense-Income-Tracker  
**Live Website URL:** https://nguyenquochuydl96.github.io/Expense-Income-Tracker/  
**Firebase Project:** `heomeo-finance` (`heomeo-finance.firebaseapp.com`)  
**Đường dẫn Local:** `C:\Users\huynq\.gemini\antigravity\scratch\Expense-Income-Tracker`  
**Git Author:** `Nguyen Quoc Huy <nguyenquochuy.dl96@gmail.com>`

---

## 1. Tổng quan dự án

Ứng dụng **Heo & Mèo Finance**: Web app quản lý thu chi cá nhân, đối soát số dư và dòng tiền kết nối đồng bộ trực tiếp 2 chiều với Google Sheets API và Firebase Auth.

### Stack kỹ thuật
- **Frontend:** React 19.0.1 + Vite 8.3.0
- **Ngôn ngữ:** TypeScript 7.0.2
- **Styling:** Tailwind CSS 4.3.3 (plugin `@tailwindcss/vite`)
- **Icons & Animation:** Lucide-react (0.546.0), Motion (12.43.0), `@animate-ui/react` (2.4.2)
- **UI Utilities:** `clsx` (2.1.1) + `tailwind-merge` (3.7.0) gói trong hàm tiện ích `cn()` tại `src/utils/cn.ts`
- **Tiêu chuẩn phát triển:** Tuân thủ `UI_UX_AND_DEV_GUIDE.md` (Impeccable UI/UX & Superpowers TDD/Spec-first)
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

### 2.6 Tối giản Dashboard (Đã lược bỏ Bottom Dual Tables)
* Đã gỡ bỏ 2 bảng ở đáy Dashboard (*"Tổng hợp chi tiêu theo phân loại"* và *"Giao dịch chi tiêu gần nhất"*). 
* Toàn bộ dữ liệu ngân sách theo danh mục đã được tập trung trọn vẹn trong **Bảng Ngân sách Hạng mục (`CategoryBudgetTable`)**, và lịch sử chi tiêu đã có riêng tab **Sổ giao dịch** cùng lịch **Calendar Heatmap View**, giúp Dashboard thoáng gọn, tinh gọn và tối ưu trải nghiệm cuộn trang trên mobile.

### 2.7 Tính năng Riêng tư & Bảo mật hiển thị (Privacy Mode by Default)
* **Mặc định BẬT khi mở app (`globalPrivacyMode = true`):** Mọi số tiền (KPIs, số dư ví, ngân sách, danh sách giao dịch, thẻ đối soát) được che dấu an toàn thành `••••••` ngay khi mở app trên công ty hoặc nơi đông người.
* **Phím tắt nhanh `Alt + P`:** Bật / tắt chế độ riêng tư tức thì mọi lúc.
* **Bảo vệ xóa:** Hộp thoại xác nhận xóa luôn hiển thị số tiền thực tế để người dùng tránh xóa nhầm giao dịch.

### 2.8 Báo cáo Tháng (Monthly Report Card) & So sánh MoM Ngưỡng 5%
* **Vị trí tích hợp:** Tích hợp trực tiếp vào popup **Báo cáo tháng (`MonthlyReportCardModal.tsx`)** — không làm phát sinh thêm tab.
* **Tách bạch Tiết kiệm / Tích lũy khỏi Chi tiêu Sinh hoạt (Không đánh đồng thành Thâm hụt):**
  - Nhận diện các khoản thuộc danh mục `Tiết kiệm`, `Tích lũy`, `Đầu tư` (`isSavingsCategory`).
  - **Logic đánh giá sức khỏe tài chính thông minh:**
    - Nếu chi tiêu sinh hoạt không vượt thu nhập (`livingRemaining >= 0`), ngay cả khi dòng tiền ví tạm thời âm nhẹ do chủ động gửi tiết kiệm nhiều (như Tháng 10: thu 53.8M, sinh hoạt 35.5M, gửi tiết kiệm 20M, tiền mặt -1.64M), hệ thống đánh giá: `💎 Tích lũy vượt mức — Dòng tiền mặt âm nhẹ` (badge tím Indigo `Đã trích tiết kiệm: 37.2%`), tuyệt đối **không** báo động "Thâm hụt ngân sách / Cần hãm phanh chi tiêu".
    - Chỉ báo động thâm hụt sinh hoạt khi chi tiêu sinh hoạt thuần túy vượt quá thu nhập (`livingRemaining < 0`).
  - **Tách riêng Top Hạng mục Sinh hoạt & Banner Tiết kiệm:**
    - Khối nổi bật màu xanh ngọc (Emerald): `🏦 Đã trích gửi Tiết kiệm / Tích lũy` (hiển thị số tiền và % thu nhập).
    - Top 3 hạng mục hiển thị chuẩn xác **Top Chi Tiêu Sinh Hoạt** (Ăn uống, Thuê nhà,...) thay vì bị Tiết kiệm chiếm mất vị trí #1.
  - **Món chi sinh hoạt lớn nhất (Highlights Box):**
    - Lọc bỏ hoàn toàn các giao dịch thuộc danh mục hoặc tên món hàng liên quan đến `Tiết kiệm`, `Tích lũy`, `Đầu tư`, `Chỉ vàng`, `Cây vàng` (`isSavingsRecord`).
    - Chỉ hiển thị món chi tiêu **sinh hoạt tiêu dùng thực tế lớn nhất** của tháng (ví dụ: Thuê nhà, Mua sắm sinh hoạt), không còn bị nhầm lẫn hiển thị các khoản mua vàng tích lũy hay gửi tiết kiệm (như "Chỉ vàng mẹ Hiền" hay "Cho mượn").
  - **3 Thẻ KPI Metrics phản ánh chân thực:**
    - Card `Chi tiêu`: Nền Slate/Indigo dịu mắt khi sinh hoạt trong tầm kiểm soát, chỉ đỏ khi sinh hoạt vượt thu nhập; có dòng chú thích `Sinh hoạt: X · TK: Y`.
    - Card `Còn lại`: Nền Xanh dương khi dư tiền mặt, Nền Vàng cam hổ phách khi âm nhẹ do đã trích gửi tiết kiệm (kèm note `Đã gửi TK: 20M`), và Đỏ khi thực sự thâm hụt sinh hoạt.
* **Hệ thống Màu Đèn Giao Thông MoM Ngưỡng 5% ($T$ vs $T-1$):**
  - **Chi tiêu (Tổng chi):**
    - Giảm chi $> 5\%$ ($<-5\%$): 🟢 Xanh lá (`text-emerald-300`, badge `📉 Tiết kiệm hơn`).
    - Tăng chi $> 5\%$ ($>+5\%$): 🔴 Đỏ (`text-rose-400`, badge `📈 Chi nhiều hơn`).
    - Dao động trong $\pm 5\%$: 🟡 Vàng cam (`text-amber-300`, badge `⚖️ Chi tiêu ổn định`).
  - **Thu nhập (Tổng thu):**
    - Tăng thu $> 5\%$ ($>+5\%$): 🟢 Xanh lá (`text-emerald-300`).
    - Giảm thu $> 5\%$ ($<-5\%$): 🔴 Đỏ (`text-rose-400`).
    - Dao động trong $\pm 5\%$: 🟡 Vàng cam (`text-amber-300`).
* **Đồng bộ đa kênh:**
  - Hiển thị trực quan trong modal.
  - Tự động xuất hiện trong nội dung copy tóm tắt nhanh gửi qua Telegram / Zalo (`handleCopySummary`).
  - Tự động vẽ vào thiệp ảnh PNG chất lượng cao để tải về máy hoặc chia sẻ (`handleDownloadImage`, canvas tự mở rộng chiều cao, text wrapping an toàn).

### 2.9 Bộ lọc thông minh 1 chạm (Smart Quick Filter Chips) trong Sổ giao dịch
* **Vị trí tích hợp:** Ngay dưới thanh tìm kiếm của **Sổ cái (`TransactionLedgerTable.tsx`)**.
* **Các nút lọc 1 chạm (Toggle Chips):**
  - `⚡ Món lớn (≥ 1M)`: Lọc tức thì các khoản chi $\ge 1.000.000\text{ ₫}$.
  - `🏖️ Cuối tuần (T7 & CN)`: Lọc các khoản chi phát sinh vào thứ 7 và Chủ nhật.
* **Cơ chế:** Bấm để bật, bấm lại để tắt; có nút "Bỏ lọc thông minh" và tích hợp mượt mà với nút "Xóa lọc" tổng.
* **Tối ưu trải nghiệm:** Giữ nguyên 4 tab chính (`Dashboard`, `Sổ giao dịch`, `Check tiền & Đối soát`, `Đồng bộ`), loại bỏ hoàn toàn tình trạng tab bloat.

### 2.10 Cải tiến Cảnh báo Nhịp độ chi tiêu sinh hoạt (Pacing Alert)
* **Loại trừ định phí cố định:** Không cảnh báo lạm phát nhịp độ đối với `Thuê nhà` và `Tiết kiệm` (các khoản chi cố định 1 lần/tháng), chỉ tập trung giám sát các danh mục chi tiêu thường nhật/daily.
* **Tương phản màu sắc:** Hoàn thiện màu chữ đậm trên nền nhạt ở cả chế độ sáng (Light) và tối (Dark), khắc phục triệt để hiện tượng chữ vàng nhạt chìm vào nền trắng.

### 2.11 Bộ lọc Đa tháng Tự do (Multi-Month Checkbox Picker)
* **Vị trí tích hợp:** Thay thế thẻ `<select>` đơn tháng ở thanh **Floating Filter Bar** bằng component dropdown đa năng [`MultiMonthPickerDropdown.tsx`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/components/MultiMonthPickerDropdown.tsx).
* **Trải nghiệm người dùng:**
  - Cho phép **tick chọn nhiều tháng bất kỳ** cùng một lúc (ví dụ: tick T8 + T9 + T10).
  - Có các nút bấm nhanh: `Tất cả các tháng`, `Tháng mới nhất`, `3 tháng gần nhất`.
  - Mỗi hàng tháng có checkbox tùy chọn kèm số lượng giao dịch và nút `Chỉ xem` hiển thị khi hover để chọn riêng 1 tháng trong 1-click.
  - Tự động đóng khi bấm ra ngoài hoặc ấn phím `Escape`.
* **Hiệu ứng lan tỏa toàn app:**
  - **Sổ giao dịch (`TransactionLedgerTable`):** Lọc và hiển thị toàn bộ giao dịch của các tháng được tick, tiêu đề hiển thị rõ tên các tháng đang lọc.
  - **KPIs Dashboard:** Thu nhập, chi tiêu, số dư ròng, ví BE Corp và Thẻ tín dụng Credit tự động gộp theo chu kỳ của tất cả các tháng đã tick.
  - **Bảng Ngân sách Hạng mục (`CategoryBudgetTable`):** Tự động tính gộp Định mức, Đã chi, Còn lại cho giai đoạn nhiều tháng và highlight các cột tương ứng trong Ma trận 7T.
  - **Bảng Tổng hợp Đa tháng (`MultiMonthSummaryTable`) & Biểu đồ (`AnalyticsCharts`):** Cho phép nhấp trực tiếp vào tên cột/cột biểu đồ để bật/tắt (toggle) tháng đó vào bộ lọc chung.

### 2.12 Đồng bộ Toàn diện Dark Mode trên các Bảng số liệu & Lịch trực quan
* **Xử lý triệt để Light Leaks:**
  - `src/App.tsx`: Thay thế style nền cứng `style={{ backgroundColor: '#EEF2F6' }}` bằng class Tailwind linh hoạt `bg-[#EEF2F6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors`.
  - [`TransactionLedgerTable.tsx`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/components/TransactionLedgerTable.tsx): Bổ sung đầy đủ dark styling cho container, thanh công cụ tìm kiếm, filter chips, dropdown danh mục, thead, từng ô tbody và phân trang.
  - [`MultiMonthSummaryTable.tsx`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/components/MultiMonthSummaryTable.tsx): Hoàn thiện dark mode cho toàn bộ ma trận, đặc biệt là các cột dính cố định (`sticky left-0`) với nền `dark:bg-slate-900` đồng nhất, không còn viền trắng chói mắt khi cuộn ngang.
  - [`CategoryBudgetTable.tsx`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/components/CategoryBudgetTable.tsx): Đồng bộ nền dark mode cho cả chế độ xem chi tiết tháng và ma trận lũy kế đa tháng, bao gồm cả bảng giao dịch drill-down và ô nhập % budget khi chỉnh sửa.
  - [`CalendarHeatmapView.tsx`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/components/CalendarHeatmapView.tsx): Cung cấp hệ thống màu nhiệt độ chi tiêu (heat styles) chuyên biệt cho Dark Mode (`dark:bg-emerald-950/40`, `dark:bg-sky-950/40`, `dark:bg-amber-950/40`, `dark:bg-rose-950/50`) cùng popover chi tiết ngày thân thiện với mắt trong đêm.

### 2.13 Khả năng truy cập phím tắt (Universal Escape Listener) & Tối ưu Typography Mobile
* **Phím tắt `Escape` đóng nhanh:**
  - Tích hợp `useEffect` lắng nghe sự kiện phím `Escape` ở cấp cao nhất (tuân thủ 100% Rules of Hooks) trên toàn bộ 5 popup modal:
    1. [`AddTransactionModal.tsx`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/components/AddTransactionModal.tsx)
    2. [`EditTransactionModal.tsx`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/components/EditTransactionModal.tsx)
    3. [`MonthlyReportCardModal.tsx`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/components/MonthlyReportCardModal.tsx)
    4. [`TelegramBotModal.tsx`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/components/TelegramBotModal.tsx)
    5. [`PwaInstallModal.tsx`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/components/PwaInstallModal.tsx)
* **Chống cắt chữ số KPI trên màn hình nhỏ:**
  - Tinh chỉnh cỡ font số tiền tại cả 5 thẻ KPI tổng (`kpiStats`) và 5 thẻ KPI hạng mục (`categoryKpiStats`) từ `text-2xl sm:text-3xl` thành `text-xl sm:text-2xl lg:text-3xl` font-mono-tabular, đảm bảo hiển thị trọn vẹn số tiền lên tới hàng trăm triệu/tỷ trên mọi dòng smartphone < 400px.

### 2.14 Chuẩn hóa Tiện ích `cn()` & Nâng cấp Hệ sinh thái Animation
* Khởi tạo [`src/utils/cn.ts`](file:///C:/Users/huynq/.gemini/antigravity/scratch/Expense-Income-Tracker/src/utils/cn.ts) kết hợp `clsx` và `tailwind-merge` để xử lý class có điều kiện chuẩn xác.
* Nâng cấp `motion` lên `^14.9.0` trong `package.json` giải quyết triệt để xung đột peer dependency với `@animate-ui/react@2.4.2`.
* Tích hợp tài liệu hướng dẫn chuẩn mực UI/UX vào `GEMINI.md` và `UI_UX_AND_DEV_GUIDE.md`.

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

---

## 7. Hướng dẫn Public Web & Sử dụng (Deploy)

Dự án đã được cấu hình sẵn 2 phương thức public lên web hoàn toàn miễn phí:

### Cách 1: GitHub Pages (Tự động sẵn từ GitHub)
1. Workflow CI/CD đã tạo sẵn tại `.github/workflows/deploy.yml`.
2. Vào GitHub repo của bạn: `Settings` $\rightarrow$ `Pages` (bên cột trái).
3. Tại mục **Build and deployment** $\rightarrow$ **Source**: Chọn **`GitHub Actions`**.
4. GitHub sẽ tự động build và public web tại:  
   👉 `https://nguyenquochuydl96.github.io/Expense-Income-Tracker/`

### Cách 2: Vercel (Khuyên dùng — Cực nhanh & Mượt nhất)
1. Truy cập https://vercel.com/new và đăng nhập bằng tài khoản GitHub của bạn.
2. Tìm và chọn repository `Expense-Income-Tracker` $\rightarrow$ Bấm **Deploy**.
3. Sau khoảng 30 giây, bạn sẽ nhận được một đường link web cá nhân (ví dụ: `https://expense-income-tracker-xxx.vercel.app`) để truy cập trên cả máy tính lẫn điện thoại di động!

*Lưu ý khi dùng tính năng Đăng nhập Google (OAuth):* Khi deploy lên domain mới (GitHub Pages hoặc Vercel), hãy copy tên miền đó và thêm vào mục **Authorized Domains** trong Google Cloud Console / Firebase Console để cấp phép đăng nhập Google.
