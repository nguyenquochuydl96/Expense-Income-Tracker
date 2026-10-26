# Ứng Dụng Quản Lý Tài Chính & Đối Soát Dữ Liệu Google Sheets (Heo & Mèo Finance)

Ứng dụng quản lý chi tiêu, thu nhập và đối soát dòng tiền cá nhân được thiết kế chuyên biệt dựa trên cấu trúc sổ cái Google Sheet hiện tại của bạn (`Expenses`, `Income`, và `Check tiền`). Hệ thống vừa nạp sẵn dữ liệu lịch sử đính kèm để hoạt động tức thì, vừa kết nối trực tiếp với Google Sheets API để đọc toàn bộ các sheet và tự động ghi nối tiếp (`append`) giao dịch mới vào cuối bảng mà không làm thay đổi định dạng hay công thức gốc.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Dưới đây là các quyết định thiết kế cốt lõi đã được thống nhất từ phản hồi của bạn, cùng cơ chế xử lý chu kỳ **BE Corp**, **Credit** và tính năng **Check tiền (Reconcile)**:

- **Kết nối dữ liệu kép (Confirmed)**: Nạp sẵn toàn bộ lịch sử từ file đính kèm làm dữ liệu mặc định tức thì, đồng thời tích hợp **Google Sheets OAuth API** để đồng bộ thời gian thực cả 3 bảng `Expenses`, `Income` và `Check tiền` khi kết nối với Google Sheet của bạn.
- **Cấu trúc bảng `Expenses` & `Income` (Confirmed)**: Giữ nguyên tuyệt đối cấu trúc 6 cột chuẩn (`Purchase Date`, `Category`, `Purchase Item`, `Amount`, `BE Corp`, `Credit` + cột ghi chú mở rộng nếu có). Khi lưu giao dịch mới, ứng dụng chỉ sử dụng phương thức `values.append` để chèn dòng mới vào cuối bảng, tuyệt đối không xóa hay ghi đè lịch sử cũ.
- **Xử lý danh mục `Tiết kiệm` (Confirmed)**: Coi `Tiết kiệm` (mua vàng, chứng khoán, bỏ heo...) là một danh mục chi tiêu chính thức trong tổng chi tiêu (`Amount`), đồng thời hỗ trợ bộ lọc nhanh để xem riêng hoặc loại trừ tạm thời khi muốn phân tích chi phí sinh hoạt thuần túy.
- **Chu kỳ tính `BE Corp`, `Credit` & Tính năng `Check tiền` (Reconcile) (Confirmed)**:
  - Khi kết nối Google Sheet, ứng dụng sẽ tự động đọc nội dung và công thức/giá trị từ sheet **`Check tiền`** để hiển thị bảng đối soát gốc đồng thời cho phép cấu hình ngày chốt sao kê/chu kỳ tính của **BE Corp** và **Credit**.
  - Cung cấp công cụ **Check Tiền (Đối Soát Thực Tế)**: Bạn nhập số dư thực tế đang có ở các tài khoản/ví ngoài đời thực (Ngân hàng, Tiền mặt, Ví BE, Hạn mức/Dư nợ Credit chưa thanh toán...). Hệ thống tự động đối chiếu với **Số dư lý thuyết** (`Tổng Thu - Tổng Chi + Khoản cấn trừ BE Corp / Credit theo chu kỳ`) để tính ra chính xác **Số tiền lệch (Discrepancy)**. Nếu phát hiện lệch (do quên ghi chép), bạn có thể bấm 1 nút để tự động tạo phiếu ghi nhận khoản *"Lệch tiền / Thất lạc chưa nhớ"* vào bảng `Expenses`.

---

### 1. Overview & Core Concept

- **What It Does**: Nền tảng quản trị tài chính gia đình (Heo & Mèo) kết hợp giữa sổ cái chi tiêu hàng ngày, biểu đồ phân tích dòng tiền đa chiều và bàn làm việc đối soát số dư thực tế (`Check tiền`).
- **Target Audience / Persona**: Người dùng cá nhân/cặp đôi đã có thói quen quản lý tài chính chi tiết trên Google Sheets, cần một giao diện nhập liệu nhanh, trực quan hóa dữ liệu lịch sử (từ tháng 4/2026 đến tháng 10/2026+) và kiểm tra lệch tiền định kỳ.
- **Key Value**:
  - Nhập liệu cực nhanh đúng chuẩn cột Google Sheet mà không sợ làm hỏng công thức hay dữ liệu cũ.
  - Theo dõi sát sao các khoản chi qua **BE Corp** và thẻ **Credit** theo đúng chu kỳ chốt sổ.
  - Phát hiện ngay lập tức khoản tiền bị thất lạc/quên ghi chép thông qua công cụ Reconcile (`Check tiền`).

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Khởi động & Đồng bộ**: Mở ứng dụng thấy ngay Dashboard tháng hiện tại (Tháng 10/2026) từ dữ liệu lịch sử có sẵn. Trên thanh công cụ, người dùng có thể bấm **"Kết nối Google Sheet"**, đăng nhập Google và dán link/ID file Sheet để đồng bộ trực tiếp cả 3 tab `Expenses`, `Income`, và `Check tiền`.
  2. **Thêm Giao Dịch Mới (Add Form)**: Chọn tab *Chi tiêu (`Expenses`)* hoặc *Thu nhập (`Income`)*, nhập Ngày (`M/D/YYYY`), Danh mục (gợi ý sẵn 12 danh mục lịch sử như *Ăn uống, Thuê nhà, Hóa/Mỹ phẩm, Thú cưng, Giải trí Heo, Giải trí Mèo, Điện thoại/Xăng xe, Tiết kiệm, Quà tặng/Cưới hỏi, Shopping, Sức khỏe, Du lịch, Khác*), Nội dung, Số tiền (`Amount`), kèm tùy chọn nhập số tiền cấn trừ vào cột **BE Corp** hoặc **Credit** (nút gán nhanh 100% sang BE Corp hoặc Credit). Bấm Lưu sẽ cập nhật ngay lập tức lên UI và đẩy dòng mới vào cuối bảng trên Google Sheet.
  3. **Khám phá Dashboard & Biểu đồ**: Chuyển đổi linh hoạt giữa các tháng (`Tháng 4/2026` – `Tháng 10/2026` hoặc `Tất cả`). Xem 4 thẻ KPI chính: *Tổng Thu*, *Tổng Chi (gồm Tiết kiệm)*, *Số Dư Tháng*, và *Tổng phát sinh BE Corp / Credit trong kỳ*. Tương tác với Biểu đồ tròn phân bổ danh mục và Biểu đồ cột dòng tiền theo tháng.
  4. **Đối Soát Thực Tế (`Check tiền` / Reconcile)**: Mở tab **Check Tiền**, xem dữ liệu đọc trực tiếp từ sheet `Check tiền` (nếu đã kết nối) kết hợp với Bảng tính Đối Soát Thực Tế: nhập số dư các tài khoản thực tế, kiểm tra chu kỳ BE Corp & Credit, xem số tiền chênh lệch và tạo nhanh giao dịch bù lệch nếu cần.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Thiết kế theo chuẩn **Modern Financial Ledger SaaS** — tinh gọn, sắc nét, mật độ thông tin cao nhưng thoáng mắt, sử dụng đường kẻ mảnh (`1px solid`) phân tách vùng dữ liệu rõ ràng, không lạm dụng thẻ lồng thẻ hay hiệu ứng rườm rà.
  - *Color Palette & Mood*:
    - Nền chính (`--background`): Trắng ngà sắc nét / Xám lạnh sáng (`#F8FAFC`) giúp bảng số liệu dễ đọc trong thời gian dài.
    - Bề mặt cấu trúc (`--surface`): Trắng tinh (`#FFFFFF`) với viền mảnh `#E2E8F0`.
    - Điểm nhấn chính (`--primary`): Xanh lục bảo đậm (`#0F766E` / `#0D9488`) biểu trưng cho sự chuẩn xác tài chính.
    - Ngữ nghĩa số liệu: Thu nhập / Dư dương (`#16A34A`), Chi tiêu / Cấn trừ (`#E11D48`), BE Corp (`#D97706`), Credit (`#4F46E5`).
  - *Typography & Hierarchy*:
    - Tiêu đề & Điều hướng: `Plus Jakarta Sans` (SemiBold/Bold) hiện đại, rõ ràng.
    - Nội dung & Bảng biểu: `DM Sans` tối ưu khả năng đọc nhanh ở kích thước 13px–15px.
    - Số tiền & Ngày tháng: `JetBrains Mono` kết hợp bắt buộc với `tabular-nums` (`font-variant-numeric: tabular-nums`) giúp các con số hàng triệu, hàng trăm nghìn căn thẳng hàng dọc tuyệt đối.
  - *Component Styling & Layout*:
    - **Top Bar 3 vùng chuẩn mực**: Trái là tên thương hiệu ứng dụng (`Heo & Mèo Finance`), Giữa là 4 mục điều hướng một dòng (`Tổng quan`, `Sổ giao dịch`, `Check tiền & Chu kỳ`, `Đồng bộ Sheet`), Phải là nút hành động chính (`+ Thêm giao dịch`).
    - **Zero-Pill Metadata**: Các thông tin phụ như ngày tháng, danh mục trong danh sách được trình bày bằng chữ tinh gọn kèm dấu phân cách `·`, không bọc trong các khung thuốc (pill badges) sặc sỡ gây rối mắt.

- **Interactive Feedback & Motion**:
  - Phản hồi tức thì ($\le 150\text{ms}$) khi lọc theo tháng, tìm kiếm món hàng, hoặc nhấp vào một lát cắt trên biểu đồ tròn để lọc danh sách giao dịch bên dưới.
  - Hiển thị trạng thái đồng bộ rõ ràng khi đang ghi dòng mới vào Google Sheet kèm thông báo xác nhận.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Kiến trúc Dữ liệu Lai (Hybrid Data Engine: Local CSV Seed + Live Google Sheets API)**
  - *Chosen Approach*: Khởi tạo ứng dụng ngay lập tức với 1.235+ dòng giao dịch từ file đính kèm, đồng thời cung cấp kết nối OAuth Google Sheets (`https://www.googleapis.com/auth/spreadsheets`) để đọc trực tiếp cả 3 sheet (`Expenses`, `Income`, `Check tiền`) và ghi nối tiếp (`append`) dữ liệu mới.
  - *Why*: Đảm bảo bạn luôn xem và sử dụng được đầy đủ số liệu lịch sử ngay khi mở app, đồng thời khi kết nối Google Sheet thì mọi thao tác thêm mới đều được ghi thật vào file gốc trên Google Drive của bạn.
  - *Alternatives Considered*: Chỉ dùng Google Sheets API (sẽ khiến màn hình trống trơn nếu chưa đăng nhập hoặc chưa nhập Spreadsheet ID).

- **Decision 2: Bảo toàn tuyệt đối cấu trúc Google Sheet khi ghi (`APPEND` với `USER_ENTERED`)**
  - *Chosen Approach*: Sử dụng endpoint `spreadsheets.values.append` với tùy chọn `valueInputOption=USER_ENTERED` và `insertDataOption=INSERT_ROWS` vào đúng phạm vi `Expenses!A:F` hoặc `Income!A:F`.
  - *Why*: Giúp Google Sheet tự động hiểu đúng định dạng ngày (`M/D/YYYY`) và định dạng số tiền có dấu phẩy phân cách hàng nghìn giống hệt các dòng lịch sử bạn đã nhập, không bao giờ ghi đè hay làm lệch công thức ở sheet `Check tiền`.

- **Decision 3: Module Đối Soát "Check Tiền" & Chu Kỳ BE Corp / Credit**
  - *Chosen Approach*: Xây dựng không gian đối soát chuyên biệt vừa hiển thị nguyên bản bảng dữ liệu đọc từ sheet `Check tiền` của bạn, vừa cung cấp bộ tính toán đối soát tương tác (nhập số dư thực tế ngân hàng/tiền mặt, tùy chỉnh ngày bắt đầu – kết thúc chu kỳ BE Corp và sao kê Credit).
  - *Why*: Giải quyết triệt để bài toán "chi tiêu ngoài đời thực nhưng quên note vào app", cho phép rà soát từng chu kỳ thẻ/ví công ty và tự động tạo bút toán cân bằng sổ sách.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         TOP NAVIGATION BAR (3-Zone)                          │
│  [Heo & Mèo Finance]     [Tổng quan | Sổ giao dịch | Check tiền | Kết nối]   │
└───────────────────┬──────────────────────────────────────┬───────────────────┘
                    │                                      │
                    ▼                                      ▼
┌─────────────────────────────────────────┐  ┌─────────────────────────────────┐
│       HYBRID DATA & SYNC ENGINE         │  │   QUICK ADD TRANSACTION MODAL   │
│  ┌───────────────────────────────────┐  │  │  • Chọn bảng: Expenses / Income │
│  │ 1. Attached CSV Parser (Default)  │  │  │  • Ngày, Danh mục, Món hàng     │
│  │ 2. Google Sheets API Client       │◄─┼──┤  • Amount, BE Corp, Credit      │
│  │    - Read: Expenses, Income,      │  │  │  • Append trực tiếp cuối Sheet  │
│  │      Check tiền (Metadata & Rows) │  │  └─────────────────────────────────┘
│  │    - Write: values.append (A:F)   │  │
│  └─────────────────┬─────────────────┘  │
└────────────────────┼────────────────────┘
                     │
       ┌─────────────┴─────────────────────────────┐
       ▼                                           ▼
┌──────────────────────────────────────┐  ┌────────────────────────────────────┐
│     DASHBOARD & ANALYTICS VIEW       │  │   "CHECK TIỀN" & RECONCILE VIEW    │
│  • Bộ lọc Tháng/Năm & Tìm kiếm       │  │  • Đồng bộ & hiển thị bảng gốc     │
│  • 4 Thẻ KPI: Thu, Chi, Số dư,       │  │    từ sheet "Check tiền"           │
│    Phát sinh BE Corp & Credit        │  │  • Bộ lọc chu kỳ BE Corp & Credit  │
│  • Biểu đồ Tròn: Cơ cấu Danh mục     │  │  • Bảng nhập Số dư thực tế (Ví,    │
│    (Bao gồm Tiết kiệm)               │  │    Ngân hàng, Tiền mặt, Thẻ)       │
│  • Biểu đồ Cột: Dòng tiền theo tháng │  │  • Tính độ lệch ( Thực tế vs Sổ )  │
│  • Bảng Lịch sử Giao dịch chi tiết   │  │  • Nút "Ghi nhận khoản Lệch tiền"  │
└──────────────────────────────────────┘  └────────────────────────────────────┘
```

#### Data Model & State

- **`TransactionRecord` (`Expenses` & `Income`)**:
  - `id`: Mã định danh dòng (kết hợp tên sheet + số thứ tự dòng).
  - `sheetType`: `'Expenses' | 'Income'`.
  - `purchaseDate`: Chuỗi ngày chuẩn `M/D/YYYY` (ví dụ `10/25/2026`) + đối tượng `Date` đã phân tích để lọc theo tháng/chu kỳ.
  - `category`: Danh mục giao dịch (`Ăn uống`, `Thuê nhà`, `Tiết kiệm`, `Giải trí Heo`, `Giải trí Mèo`, v.v. hoặc danh mục Thu nhập).
  - `purchaseItem`: Nội dung chi tiết khoản thu/chi.
  - `amount`: Số tiền chính (hỗ trợ cả số dương và số âm hoàn/bán đồ như `-3,200,000`).
  - `beCorp`: Số tiền thanh toán qua BE Corp (nếu có).
  - `credit`: Số tiền quẹt thẻ Credit (nếu có).
  - `note`: Ghi chú cột thứ 7 (nếu có, ví dụ `Chị Sơn 40k`).
- **`ReconcileState` (`Check tiền`)**:
  - `rawSheetGrid`: Ma trận dữ liệu 2 chiều đọc trực tiếp từ tab `Check tiền` trên Google Sheet để hiển thị bảng gốc và tự động nhận diện công thức/chu kỳ.
  - `cycleConfig`: Khoảng ngày tính chu kỳ hiện tại cho `BE Corp` và `Credit` (có thể chọn theo ngày chốt sao kê hoặc tháng).
  - `actualBalances`: Danh sách các nguồn tiền thực tế người dùng đang giữ (Tiền mặt, Tài khoản ngân hàng, Ví điện tử...) để so sánh với số dư sổ sách.

#### Interactive Component & State Mapping

- **Bộ lọc Tháng & Chu kỳ**: Thay đổi tháng (`4/2026` → `10/2026` hoặc `Tất cả`) sẽ tính toán lại tức thì 4 thẻ KPI, Biểu đồ tròn danh mục và danh sách giao dịch bên dưới.
- **Tương tác Biểu đồ (Chart Drill-down)**: Nhấp vào bất kỳ danh mục nào trên Biểu đồ tròn (ví dụ `Ăn uống` hoặc `Tiết kiệm`) sẽ lọc ngay bảng giao dịch bên dưới theo đúng danh mục đó để kiểm tra chi tiết từng khoản.
- **Form Nhập Liệu Thông Minh**:
  - Tự động gợi ý các `Purchase Item` thường xuyên nhập (như *Cafe boardgame, Bún nước tương, Cơm tấm, Xe Heo, Xe Mèo...*) và tự động điền `Category` tương ứng dựa trên lịch sử 1.200+ giao dịch của bạn.
  - Khi bấm **Lưu giao dịch**, nếu đã kết nối Google Sheet, hệ thống gọi `POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{sheetName}!A:F:append?valueInputOption=USER_ENTERED` để thêm dòng mới vào cuối bảng.
- **Đối soát & Bù lệch 1 chạm**: Trong màn hình `Check tiền`, khi hệ thống phát hiện `Chênh lệch = Số dư thực tế - Số dư sổ sách != 0`, nút **"Ghi nhận khoản lệch vào Expenses"** sẽ mở sẵn phiếu nhập với danh mục `Khác`, nội dung `Lệch tiền (Check tiền ngày ...)` và số tiền lệch tương ứng để bạn xác nhận lưu vào Sheet.
