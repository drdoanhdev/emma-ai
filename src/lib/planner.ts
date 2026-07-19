import curriculumData from "../../data/curriculum.json";
import type {
  ChildState,
  CurriculumUnit,
  TodayPlan,
  WeeklyMission,
} from "./types";

const curriculum = curriculumData as CurriculumUnit[];

export function getCurriculum(): CurriculumUnit[] {
  return curriculum;
}

export function getCurrentUnit(
  units: CurriculumUnit[],
  unitNumber: number,
): CurriculumUnit {
  const found = units.find((u) => u.unit === unitNumber);
  if (found) return found;
  return units[0] ?? { unit: 1, topic: "Greeting", vocabulary: [], grammar: "" };
}

/**
 * Week 2: no Learning Memory yet — review lists stay empty.
 * Signature matches docs so Week 3 can plug vocab in later.
 */
function pickDueWords(_vocab: unknown[] | undefined, _max: number): string[] {
  return [];
}

function pickNewWords(
  missionVocab: string[],
  _knownVocab: unknown[] | undefined,
  max: number,
): string[] {
  return missionVocab.slice(0, max);
}

function hasParentNote(mission: WeeklyMission): boolean {
  return Boolean(mission.parent_note?.trim());
}

/**
 * Pure Planner — decides today's budget. No AI.
 * Content source: parent_note (if set) → else Curriculum unit.
 */
export function buildTodayPlan(state: ChildState): TodayPlan {
  const units = getCurriculum();
  const parentDriven = hasParentNote(state.mission);

  const unit = getCurrentUnit(units, state.mission.current_unit);
  const topic = parentDriven ? state.mission.topic : unit.topic;
  const vocabulary = parentDriven
    ? state.mission.vocabulary
    : unit.vocabulary;
  const grammar = parentDriven ? state.mission.grammar : unit.grammar;
  const missionSentence = parentDriven
    ? state.mission.mission_sentence
    : `Talk about ${unit.topic.toLowerCase()}.`;

  const base = {
    topic,
    vocabulary,
    grammar,
    missionSentence,
    parentNote: state.mission.parent_note?.trim() ?? "",
    contentSource: parentDriven
      ? ("parent_note" as const)
      : ("curriculum" as const),
    reviewWords: pickDueWords(undefined, 2),
    newWords: pickNewWords(vocabulary, undefined, 3),
    conversationMinutes: 5,
    gameMinutes: 3,
    wrapUpMinutes: 1,
    maxNewQuestions: 4,
    dayMode: state.mission.day_mode,
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
        reviewWords: pickDueWords(undefined, 5),
      };
    default:
      return base;
  }
}
