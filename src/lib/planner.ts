import curriculumData from "../../data/curriculum.json";
import { pickDueWords, pickNewWords, todayISO } from "./review-engine";
import type {
  CefrLevel,
  ChildState,
  CurriculumUnit,
  LearningMemory,
  TodayPlan,
  WeeklyMission,
} from "./types";

const curriculum = curriculumData as CurriculumUnit[];

/** Interest keywords → preferred curriculum topics (docs 3c). */
const INTEREST_TOPIC_MAP: Record<string, string[]> = {
  cars: ["Transportation", "Shopping"],
  car: ["Transportation"],
  dinosaurs: ["Dinosaurs", "Animals", "Farm"],
  dinosaur: ["Dinosaurs"],
  minecraft: ["Hobbies", "My Room", "Colors & Shapes"],
  animals: ["Animals", "Farm", "Dinosaurs"],
  food: ["Food", "Market", "Restaurant"],
  sports: ["Sports", "My Day"],
  football: ["Sports"],
};

export function getCurriculum(): CurriculumUnit[] {
  return curriculum;
}

/** Non-Review units used for weekly rotation. */
function rotatableUnits(units: CurriculumUnit[]): CurriculumUnit[] {
  const main = units.filter(
    (u) => u.topic.toLowerCase() !== "review" && u.vocabulary.length > 0,
  );
  return main.length > 0 ? main : units;
}

function getReviewUnit(units: CurriculumUnit[]): CurriculumUnit | undefined {
  return units.find((u) => u.topic.toLowerCase() === "review");
}

/**
 * Resolve current curriculum unit from weeks since profile.start_date.
 * Every 7 days → next unit; after the last content unit → Review, then loop.
 */
export function getCurrentUnit(
  state: ChildState,
  units: CurriculumUnit[] = getCurriculum(),
  today: string = todayISO(),
): CurriculumUnit {
  // Parent note overrides curriculum content selection upstream;
  // still return a unit for suggestions / fallbacks.
  const rotatable = rotatableUnits(units);
  const review = getReviewUnit(units);

  const startDate = state.profile.start_date?.trim() || today;
  const start = new Date(`${startDate}T12:00:00.000Z`).getTime();
  const now = new Date(`${today}T12:00:00.000Z`).getTime();
  const weeksElapsed = Math.max(
    0,
    Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)),
  );

  const cycleLength = rotatable.length + (review ? 1 : 0);
  const index = cycleLength > 0 ? weeksElapsed % cycleLength : 0;

  if (review && index === rotatable.length) {
    return review;
  }
  return rotatable[index] ?? units[0]!;
}

/** Lookup by unit number (legacy helper). */
export function getUnitByNumber(
  units: CurriculumUnit[],
  unitNumber: number,
): CurriculumUnit {
  const found = units.find((u) => u.unit === unitNumber);
  if (found) return found;
  return units[0] ?? { unit: 1, topic: "Greeting", vocabulary: [], grammar: "" };
}

function pickTopicFromInterests(
  interests: string[],
  units: CurriculumUnit[],
  excludeTopic?: string,
): CurriculumUnit {
  const rotatable = rotatableUnits(units);

  // 1) Direct topic match from interests (e.g. "dinosaurs" → Dinosaurs)
  for (const interest of interests) {
    const key = interest.toLowerCase().trim();
    const direct = rotatable.find(
      (u) =>
        u.topic.toLowerCase() !== excludeTopic?.toLowerCase() &&
        (u.topic.toLowerCase() === key ||
          u.topic.toLowerCase().includes(key) ||
          key.includes(u.topic.toLowerCase())),
    );
    if (direct) return direct;
  }

  // 2) Mapped related topics
  const preferredTopics = new Set<string>();
  for (const interest of interests) {
    const key = interest.toLowerCase().trim();
    for (const topic of INTEREST_TOPIC_MAP[key] ?? []) {
      preferredTopics.add(topic.toLowerCase());
    }
  }

  const matches = rotatable.filter(
    (u) =>
      preferredTopics.has(u.topic.toLowerCase()) &&
      u.topic.toLowerCase() !== excludeTopic?.toLowerCase(),
  );
  if (matches.length > 0) {
    return matches[0]!;
  }

  const alt =
    rotatable.find(
      (u) => u.topic.toLowerCase() !== excludeTopic?.toLowerCase(),
    ) ?? rotatable[0];
  return alt ?? units[0]!;
}

/**
 * Docs 3c — two suggestions: current curriculum unit + interest-based unit.
 */
export function buildTopicSuggestions(
  state: ChildState,
  units: CurriculumUnit[] = getCurriculum(),
): CurriculumUnit[] {
  const curriculumTopic = getCurrentUnit(state, units);
  const interestTopic = pickTopicFromInterests(
    state.profile.interests,
    units,
    curriculumTopic.topic,
  );
  return [curriculumTopic, interestTopic];
}

function hasParentNote(mission: WeeklyMission): boolean {
  return Boolean(mission.parent_note?.trim());
}

/**
 * Apply computed unit onto mission fields when parent_note is empty.
 * Mutates a shallow copy — caller should persist if fields changed.
 */
export function applyCurrentUnitToMission(
  state: ChildState,
  today: string = todayISO(),
): ChildState {
  const withStart: ChildState = state.profile.start_date
    ? state
    : {
        ...state,
        profile: { ...state.profile, start_date: today },
      };

  if (hasParentNote(withStart.mission)) {
    return withStart;
  }

  const unit = getCurrentUnit(withStart, getCurriculum(), today);
  if (
    withStart.mission.current_unit === unit.unit &&
    withStart.mission.topic === unit.topic
  ) {
    return withStart;
  }

  return {
    ...withStart,
    mission: {
      ...withStart.mission,
      current_unit: unit.unit,
      topic: unit.topic,
      vocabulary: unit.vocabulary,
      grammar: unit.grammar,
      mission_sentence: `Talk about ${unit.topic.toLowerCase()}.`,
    },
  };
}

/** Docs 2d — level from learned vocab + grammar coverage. */
export function recalculateLevel(learningMemory: LearningMemory): CefrLevel {
  const learnedCount = learningMemory.vocab.filter(
    (w) => w.status === "learned",
  ).length;
  const grammarCount = learningMemory.grammar_covered.length;

  if (learnedCount >= 100 && grammarCount >= 12) return "B1";
  if (learnedCount >= 40 && grammarCount >= 5) return "A2";
  return "A1";
}

/** Pure Planner — no AI. Uses Review Engine for due words. */
export function buildTodayPlan(state: ChildState): TodayPlan {
  const units = getCurriculum();
  const parentDriven = hasParentNote(state.mission);
  const vocab = state.learning_memory?.vocab ?? [];
  const suggestions = buildTopicSuggestions(state, units);

  const unit = getCurrentUnit(state, units);
  const topic = parentDriven ? state.mission.topic : unit.topic;
  const vocabulary = parentDriven
    ? state.mission.vocabulary
    : unit.vocabulary;
  const grammar = parentDriven ? state.mission.grammar : unit.grammar;
  const missionSentence = parentDriven
    ? state.mission.mission_sentence
    : `Talk about ${unit.topic.toLowerCase()}.`;

  const base: TodayPlan = {
    topic,
    vocabulary,
    grammar,
    missionSentence,
    parentNote: state.mission.parent_note?.trim() ?? "",
    contentSource: parentDriven ? "parent_note" : "curriculum",
    reviewWords: pickDueWords(vocab, 2),
    newWords: pickNewWords(vocabulary, vocab, 3),
    conversationMinutes: 5,
    gameMinutes: 3,
    wrapUpMinutes: 1,
    maxNewQuestions: 4,
    dayMode: state.mission.day_mode,
    topicSuggestions: suggestions,
  };

  switch (state.mission.day_mode) {
    case "tired":
      return {
        ...base,
        newWords: [],
        maxNewQuestions: 2,
        gameMinutes: 5,
        conversationMinutes: 3,
      };
    case "light_only":
      return {
        ...base,
        newWords: [],
        reviewWords: [],
        gameMinutes: 8,
        maxNewQuestions: 2,
      };
    case "review_focus":
      return {
        ...base,
        newWords: [],
        reviewWords: pickDueWords(vocab, 5),
      };
    default:
      return base;
  }
}
