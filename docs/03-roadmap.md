# Emma AI — Roadmap

**Nguyên tắc:** kiểm chứng "con có muốn dùng Emma không" càng sớm càng tốt — không dồn việc thử nghiệm xuống cuối. Nếu voice/nhịp hội thoại không ổn, cần biết điều đó trước khi xây Memory/Dashboard phức tạp.

## Tuần 1 — Nền tảng + Voice (làm song song)
- Khởi tạo dự án Next.js + TypeScript.
- Tạo file JSON state cho hồ sơ con (`profile` + `mission` tối thiểu).
- Tích hợp Realtime Voice API — màn hình hội thoại tối giản (1 nút nói chuyện).
- Kiểm tra độ trễ và chất lượng giọng — đây là ưu tiên kỹ thuật số 1.
- Prompt Builder bản đầu: ghép Personality + Safety (`01-vision-safety.md`) + Profile + Mission.

**Cuối tuần 1: cho con thử ngay**, dù chưa có Planner/Memory. Mục tiêu: kiểm tra con có thấy giọng Emma dễ chịu, có muốn nói chuyện tiếp không.

## Tuần 2 — Curriculum + Planner + Weekly Mission
- Tạo `data/curriculum.json` (danh sách Unit tĩnh, xem `02-architecture-data.md` mục 0) — làm 1 lần, không phải nghĩ lại mỗi tuần.
- Xây Planner bằng code thuần (không AI): số từ mới, số câu hỏi, thời lượng từng phần, có xử lý `day_mode`.
- Trang phụ huynh: ô "giao nhiệm vụ" (Parent Mission) + 4 nút chọn `day_mode` (normal/tired/light_only/review_focus) — ưu tiên cao, chi phí thấp.
- AI bám theo mission (ưu tiên parent_note, fallback về Curriculum) trong hội thoại thay vì tự do.

**Cuối tuần 2: cho con thử lại, so sánh với tuần 1** — có định hướng rõ hơn có làm buổi học tốt hơn hay làm mất tự nhiên không? Ghi chú lại để tinh chỉnh prompt.

## Tuần 3–4 — Learning Memory + Review Engine
- Lưu từ đã học, trạng thái (learning/learned) theo quy tắc **bảo thủ** ở `02-architecture-data.md` mục 2c (không tự động "known" chỉ sau 1 lần dùng đúng).
- Review Engine: lịch ôn cố định 1/3/7/21 ngày (code quyết định, không AI).
- Theo dõi ngữ pháp đã học / còn yếu.
- Test hàng tuần với con tiếp tục — không dừng lại chờ đến cuối.
- **Không làm** `skill_breakdown` (Listening/Speaking/Pronunciation riêng) ở giai đoạn này — để dành cho giai đoạn sau nếu thực sự cần chi tiết hơn.

## Tuần 5 — Preference Memory
- Ghi nhớ sở thích để cá nhân hóa ví dụ, trò chơi.
- Không lưu thông tin nhạy cảm (theo Memory Rules ở `01-vision-safety.md`).

## Tuần 6 — Dashboard phụ huynh
- Thời gian luyện tập, từ đã học, chủ đề hoàn thành, nội dung cần ôn.
- Giữ đơn giản — không chấm điểm, không xếp hạng.

## Tuần 7–8 — Quan sát & tinh chỉnh liên tục
- Ghi lại những lúc con mất hứng thú, những câu Emma nói khiến hội thoại gượng gạo.
- Điều chỉnh Planner, Prompt, nhịp điệu hội thoại — ưu tiên việc này hơn thêm tính năng mới.
- Chỉ cân nhắc thêm tính năng lớn (nhiều chủ đề tự xoay vòng, roadmap nhiều tháng...) sau khi đã có ít nhất 4–6 tuần dữ liệu thực tế cho thấy con dùng đều đặn.

## Success Metrics — đánh giá bằng gì sau 4 tuần

Không phải metrics kỹ thuật (uptime, latency...) mà là metrics giáo dục, dựa trên dữ liệu đã có sẵn trong `session_history`:

| Nhóm | Đo bằng gì | Nguồn dữ liệu |
|---|---|---|
| Engagement | Số ngày con tự mở Emma / tuần, thời lượng trung bình | `session_history[].date`, `duration_min` |
| Confidence | Con có dám trả lời không, còn ngại không (quan sát định tính qua `child_confidence` mỗi buổi) | `session_history[].child_confidence` |
| Vocabulary | Số từ cũ được dùng lại đúng trong buổi mới (không phải số từ "dạy", mà số từ thực sự dùng lại) | `learning_memory.vocab[].distinct_sessions_used` |
| Enjoyment | Emoji cuối buổi (😀 😐 🙁) — hỏi "Did you enjoy today?" | `session_history[].enjoyment` |

Xem lại 4 chỉ số này mỗi cuối tuần thay vì đoán cảm tính. Nếu Engagement giảm dần (con mở ít hơn) — đó là tín hiệu quan trọng nhất, ưu tiên sửa Prompt/Planner trước khi thêm bất kỳ tính năng nào khác.

## KHÔNG làm trong MVP (trừ khi có lý do rõ ràng sau khi đã thử)

- Avatar, animation, camera, face/emotion recognition.
- Gamification (điểm số, leaderboard, huy hiệu).
- Nhiều nhân vật AI (Leo, Max, Panda...).
- Database (PostgreSQL/Supabase), ORM, hệ thống đăng nhập — chỉ cần khi thực sự mở rộng ra nhiều gia đình dùng chung, không phải cho 1–2 con trong nhà.
