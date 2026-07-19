# Emma AI

Trợ lý luyện giao tiếp tiếng Anh bằng giọng nói cho trẻ 6–12 tuổi. Dự án cá nhân (không phải SaaS), mục tiêu duy nhất: giúp trẻ muốn nói tiếng Anh khoảng 10–15 phút mỗi ngày một cách tự nguyện.

## Tài liệu thiết kế (đọc trước khi code)

- [`docs/01-vision-safety.md`](docs/01-vision-safety.md) — mục tiêu, tính cách Emma, rào chắn an toàn.
- [`docs/02-architecture-data.md`](docs/02-architecture-data.md) — kiến trúc, schema, Planner, Review Engine.
- [`docs/03-roadmap.md`](docs/03-roadmap.md) — lộ trình theo tuần, Success Metrics.

## Tech stack

- Next.js (App Router) + TypeScript
- OpenAI Realtime API (voice)
- State: Upstash Redis (`child:{id}`) — profile/mission
- Curriculum tĩnh: `data/curriculum.json` (file local, không Redis)

## Chạy local

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
# Điền OPENAI_API_KEY + Redis URL/TOKEN
npm run dev
```

Mở http://localhost:3000 (con) và http://localhost:3000/parent (phụ huynh).

## Deploy Vercel

1. Thêm env: `OPENAI_API_KEY`, và `KV_REST_API_URL` + `KV_REST_API_TOKEN` (hoặc cặp `UPSTASH_REDIS_REST_*`).
2. Deploy → mở `https://….vercel.app` và `/parent`.

Lần đầu `getChildState("minh")` sẽ seed từ `data/minh.json` vào Redis nếu key chưa có.

## Trạng thái

Xem [`TASKS.md`](TASKS.md).
