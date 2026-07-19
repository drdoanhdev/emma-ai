# Emma AI

Trợ lý luyện giao tiếp tiếng Anh bằng giọng nói cho trẻ 6–12 tuổi. Dự án cá nhân (không phải SaaS), mục tiêu duy nhất: giúp trẻ muốn nói tiếng Anh khoảng 10–15 phút mỗi ngày một cách tự nguyện.

## Tài liệu thiết kế (đọc trước khi code)

- [`docs/01-vision-safety.md`](docs/01-vision-safety.md) — mục tiêu, tính cách Emma, rào chắn an toàn.
- [`docs/02-architecture-data.md`](docs/02-architecture-data.md) — kiến trúc, schema, Planner, Review Engine.
- [`docs/03-roadmap.md`](docs/03-roadmap.md) — lộ trình theo tuần, Success Metrics.

## Tech stack

- Next.js (App Router) + TypeScript
- OpenAI Realtime API (voice)
- State: Upstash Redis (`child:{id}`) — profile, mission, learning_memory, preference_memory, session_history
- Curriculum tĩnh: `data/curriculum.json`

## Chạy local

```bash
npm install
npm run dev
```

- Con: http://localhost:3000 — nói chuyện, phụ đề, form kết thúc buổi
- Phụ huynh: http://localhost:3000/parent — mission, day_mode, sở thích, dashboard

## Deploy Vercel

Env bắt buộc: `OPENAI_API_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` (hoặc cặp `UPSTASH_REDIS_REST_*`).

## Trạng thái

Xem [`TASKS.md`](TASKS.md). Các mục còn mở chủ yếu là **cho con thử** và ghi nhật ký quan sát (Tuần 7–8).
