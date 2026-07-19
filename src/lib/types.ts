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

/** Week 1: profile + mission only */
export type ChildState = {
  profile: ChildProfile;
  mission: WeeklyMission;
};
