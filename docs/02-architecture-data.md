# Emma AI — Architecture & Data

**Nguyên tắc:** dự án cho 1–2 con, không phải sản phẩm nhiều người dùng. Không thêm hạ tầng (database, ORM, auth) mà một dự án cá nhân không cần. Nếu sau này thực sự mở rộng thành SaaS, migrate lúc đó — không trả giá trước.

> **Cập nhật (khi deploy lên Vercel):** Vercel serverless functions có filesystem chỉ đọc (read-only, ephemeral) — không thể ghi bền vững vào file JSON local như mô tả gốc bên dưới. Khi đã deploy, thay lớp lưu trữ bằng **Vercel KV** (kho key-value đơn giản, vẫn lưu nguyên object JSON dưới 1 key, ví dụ `child:minh`) — không phải PostgreSQL/Prisma, không phá nguyên tắc "không DB phức tạp" ở trên. Nếu chỉ chạy `npm run dev` trên máy cá nhân, không cần Vercel KV, file JSON local vẫn dùng được bình thường.

## 0. Curriculum Engine (JSON tĩnh, không phải AI)

Để không phải tự nghĩ mission mỗi tuần, có một danh sách Unit cố định, Planner tự lấy Unit hiện tại theo thứ tự:

```json
[
  { "unit": 1, "topic": "Greeting", "vocabulary": ["hello", "goodbye", "how are you"], "grammar": "greetings" },
  { "unit": 2, "topic": "Family", "vocabulary": ["mother", "father", "sister", "brother"], "grammar": "possessive (my/your)" },
  { "unit": 3, "topic": "School", "vocabulary": ["teacher", "classroom", "book", "pencil"], "grammar": "there is/are" },
  { "unit": 4, "topic": "Food", "vocabulary": ["apple", "rice", "hungry", "delicious"], "grammar": "do you like...?" },
  { "unit": 5, "topic": "Review", "vocabulary": [], "grammar": "mixed review" }
]
```

**Thứ tự ưu tiên khi Planner chọn nội dung hôm nay:**
1. Nếu có `mission.parent_note` cụ thể cho tuần này (bố mẹ chủ động giao) → ưu tiên cao nhất, override Curriculum.
2. Nếu không có, Planner tự lấy Unit hiện tại trong Curriculum theo tuần.

Curriculum chỉ là dữ liệu tĩnh trong `data/curriculum.json`, không sinh bằng AI, không đổi khi chạy — chỉnh sửa thủ công khi cần.

## 1. Kiến trúc luồng xử lý

Một server duy nhất. Không microservice, không event bus, không queue.

```
Voice (nói)
   ↓
Realtime API (STT + TTS tích hợp sẵn — không tự build STT/TTS)
   ↓
Planner (code thuần, KHÔNG dùng AI để quyết định)
   ↓
Prompt Builder (ghép system prompt từ state)
   ↓
LLM (trong session Realtime)
   ↓
Voice (trả lời)
   ↓
Update State (ghi lại sau khi kết thúc buổi)
```

## 2. Data schema — 1 file JSON per child

Không dùng PostgreSQL/Supabase/Prisma cho giai đoạn 1–2. Lưu trực tiếp trong `data/{child_name}.json`:

```json
{
  "profile": {
    "name": "Minh",
    "age": 8,
    "level": "A1",
    "goals": "Nói tự tin trong 15 phút mỗi ngày",
    "interests": ["cars", "dinosaurs", "Minecraft"]
  },
  "mission": {
    "week": "2026-07-14",
    "current_unit": 4,
    "topic": "Food",
    "vocabulary": ["apple", "banana", "rice", "noodles"],
    "grammar": "Do you like...?",
    "mission_sentence": "Talk about lunch.",
    "parent_note": "Con sắp kiểm tra Speaking tuần này.",
    "day_mode": "normal"
  },
  "learning_memory": {
    "vocab": [
      { "word": "apple", "status": "learned", "correct_uses": 3, "distinct_sessions_used": 3, "review_stage": 2, "next_review_date": "2026-07-25" },
      { "word": "rice", "status": "learning", "correct_uses": 1, "distinct_sessions_used": 1, "review_stage": 0, "next_review_date": "2026-07-19" }
    ],
    "grammar_covered": ["present_simple_basic"],
    "grammar_weak": ["past_simple"],
    "skill_breakdown": {
      "note": "Giai đoạn 2+, KHÔNG bắt buộc cho MVP. Chỉ thêm nếu dữ liệu vocab/grammar cơ bản đã đủ và cần chi tiết hơn.",
      "listening": null,
      "speaking": null,
      "pronunciation": null,
      "confidence": null
    }
  },
  "preference_memory": {
    "favorite_animal": "dog",
    "favorite_game": "Minecraft",
    "favorite_sport": "football"
  },
  "session_history": [
    {
      "date": "2026-07-18",
      "duration_min": 14,
      "topic": "food",
      "new_words": ["hungry"],
      "reviewed": ["dog"],
      "child_confidence": "good",
      "enjoyment": "😀",
      "notes": "Needed more time before answering."
    }
  ]
}
```

**Lưu ý:**
- `session_history` chỉ lưu **tóm tắt** (theo mẫu Session Summary ở trên) — **không lưu toàn bộ transcript**. Nhanh hơn, rẻ hơn, ổn định hơn khi build prompt sau này.
- `preference_memory` chỉ dùng để tạo ví dụ/game cá nhân hóa — không phải nơi lưu thông tin cảm xúc.
- `mission.day_mode`: `"normal" | "light_only" | "review_focus" | "tired"` — bố mẹ chọn trước buổi học nếu cần (xem mục 3b).

## 2b. Review Engine — lịch ôn cố định (code quyết định, không phải AI)

Mỗi từ mới đi qua các mốc ôn cố định (spaced repetition đơn giản), không dùng AI để quyết định khi nào ôn:

| review_stage | Ôn lại sau |
|---|---|
| 0 (mới học) | ngày mai |
| 1 | 3 ngày sau |
| 2 | 7 ngày sau |
| 3 | 21 ngày sau |
| 4 | coi như đã vững, ôn định kỳ dài (vd. mỗi tháng) |

Trả lời đúng → tăng `review_stage` lên 1. Trả lời sai/quên → giảm về `review_stage - 1` (không về 0 hẳn, tránh gây nản). Planner chọn từ có `next_review_date` ≤ hôm nay để đưa vào buổi học.

## 2c. Quy tắc bảo thủ khi cập nhật trạng thái từ vựng (updateState)

**Đây là điểm quan trọng nhất trong toàn bộ hệ thống dữ liệu.** Không được để AI tự suy luận "con nói đúng 1 lần → đã biết từ". Một từ chỉ chuyển từ `"learning"` sang `"learned"` khi thỏa **một trong hai** điều kiện:

1. Dùng đúng ở **3 buổi khác nhau** (`distinct_sessions_used >= 3`), hoặc
2. Trả lời đúng trong minigame kiểm tra riêng (không phải chỉ lặp lại theo Emma trong hội thoại tự do).

`updateState()` nên được viết bằng code thuần dựa trên Session Summary (không phải để LLM tự parse transcript rồi tự kết luận "known/unknown"). Nếu cần LLM hỗ trợ nhận diện "con có dùng đúng từ X không trong buổi này", chỉ dùng nó để trả về **true/false cho một câu hỏi cụ thể**, không để nó tự quyết định trạng thái cuối cùng — trạng thái cuối cùng luôn do rule ở trên (code) tính toán.


## 3c. Session Opening — để con chọn chủ đề thay vì áp đặt

**Vấn đề đã phát hiện qua thực tế dùng:** áp đặt cứng chủ đề từ Curriculum khiến buổi học nhàm chán, lặp lại. Giải pháp: Planner chuẩn bị gợi ý, nhưng Emma hỏi con trước khi khóa chủ đề.

```ts
function buildTopicSuggestions(state, curriculum) {
  const curriculumTopic = getCurrentUnit(curriculum, state.mission.current_unit);
  const interestTopic = pickTopicFromInterests(state.profile.interests, curriculum);
  return [curriculumTopic, interestTopic]; // 2 gợi ý đưa cho Emma hỏi con
}
```

Đầu mỗi buổi, system prompt chỉ dẫn Emma hỏi dạng: *"Hôm nay mình nói về [Topic A] hay [Topic B]? Hay con muốn kể chuyện gì khác không?"*

**3 nhánh xử lý theo câu trả lời của con:**

| Con chọn | Xử lý |
|---|---|
| Chọn 1 trong 2 gợi ý | Dùng nguyên `mission.vocabulary`/`grammar` của Unit đó — giữ nguyên logic Planner cũ |
| Tự đề xuất tình huống khác (tiếng Việt hoặc Anh, vd "đi chợ", "về quê chơi") | Emma đóng vai theo tình huống đó bằng tiếng Anh. Prompt Builder vẫn đưa `mission.vocabulary` hôm nay vào system prompt kèm chỉ dẫn: "cố gắng lồng ghép tự nhiên các từ này vào tình huống, không ép nếu không hợp; luôn dạy ít nhất 1-2 từ mới liên quan trực tiếp đến tình huống con chọn (vd 'market' → 'buy', 'price', 'vendor')" |
| Im lặng / không có ý kiến | Mặc định dùng gợi ý đầu tiên (curriculumTopic) |

**Ghi vào Session Summary** thêm trường `topic_source: "planner" | "child_initiated"` để sau này xem lại con thường chủ động đề xuất chủ đề gì (dùng để làm giàu Curriculum dần theo sở thích thật của con).

**Curriculum nên bổ sung các chủ đề thực tế hay gặp:** Market (Đi chợ), Countryside trip (Về quê), Farm (Nông trại), Restaurant (Nhà hàng), Doctor visit (Đi khám bệnh) — vì đây rõ ràng là các tình huống con quan tâm.

## 2d. Level Progression — tăng độ khó câu tự động theo tiến bộ thật

Không tăng `profile.level` thủ công. Code tự tính lại sau mỗi `updateState()`, dựa trên dữ liệu đã có sẵn trong `learning_memory`:

```ts
function recalculateLevel(learningMemory) {
  const learnedCount = learningMemory.vocab.filter(w => w.status === "learned").length;
  const grammarCount = learningMemory.grammar_covered.length;

  if (learnedCount >= 100 && grammarCount >= 12) return "B1";
  if (learnedCount >= 40 && grammarCount >= 5) return "A2";
  return "A1";
}
```

Khi `profile.level` tăng, bảng giới hạn độ dài câu ở `docs/01-vision-safety.md` mục 4b tự áp dụng câu dài/phức tạp hơn cho Emma — không cần chỉnh tay. Số ngưỡng (100/40, 12/5...) là gợi ý ban đầu, tinh chỉnh lại sau khi quan sát thực tế con dùng bao lâu thì thực sự sẵn sàng lên trình độ tiếp theo.



Planner là hàm JavaScript/TypeScript thông thường, tính toán trước khi build prompt:

```ts
function buildTodayPlan(state, curriculum) {
  const missionSource = state.mission.parent_note
    ? state.mission
    : getCurrentUnit(curriculum, state.mission.current_unit);

  const base = {
    reviewWords: pickDueWords(state.learning_memory.vocab, max=2),
    newWords: pickNewWords(missionSource.vocabulary, state.learning_memory.vocab, max=3),
    conversationMinutes: 5,
    gameMinutes: 3,
    wrapUpMinutes: 1,
    maxNewQuestions: 4
  };

  // Điều chỉnh theo Parent Mode (day_mode)
  switch (state.mission.day_mode) {
    case "tired":
      return { ...base, newWords: [], maxNewQuestions: 2, gameMinutes: 5, conversationMinutes: 3 };
    case "light_only":
      return { ...base, newWords: [], reviewWords: [], gameMinutes: 8, maxNewQuestions: 2 };
    case "review_focus":
      return { ...base, newWords: [], reviewWords: pickDueWords(state.learning_memory.vocab, max=5) };
    default:
      return base;
  }
}
```

Planner quyết định số lượng — không để LLM tự quyết định "hôm nay dạy bao nhiêu từ".

## 3b. Parent Mode — day_mode

Bố mẹ chọn trước buổi học (giao diện đơn giản: 4 nút bấm), Planner tự điều chỉnh:

| day_mode | Ý nghĩa | Planner làm gì |
|---|---|---|
| `normal` | Buổi học bình thường | Theo budget mặc định |
| `tired` | Con hôm nay mệt | Giảm câu hỏi mới, tăng game, không dạy từ mới |
| `light_only` | Chỉ chơi, không học nghiêm túc | Bỏ hẳn từ mới + ngữ pháp, chỉ chơi |
| `review_focus` | Mai kiểm tra ở trường | Tăng ôn tập, bỏ nội dung mới |

## 4. Prompt Builder

System prompt được ghép từ các phần riêng biệt (mỗi phần là 1 hàm nhỏ, dễ sửa độc lập mà không ảnh hưởng phần khác — ví dụ sửa Personality không đụng tới Safety):

```ts
function buildCompactSystemPrompt(state, plan) {
  return [
    buildFixedSection(level),           // personality + safety cứng (~250 token)
    buildOpeningSection(plan),          // session opening — chỉ buổi mới
    buildMemoryCompactSection(...),     // profile + prefs + vocab hôm nay (~100 token)
    buildDynamicSection(mission, plan), // mission + budget (~50 token)
  ].join("\n\n");
}

function buildContinuationPrompt(state, ctx, plan) {
  // Giống trên nhưng thay opening bằng mid-session summary (rotate sau 5 phút)
}
```

Thứ tự ghép (compact):
1. **Fixed** — Emma personality + Safety rules (rào chắn cứng, không rút gọn nghĩa)
2. **Opening** — chỉ session mới (hỏi chọn chủ đề)
3. **Memory** — profile, prefs, vocab liên quan hôm nay, 1 dòng last session
4. **Dynamic** — mission, vocab, budget từ Planner

Không bao giờ gửi toàn bộ `session_history` hay transcript đầy đủ.

### 4b. Cost optimization (Realtime in-session)

Realtime API đọc lại **toàn bộ conversation** mỗi turn — context phình theo thời gian nếu không xử lý.

**Giảm prompt (~400 token thay vì ~3000):** 3 lớp compact ở trên; `assertPromptBudget()` cảnh báo nếu vượt 600 token.

**Giới hạn output:** `max_output_tokens` theo level (A1: 40, A2: 50, B1: 60) — config trong `src/lib/realtime-config.ts`.

**Truncation server-side (lưới an toàn):** `post_instructions: 1200`, `retention_ratio: 0.8` trong session config.

**Compaction mỗi 10 lượt (client):**
- Giữ 5 lượt gần nhất
- Summarize phần cũ bằng `gpt-4o-mini` (`/api/realtime/summarize`)
- `conversation.item.create` (summary) + `conversation.item.delete` (items cũ)

**Rotate session ngầm sau 5 phút:**
- Summarize → WebRTC session mới với `buildContinuationPrompt`
- User không thấy wrap-up; mic stream được reuse

Env tùy chọn: `REALTIME_MODEL`, `REALTIME_MAX_OUTPUT_TOKENS`, `REALTIME_COMPACT_EVERY_TURNS`, `REALTIME_ROTATE_MINUTES`, v.v. (xem `.env.example`).

## 5. Voice

- Dùng Realtime API (OpenAI Realtime hoặc Gemini Live) — không tự build STT/TTS.
- Yêu cầu: độ trễ dưới 2 giây, giọng nữ tiếng Anh, tốc độ chậm.
- API key giữ ở backend, không expose ra client.

## 6. UI

Chỉ gồm: nút nói chuyện với Emma, nút dừng, xem lịch sử ngắn gọn. Không menu phức tạp, không quảng cáo, không avatar 3D.

Trang phụ huynh riêng (không cho trẻ thấy):
- Ô nhập Parent Mission (giao nhiệm vụ mỗi tuần).
- Báo cáo đơn giản: phút đã luyện, số từ đã học, chủ đề đã hoàn thành, nội dung cần ôn. Không chấm điểm IQ, không xếp hạng.

Không cần hệ thống đăng nhập (auth) nếu chỉ chạy local/gia đình dùng riêng — chỉ thêm khi thực sự cần chia sẻ nhiều thiết bị.
