export type CefrLevel = "A1" | "A2" | "B1";

export type DayMode = "normal" | "light_only" | "review_focus" | "tired";

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

/** Week 2: profile + mission. Memory fields come in later weeks. */
export type ChildState = {
  profile: ChildProfile;
  mission: WeeklyMission;
};

export type TodayPlan = {
  /** Resolved content source: parent mission or curriculum unit */
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

export const DAY_MODE_OPTIONS: { value: DayMode; label: string; hint: string }[] =
  [
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
