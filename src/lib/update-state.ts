import {
  createVocabEntry,
  grammarSlug,
  markCorrectUse,
  markForgot,
  todayISO,
} from "./review-engine";
import type {
  ChildState,
  SessionReport,
  SessionSummary,
  VocabEntry,
} from "./types";

function upsertVocab(
  vocab: VocabEntry[],
  word: string,
  mutate: (entry: VocabEntry) => VocabEntry,
): VocabEntry[] {
  const key = word.toLowerCase().trim();
  if (!key) return vocab;
  const idx = vocab.findIndex((v) => v.word === key);
  if (idx === -1) {
    return [...vocab, mutate(createVocabEntry(key))];
  }
  const next = [...vocab];
  next[idx] = mutate(next[idx]);
  return next;
}

/**
 * Pure code update from Session Summary — never let LLM decide learned/unknown.
 */
export function updateStateFromSession(
  state: ChildState,
  report: SessionReport,
): ChildState {
  const sessionDate = todayISO();
  let vocab = [...state.learning_memory.vocab];

  const correctSet = new Set(
    report.words_correct.map((w) => w.toLowerCase().trim()).filter(Boolean),
  );
  const forgotSet = new Set(
    report.words_forgot.map((w) => w.toLowerCase().trim()).filter(Boolean),
  );

  for (const word of correctSet) {
    if (forgotSet.has(word)) continue;
    vocab = upsertVocab(vocab, word, (entry) =>
      markCorrectUse(entry, sessionDate),
    );
  }

  for (const word of forgotSet) {
    vocab = upsertVocab(vocab, word, (entry) =>
      markForgot(entry, sessionDate),
    );
  }

  const grammarKey = grammarSlug(state.mission.grammar || report.topic);
  let grammar_covered = [...state.learning_memory.grammar_covered];
  let grammar_weak = [...state.learning_memory.grammar_weak];

  if (grammarKey && !grammar_covered.includes(grammarKey)) {
    grammar_covered = [...grammar_covered, grammarKey];
  }

  const weakKey = report.grammar_weak
    ? grammarSlug(report.grammar_weak)
    : "";
  if (weakKey && !grammar_weak.includes(weakKey)) {
    grammar_weak = [...grammar_weak, weakKey];
  }
  // If practiced successfully and was weak, drop from weak list
  if (grammarKey && correctSet.size > 0 && !report.grammar_weak) {
    grammar_weak = grammar_weak.filter((g) => g !== grammarKey);
  }

  const summary: SessionSummary = {
    date: sessionDate,
    duration_min: Math.max(0, Math.round(report.duration_min)),
    topic: report.topic.toLowerCase(),
    new_words: report.words_correct.filter((w) => {
      const prev = state.learning_memory.vocab.find(
        (v) => v.word === w.toLowerCase().trim(),
      );
      return !prev;
    }),
    reviewed: report.words_correct.filter((w) => {
      const prev = state.learning_memory.vocab.find(
        (v) => v.word === w.toLowerCase().trim(),
      );
      return Boolean(prev);
    }),
    child_confidence: report.child_confidence,
    enjoyment: report.enjoyment,
    notes: report.notes?.trim() ?? "",
  };

  return {
    ...state,
    learning_memory: {
      vocab,
      grammar_covered,
      grammar_weak,
    },
    session_history: [...state.session_history, summary],
  };
}
