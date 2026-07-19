import { pickDueWords, todayISO } from "./review-engine";
import type { ChildState, Enjoyment } from "./types";

export type ParentDashboard = {
  totalMinutes: number;
  sessionCount: number;
  learnedWords: string[];
  learningWords: string[];
  dueForReview: string[];
  topicsCompleted: string[];
  grammarCovered: string[];
  grammarWeak: string[];
  /** Week 7 Success Metrics helpers */
  metrics: {
    daysThisWeek: number;
    avgDurationMin: number;
    enjoymentCounts: Record<Enjoyment, number>;
    recentConfidence: string[];
  };
};

function startOfWeekMonday(d: Date): string {
  const day = d.getUTCDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export function buildParentDashboard(state: ChildState): ParentDashboard {
  const history = state.session_history ?? [];
  const vocab = state.learning_memory?.vocab ?? [];
  const today = todayISO();
  const weekStart = startOfWeekMonday(new Date(`${today}T12:00:00.000Z`));

  const totalMinutes = history.reduce((sum, s) => sum + s.duration_min, 0);
  const daysThisWeek = new Set(
    history.filter((s) => s.date >= weekStart).map((s) => s.date),
  ).size;
  const thisWeek = history.filter((s) => s.date >= weekStart);
  const avgDurationMin =
    thisWeek.length > 0
      ? Math.round(
          (thisWeek.reduce((s, x) => s + x.duration_min, 0) / thisWeek.length) *
            10,
        ) / 10
      : 0;

  const enjoymentCounts: Record<Enjoyment, number> = {
    "😀": 0,
    "😐": 0,
    "🙁": 0,
  };
  for (const s of history) {
    if (s.enjoyment in enjoymentCounts) {
      enjoymentCounts[s.enjoyment] += 1;
    }
  }

  const topicsCompleted = [
    ...new Set(history.map((s) => s.topic).filter(Boolean)),
  ];

  return {
    totalMinutes,
    sessionCount: history.length,
    learnedWords: vocab.filter((v) => v.status === "learned").map((v) => v.word),
    learningWords: vocab
      .filter((v) => v.status === "learning")
      .map((v) => v.word),
    dueForReview: pickDueWords(vocab, 20, today),
    topicsCompleted,
    grammarCovered: state.learning_memory?.grammar_covered ?? [],
    grammarWeak: state.learning_memory?.grammar_weak ?? [],
    metrics: {
      daysThisWeek,
      avgDurationMin,
      enjoymentCounts,
      recentConfidence: history.slice(-5).map((s) => s.child_confidence),
    },
  };
}
