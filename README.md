# Emma AI

Trợ lý luyện giao tiếp tiếng Anh bằng giọng nói cho trẻ 6–12 tuổi. Dự án cá nhân (không phải SaaS), mục tiêu duy nhất: giúp trẻ muốn nói tiếng Anh khoảng 10–15 phút mỗi ngày một cách tự nguyện.

## Tài liệu thiết kế (đọc trước khi code)

Toàn bộ quyết định kiến trúc và triết lý sản phẩm nằm ở `/docs`, không nằm rải rác trong lịch sử chat:

- [`docs/01-vision-safety.md`](docs/01-vision-safety.md) — mục tiêu, tính cách Emma, rào chắn an toàn (bắt buộc tuân thủ).
- [`docs/02-architecture-data.md`](docs/02-architecture-data.md) — kiến trúc, schema dữ liệu, Planner, Review Engine.
- [`docs/03-roadmap.md`](docs/03-roadmap.md) — lộ trình theo tuần, Success Metrics.

Cursor Rules ở `.cursor/rules/` tự động nạp các tài liệu này vào mỗi phiên làm việc.

## Nguyên tắc cốt lõi

- Emma là bạn đồng hành (80%), không phải giáo viên nghiêm túc (20%).
- Không tạo gắn bó tình cảm giả (không nói "I missed you"...).
- Planner quyết định nội dung mỗi buổi bằng code — không để AI tự do dẫn dắt.
- Không dùng database/ORM/auth phức tạp — chỉ file JSON local, vì đây là dự án cho 1–2 con, không phải nhiều người dùng.

## Tech stack

- Next.js (App Router) + TypeScript
- OpenAI Realtime API hoặc Gemini Live API cho voice
- Lưu trữ: file JSON local trong `/data`

## Chạy dự án (local)

```bash
npm install
npm run dev
```

Cần file `.env.local` chứa API key (xem `.env.example`). File này **không** được commit lên Git.

## Deploy lên Vercel

App Week 1 chỉ **đọc** `data/minh.json` (không ghi file) nên chạy được trên Vercel. HTTPS của Vercel cũng cho phép test mic trên điện thoại.

1. Đẩy code lên GitHub (repo nên để **Private** vì có hồ sơ con trong `data/minh.json`).
2. Vào [vercel.com](https://vercel.com) → **Add New Project** → chọn repo `emma-ai`.
3. **Environment Variables** (Production + Preview):
   - `OPENAI_API_KEY` = key OpenAI
   - (tuỳ chọn) `CHILD_STATE_JSON` = nội dung JSON đầy đủ của `data/minh.json` nếu không muốn commit file đó
4. Deploy → mở URL `https://….vercel.app` trên điện thoại.

Hoặc từ máy local (đã đăng nhập Vercel CLI):

```bash
npx vercel
npx vercel --prod
```

**Lưu ý:** từ Tuần 2 trở đi, trang phụ huynh / Memory cần **ghi** JSON — filesystem Vercel không bền. Khi tới đó sẽ cần cách lưu khác hoặc giữ phần ghi trên máy local; Week 1 voice thì deploy ổn.

## Trạng thái hiện tại

Xem [`TASKS.md`](TASKS.md) để biết đang ở milestone nào.
