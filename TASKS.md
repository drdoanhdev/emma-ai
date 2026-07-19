# TASKS

Checklist theo `docs/03-roadmap.md`. Tick từng mục khi hoàn thành và test được, không tick trước khi chạy thử thật. Cursor: đọc file này đầu mỗi phiên để biết đang ở đâu, và cập nhật lại sau khi hoàn thành một mục.

## Tuần 1 — Nền tảng + Voice

- [x] Khởi tạo dự án Next.js + TypeScript
- [x] Tạo `data/{child}.json` với `profile` + `mission` tối thiểu (theo schema ở `docs/02-architecture-data.md` mục 2)
- [x] Tích hợp Realtime Voice API (OpenAI Realtime hoặc Gemini Live — chọn 1)
- [x] Màn hình hội thoại tối giản: 1 nút "Nói chuyện với Emma"
- [x] Prompt Builder bản đầu: Personality + Safety + Profile + Mission
- [x] Kiểm tra độ trễ và chất lượng giọng
- [x] **Cho con thử** — ghi chú phản ứng: có thích giọng không, có muốn nói tiếp không

## Tuần 2 — Curriculum + Planner + Weekly Mission

- [x] Tạo `data/curriculum.json` (danh sách Unit tĩnh)
- [x] Viết Planner (code thuần) — xử lý `day_mode`
- [x] Trang phụ huynh: ô nhập Parent Mission + 4 nút chọn `day_mode`
- [x] Prompt Builder: ưu tiên `parent_note` → fallback Curriculum
- [ ] **Cho con thử lại** — so sánh với tuần 1, ghi chú

## Tuần 3–4 — Learning Memory + Review Engine

- [x] Lưu trạng thái từ vựng theo quy tắc bảo thủ (mục 2c) — không "learned" sau 1 lần dùng đúng
- [x] Review Engine: lịch ôn cố định 1/3/7/21 ngày
- [x] Theo dõi `grammar_covered` / `grammar_weak`
- [x] **Không làm** `skill_breakdown` (để dành giai đoạn sau)
- [ ] Test hàng tuần với con, ghi chú vào phần dưới

## Tuần 5 — Preference Memory

- [x] Ghi nhớ sở thích (`preference_memory`) để cá nhân hóa ví dụ/game
- [x] Xác nhận không có trường nào lưu thông tin nhạy cảm (theo Memory Rules)

## Tuần 6 — Dashboard phụ huynh

- [x] Hiển thị: phút đã luyện, từ đã học, chủ đề hoàn thành, nội dung cần ôn
- [x] Không chấm điểm IQ, không xếp hạng

## Tuần 7–8 — Quan sát & tinh chỉnh

- [x] Panel Success Metrics trên `/parent` (Engagement / Confidence / Vocabulary / Enjoyment)
- [ ] Ghi lại các lúc con mất hứng thú (nhật ký bên dưới — thủ công)
- [ ] Tinh chỉnh Prompt/Planner dựa trên quan sát thực tế — không thêm tính năng mới trừ khi có lý do rõ ràng

---

## Nhật ký quan sát con (cập nhật thủ công sau mỗi buổi thử)

| Ngày | Tuần milestone | Con phản ứng thế nào | Cần sửa gì |
|---|---|---|---|
| | | | |

---

## Việc KHÔNG làm (nhắc lại để Cursor không tự thêm)

- Avatar, animation, camera, nhận diện cảm xúc
- Gamification (điểm số, leaderboard, huy hiệu)
- Nhiều nhân vật AI
- Database/ORM/Auth (Postgres, Prisma, Supabase Auth)
- `skill_breakdown` chi tiết (Listening/Speaking/Pronunciation)
