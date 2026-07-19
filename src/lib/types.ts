export type CefrLevel = "A1" | "A2" | "B1";

export type DayMode = "normal" | "light_only" | "review_focus" | "tired";

export type VocabStatus = "learning" | "learned";

export type ChildConfidence = "good" | "ok" | "shy";

export type Enjoyment = "😀" | "😐" | "🙁";

export type ChildProfile = {
  name: string;
  age: number;
  level: CefrLevel;
  goals: string;
  interests: string[];
};

export type WeeklyMission = {
  week: string;
  current_unit: number;
  topic: string;
  vocabulary: string[];
  grammar: string;
  mission_sentence: string;
  parent_note: string;
  day_mode: DayMode;
};

export type CurriculumUnit = {
  unit: number;
  topic: string;
  vocabulary: string[];
  grammar: string;
};

export type VocabEntry = {
  word: string;
  status: VocabStatus;
  correct_uses: number;
  distinct_sessions_used: number;
  review_stage: number;
  next_review_date: string; // YYYY-MM-DD
};

export type LearningMemory = {
  vocab: VocabEntry[];
  grammar_covered: string[];
  grammar_weak: string[];
};

/** Safe likes only — never family drama, emotions, illness (Memory Rules). */
export type PreferenceMemory = {
  favorite_animal: string;
  favorite_game: string;
  favorite_sport: string;
};

export type SessionSummary = {
  date: string;
  duration_min: number;
  topic: string;
  new_words: string[];
  reviewed: string[];
  child_confidence: ChildConfidence;
  enjoyment: Enjoyment;
  notes: string;
};

export type ChildState = {
  profile: ChildProfile;
  mission: WeeklyMission;
  learning_memory: LearningMemory;
  preference_memory: PreferenceMemory;
  session_history: SessionSummary[];
};

export type TodayPlan = {
  topic: string;
  vocabulary: string[];
  grammar: string;
  missionSentence: string;
  parentNote: string;
  contentSource: "parent_note" | "curriculum";
  reviewWords: string[];
  newWords: string[];
  conversationMinutes: number;
  gameMinutes: number;
  wrapUpMinutes: number;
  maxNewQuestions: number;
  dayMode: DayMode;
};

/** Parent/child report after a voice session — feeds updateState (code, not AI). */
export type SessionReport = {
  duration_min: number;
  topic: string;
  /** Words used correctly this session (new or review). */
  words_correct: string[];
  /** Words forgotten / struggled with. */
  words_forgot: string[];
  child_confidence: ChildConfidence;
  enjoyment: Enjoyment;
  notes?: string;
  /** Optional: mark a grammar point as still weak. */
  grammar_weak?: string;
};

export const DAY_MODE_OPTIONS: {
  value: DayMode;
  label: string;
  hint: string;
}[] = [
  { value: "normal", label: "Normal", hint: "Buổi học bình thường" },
  { value: "tired", label: "Tired", hint: "Con mệt — ít hỏi mới, nhiều game" },
  {
    value: "light_only",
    label: "Light only",
    hint: "Chỉ chơi, không học nghiêm túc",
  },
  {
    value: "review_focus",
    label: "Review focus",
    hint: "Mai kiểm tra — tăng ôn, bỏ nội dung mới",
  },
];

export const EMPTY_LEARNING_MEMORY: LearningMemory = {
  vocab: [],
  grammar_covered: [],
  grammar_weak: [],
};

export const EMPTY_PREFERENCE_MEMORY: PreferenceMemory = {
  favorite_animal: "",
  favorite_game: "",
  favorite_sport: "",
};
