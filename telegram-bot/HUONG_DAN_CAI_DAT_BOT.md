# 🤖 HƯỚNG DẪN CÀI ĐẶT BOT TELEGRAM NHẬP NHANH (HEO & MÈO FINANCE)

Bot Telegram này được tích hợp trực tiếp vào **Google Sheet** của bạn qua Google Apps Script, hoạt động **24/7 hoàn toàn miễn phí**, không cần bật máy tính hay thuê server.

---

## ⏱️ Thời gian cài đặt: Khoảng 3 - 5 phút (Chỉ làm 1 lần duy nhất)

---

### BƯỚC 1: TẠO BOT TRÊN TELEGRAM (1 PHÚT)
1. Mở ứng dụng Telegram trên điện thoại hoặc máy tính.
2. Tìm kiếm tài khoản chính thức: **`@BotFather`** (có tích xanh).
3. Bấm **Start** (hoặc gửi `/start`), sau đó gửi lệnh:
   ```text
   /newbot
   ```
4. Nhập tên hiển thị cho bot (ví dụ: `Heo Mèo Finance`).
5. Nhập username cho bot (phải kết thúc bằng chữ `bot`, ví dụ: `heomeo_tracker_bot` hoặc `finance_heomeo_bot`).
6. **@BotFather** sẽ trả về một đoạn mã **Token**, có dạng như sau:
   ```text
   7123456789:AAFxAbcDeFgHiJkLmNoPqRsTuVwXyZ12345
   ```
   *(Hãy copy lại đoạn Token này để dùng ở Bước 2).*

---

### BƯỚC 2: DÁN MÃ VÀO GOOGLE APPS SCRIPT (1 PHÚT)
1. Mở file Google Sheet của bạn trên trình duyệt máy tính:
   👉 [Mở Google Sheet Heo Mèo](https://docs.google.com/spreadsheets/d/1CTSEC-J52yGD-VIxOuzyNZ8Qddg0bmOIzMSzRVM6ZTI/edit)
2. Trên thanh menu, chọn: **Tiện ích mở rộng** *(Extensions)* ➔ **Apps Script**.
3. Nếu có mã cũ trong file `Code.gs`, hãy xóa hết đi.
4. Mở file [Code.gs](./Code.gs) trong thư mục này, copy toàn bộ nội dung và dán vào trình soạn thảo Apps Script.
5. Ở đầu file, tìm dòng cấu hình và điền Token bạn vừa lấy ở Bước 1:
   ```javascript
   const CONFIG = {
     // 1. Dán Token của bạn vào đây:
     TELEGRAM_BOT_TOKEN: '7123456789:AAFxAbcDeFgHiJkLmNoPqRsTuVwXyZ12345',
     ...
   ```
6. Bấm nút **Lưu** (icon đĩa mềm 💾 hoặc nhấn `Ctrl + S`).

---

### BƯỚC 3: TRIỂN KHAI ỨNG DỤNG WEB (DEPLOY WEB APP) (1 PHÚT)
1. Ở góc trên bên phải màn hình Apps Script, bấm nút xanh **Triển khai** *(Deploy)* ➔ chọn **Tùy chọn triển khai mới** *(New deployment)*.
2. Bấm vào biểu tượng **Bánh răng ⚙️** (bên cạnh chữ *Chọn loại*) ➔ chọn **Ứng dụng web** *(Web app)*.
3. Cấu hình chính xác như sau:
   * **Mô tả (Description):** `Telegram Bot Heo Meo`
   * **Thực thi dưới dạng (Execute as):** `Tôi` *(Me - nguyenquochuy.dl96@gmail.com)*
   * **Ai có quyền truy cập (Who has access):** `Bất kỳ ai` *(Anyone)* ⚠️ *(Bắt buộc chọn Anyone để Telegram có thể gửi tin nhắn sang Sheet).*
4. Bấm nút **Triển khai** *(Deploy)*.
5. Nếu Google hiển thị cửa sổ **Ủy quyền truy cập** *(Authorization Required)*:
   * Bấm **Xem xét quyền** *(Review Permissions)*.
   * Chọn tài khoản Google của bạn.
   * Nếu có cảnh báo *"Google chưa xác minh ứng dụng này"*, bấm vào **Nâng cao** *(Advanced)* ➔ bấm **Đi tới... (không an toàn)**.
   * Bấm **Cho phép** *(Allow)*.
6. Sau khi triển khai xong, Google sẽ cung cấp **URL ứng dụng web** *(Web App URL)* có đuôi `/exec`.
   * Ví dụ: `https://script.google.com/macros/s/AKfycb.../exec`
   * Hãy bấm **Sao chép** *(Copy)* link này.

---

### BƯỚC 4: KÍCH HOẠT WEBHOOK (30 GIÂY)
1. Quay lại file `Code.gs` trong Apps Script.
2. Dán đường link Web App bạn vừa copy vào dòng `WEBHOOK_URL`:
   ```javascript
   // 2. Dán link Web App vừa copy vào đây:
   WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
   ```
3. Nhấn `Ctrl + S` để lưu lại.
4. Trên thanh công cụ trên cùng (cạnh nút Debug), ở ô chọn hàm, chọn hàm: **`setWebhook`**.
5. Bấm nút **Chạy** *(Run)* ▶️.
6. Xem thanh nhật ký thực thi ở dưới, khi xuất hiện thông báo:
   ```json
   {"ok":true,"result":true,"description":"Webhook was set"}
   ```
   🎉 **Chúc mừng! Bot đã được kết nối thành công 100% với Google Sheet của bạn!**

---

## 💬 CÁCH SỬ DỤNG HÀNG NGÀY

Bạn có thể chat trực tiếp 1-1 với bot, hoặc **tạo 1 nhóm Telegram gồm Bạn + Người yêu (Heo / Mèo) + Bot**:

### 1. Chi tiêu hàng ngày:
* `heo 50k an sang` ➔ Ghi nhận vào danh mục *Ăn uống*, số tiền 50.000đ, người chi: Heo.
* `meo 350k ao shopee` ➔ Ghi nhận vào *Shopping*, số tiền 350.000đ, người chi: Mèo.
* `120k cafe voi ban` ➔ Tự hiểu là *Ăn uống*, 120.000đ.
* `do xang 70.000` ➔ Tự nhận diện vào *Điện thoại/Xăng xe*.

### 2. Chi tiêu bằng BE Corp (Được công ty hỗ trợ):
* `be 80k grab di lam` ➔ Ghi nhận *Điện thoại/Xăng xe*, điền 80.000đ vào cả cột Amount và cột BE Corp.
* `heo 150k taxi di gap khach be` ➔ Ghi nhận BE Corp đầy đủ.

### 3. Quẹt thẻ tín dụng (Credit Card):
* `meo 450k an lau haidilao credit` ➔ Ghi nhận vào cột Credit để đối soát chu kỳ thẻ 25–24.
* `500k uniqlo cr` ➔ Tự hiểu quẹt thẻ Credit.

### 4. Chuyển ngân sách giữa các danh mục (Transfer Budget):
* `transfer 100k giai tri heo sang giai tri meo`
* `chuyen 200k an uong sang shopping`
➔ Bot sẽ tự động tạo **cặp 2 dòng đối ứng** (âm ở nguồn, dương ở đích) giống hệt tính năng Chuyển Budget trên Web App!

### 5. Ghi nhận Thu nhập (Income):
* `income luong heo 28tr`
* `thu 1.5tr ban man hinh cu`
* `thuong du an 3.827.000`
➔ Tự động thêm vào tab `Income` với công thức tự tính tháng chuẩn.

### 6. Các lệnh hữu ích:
* `/check` hoặc `check tien`: Xem ngay số dư các ví tiền thật (Heo & Mèo), số tiền BE Corp còn lại, tổng thẻ Credit chu kỳ này.
* `/undo` hoặc `huy`: Xóa ngay giao dịch vừa nhập nếu lỡ gõ nhầm.
* `/categories`: Xem danh sách tất cả các danh mục chi tiêu & thu nhập hợp lệ.
* `/help`: Xem lại danh sách cú pháp.

---

## 🌟 TÙY CHỌN NÂNG CAO: TÍCH HỢP GEMINI AI (VĂN NÓI TỰ NHIÊN)
Nếu bạn muốn gõ bất kỳ câu nói văn phong tự nhiên nào (ví dụ: *"Hôm nay 2 đứa đi ăn đồ nướng hết 650k quẹt thẻ credit"*):
1. Truy cập [Google AI Studio](https://aistudio.google.com/) và bấm **Get API key** (Miễn phí 100%).
2. Dán API Key vào dòng:
   ```javascript
   GEMINI_API_KEY: 'AIzaSy...',
   ```
3. Lưu và Triển khai lại phiên bản mới (Deploy -> Manage deployments -> Edit -> New version).
Bot sẽ dùng Gemini 2.5 Flash để bóc tách thông tin chuẩn xác tuyệt đối!
