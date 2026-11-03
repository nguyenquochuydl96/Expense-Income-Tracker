# UI/UX & Superpowers Development Guidelines for Finance App

> **Mô tả:** Cẩm nang tích hợp các tiêu chuẩn thiết kế UI/UX hiện đại (Tailwind v4, Impeccable Design) và quy trình phát triển chuẩn hóa (Superpowers Spec-first, TDD) dành cho ứng dụng Quản lý Tài chính cá nhân (`Expense-Income-Tracker`).

---

## 1. Tiêu chuẩn Thiết kế UI/UX (Impeccable & Tailwind)
Để đảm bảo ứng dụng tài chính có giao diện sạch sẽ, trực quan, chuyên nghiệp (đạt tiêu chuẩn như các sản phẩm của Linear, Stripe, Vercel):
* **Hệ thống màu sắc (Color Palette):**
  * Sử dụng các tông màu trung tính sạch (Slate / Zinc / Gray) cho nền và chữ.
  * Màu nhấn (Accent): Dùng xanh ngọc (Emerald/Green) cho dòng tiền thu vào / tài sản dương, và đỏ/hồng (Rose/Red) cho các khoản chi tiêu / cảnh báo.
* **Typographic & Spacing:**
  * Phân cấp chữ rõ ràng, dùng font chữ không chân hiện đại (sans-serif).
  * Khoảng cách (padding/margin) phải tuân thủ chuẩn bội số 4px/8px của Tailwind để giao diện thoáng đãng, không bị chật chội.
* **Hiệu ứng & Trạng thái (Feedback):**
  * Mọi nút bấm (buttons), bảng (tables), thẻ card đều phải có hiệu ứng hover mượt mà, bo góc tinh tế (`rounded-xl` hoặc `rounded-2xl`), và bóng đổ nhẹ (`shadow-sm` / `shadow-md`).
  * Luôn có trạng thái trống (Empty state), trạng thái đang tải (Loading state) rõ ràng khi người dùng thao tác với dữ liệu tài chính.

---

## 2. Quy trình Phát triển & Kỷ luật Code (Superpowers)
* **Quy trình chuẩn:** 
  `Idea (Ý tưởng) → Brainstorm (Phân tích) → Plan (Lên kế hoạch) → TDD (Viết test trước) → Implement (Thực thi) → Review (Kiểm tra chất lượng)`
* **Quy tắc cứng (Hard Rules):**
  * **Không code mò:** Mọi tính năng quản lý giao dịch hay biểu đồ thống kê tài chính đều phải có kế hoạch rõ ràng trước khi viết code.
  * **TDD bắt buộc:** Viết test kiểm tra tính đúng đắn của việc tính toán số dư/thu chi trước khi viết code giao diện.
  * **YAGNI & DRY:** Tránh viết code trùng lặp, giữ mã nguồn gọn gàng, dễ bảo trì.
