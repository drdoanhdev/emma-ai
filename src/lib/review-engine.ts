import type { VocabEntry } from "./types";

/** Days until next review for each stage (docs 2b). Stage 4 ≈ monthly. */
const REVIEW_INTERVAL_DAYS = [1, 3, 7, 21, 30] as const;

export function todayISO(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function intervalDaysForStage(stage: number): number {
  const idx = Math.min(
    Math.max(0, stage),
    REVIEW_INTERVAL_DAYS.length - 1,
  );
  return REVIEW_INTERVAL_DAYS[idx];
}

export function nextReviewDateForStage(
  stage: number,
  fromDate: string = todayISO(),
): string {
  return addDaysISO(fromDate, intervalDaysForStage(stage));
}

export function createVocabEntry(
  word: string,
  fromDate: string = todayISO(),
): VocabEntry {
  return {
    word: word.toLowerCase().trim(),
    status: "learning",
    correct_uses: 0,
    distinct_sessions_used: 0,
    review_stage: 0,
    next_review_date: nextReviewDateForStage(0, fromDate),
  };
}

/** Words whose next_review_date ≤ today. */
export function pickDueWords(
  vocab: VocabEntry[] | undefined,
  max: number,
  today: string = todayISO(),
): string[] {
  if (!vocab?.length || max <= 0) return [];
  return vocab
    .filter((v) => v.next_review_date <= today)
    .sort((a, b) => a.next_review_date.localeCompare(b.next_review_date))
    .slice(0, max)
    .map((v) => v.word);
}

/** Mission words not yet in memory (or still worth introducing). */
export function pickNewWords(
  missionVocab: string[],
  knownVocab: VocabEntry[] | undefined,
  max: number,
): string[] {
  if (max <= 0) return [];
  const known = new Set(
    (knownVocab ?? []).map((v) => v.word.toLowerCase()),
  );
  return missionVocab
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w && !known.has(w))
    .slice(0, max);
}

/**
 * Conservative "learned" rule (docs 2c):
 * distinct_sessions_used >= 3 (minigame path not built yet).
 */
export function applyLearnedRule(entry: VocabEntry): VocabEntry {
  if (entry.distinct_sessions_used >= 3) {
    return { ...entry, status: "learned" };
  }
  return { ...entry, status: "learning" };
}

export function markCorrectUse(
  entry: VocabEntry,
  sessionDate: string,
): VocabEntry {
  const nextStage = Math.min(
    entry.review_stage + 1,
    REVIEW_INTERVAL_DAYS.length - 1,
  );
  const updated: VocabEntry = {
    ...entry,
    correct_uses: entry.correct_uses + 1,
    distinct_sessions_used: entry.distinct_sessions_used + 1,
    review_stage: nextStage,
    next_review_date: nextReviewDateForStage(nextStage, sessionDate),
  };
  return applyLearnedRule(updated);
}

export function markForgot(entry: VocabEntry, sessionDate: string): VocabEntry {
  const nextStage = Math.max(0, entry.review_stage - 1);
  return {
    ...entry,
    review_stage: nextStage,
    next_review_date: nextReviewDateForStage(nextStage, sessionDate),
    status: "learning",
  };
}

export function grammarSlug(grammar: string): string {
  return grammar
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
