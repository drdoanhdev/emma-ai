import type { ChildState } from "./types";

/** Default seed for first Redis write / empty key. Safe to commit (repo should stay Private). */
export const KHANG_SEED: ChildState = {
  profile: {
    name: "Duy Khang",
    age: 8,
    level: "A1",
    goals: "Nói tự tin trong 15 phút mỗi ngày",
    interests: ["cars", "dinosaurs", "Minecraft"],
    start_date: "2026-07-14",
  },
  mission: {
    week: "2026-07-14",
    current_unit: 4,
    topic: "Food",
    vocabulary: ["apple", "banana", "rice", "noodles"],
    grammar: "Do you like...?",
    mission_sentence: "Talk about lunch.",
    parent_note: "Con sắp kiểm tra Speaking tuần này.",
    day_mode: "normal",
  },
  learning_memory: {
    vocab: [],
    grammar_covered: [],
    grammar_weak: [],
  },
  preference_memory: {
    favorite_animal: "dinosaur",
    favorite_game: "Minecraft",
    favorite_sport: "",
  },
  session_history: [],
};
