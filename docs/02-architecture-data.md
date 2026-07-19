# Emma AI — Architecture & Data

**Nguyên tắc:** dự án cho 1–2 con, không phải sản phẩm nhiều người dùng. Không thêm hạ tầng (database, ORM, auth) mà một dự án cá nhân không cần. Nếu sau này thực sự mở rộng thành SaaS, migrate lúc đó — không trả giá trước.

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


## 3. Planner (code thuần, không phải AI)

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
function buildSystemPrompt(state, plan) {
  return [
    buildPersonalitySection(),       // từ 01-vision-safety.md, ít khi đổi
    buildSafetySection(),            // rào chắn cứng, KHÔNG được LLM viết lại tự do
    buildProfileSection(state.profile),
    buildMissionSection(state.mission),
    buildBudgetSection(plan),        // budget hôm nay từ Planner
    buildMemorySection(state.learning_memory, state.preference_memory),
    buildRecentSummarySection(state.session_history.slice(-1)) // chỉ buổi gần nhất, không toàn bộ
  ].join("\n\n");
}
```

Thứ tự ghép:
1. Emma Personality (ít đổi)
2. Safety rules (rào chắn cứng)
3. Child Profile
4. Weekly Mission (đã qua Curriculum/Parent override)
5. Today's Budget (từ Planner, đã áp `day_mode`)
6. Learning Memory + Preference Memory (chỉ phần liên quan hôm nay)
7. Tóm tắt buổi gần nhất (1 buổi, không gửi toàn bộ lịch sử)

Không bao giờ gửi toàn bộ `session_history` hay transcript đầy đủ.

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
