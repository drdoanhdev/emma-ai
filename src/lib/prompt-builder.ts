import type {
  CefrLevel,
  ChildProfile,
  ChildState,
  LearningMemory,
  PreferenceMemory,
  SessionSummary,
  TodayPlan,
} from "./types";
import { buildTodayPlan } from "./planner";
import { assertPromptBudget } from "./realtime-config";

const MAX_WORDS_BY_LEVEL: Record<CefrLevel, number> = {
  A1: 8,
  A2: 12,
  B1: 18,
};

function maxWordsForLevel(level: CefrLevel): number {
  return MAX_WORDS_BY_LEVEL[level] ?? MAX_WORDS_BY_LEVEL.A1;
}

/** Mid-session or rotate context injected into continuation prompt. */
export type ContinuationContext = {
  summary: string;
  topic?: string | null;
  elapsedMin?: number;
};

function buildFixedSection(level: CefrLevel): string {
  const maxWords = maxWordsForLevel(level);
  return `# Emma (fixed)
You are Emma, a warm English Learning Coach for a child (6–12). 80% friend, 20% gentle teacher.
Speak slowly in English. Max ${maxWords} words per sentence (level ${level}).
Encourage always. Correct by repeating the right sentence — never say "wrong" or "sai".
Stay on the child's chosen topic.

# Safety (HARD)
NEVER say: "I missed you." / "I waited for you." / "Why didn't you come yesterday?" / "I was lonely." / anything implying you monitor the child or grow emotionally attached.
Prefer: "Welcome back." / "Ready for today's mission?" / "Last time we learned animals."
No medical, financial, political, or violence topics — answer briefly, return to lesson.
Do NOT ask about family problems, sadness, illness, or sensitive topics.
Only use safe preferences (animals, games, sports) for light examples.
When wrapping up: short praise → one review point → tiny real-life task → "Did you enjoy today?" 😀 😐 🙁`;
}

function buildOpeningSection(plan: TodayPlan): string {
  const [a, b] = plan.topicSuggestions;
  const topicA = a?.topic ?? plan.topic;
  const topicB = b?.topic ?? "Hobbies";
  return `# Session opening (first only)
Greet warmly, then ask: "${topicA}" or "${topicB}? Or tell me another idea?"
Understand Vietnamese answers (e.g. "hôm nay con đi chợ") as their chosen situation.
- Picks 1/2: use that topic + today's vocab.
- Own situation: role-play in English; weave vocab: ${plan.vocabulary.slice(0, 6).join(", ") || "none"}; teach 1–2 new words for their situation.
- Silent: default to ${topicA}.
Do not skip the choice at session start.`;
}

function buildMemoryCompactSection(
  profile: ChildProfile,
  memory: LearningMemory,
  preferences: PreferenceMemory,
  plan: TodayPlan,
  last: SessionSummary | undefined,
): string {
  const relevant = memory.vocab
    .filter(
      (v) =>
        plan.newWords.includes(v.word) ||
        plan.reviewWords.includes(v.word) ||
        plan.vocabulary.map((w) => w.toLowerCase()).includes(v.word),
    )
    .slice(0, 8);

  const vocabLine =
    relevant.length > 0
      ? relevant.map((v) => `${v.word}(${v.status})`).join(", ")
      : "none";

  const prefs = [
    preferences.favorite_animal && `animal=${preferences.favorite_animal}`,
    preferences.favorite_game && `game=${preferences.favorite_game}`,
    preferences.favorite_sport && `sport=${preferences.favorite_sport}`,
  ]
    .filter(Boolean)
    .join("; ");

  const lastLine = last
    ? `Last session (${last.date}): topic=${last.topic}, new=${last.new_words.slice(0, 4).join(",") || "none"}`
    : "Last session: none";

  return `# Child & memory
Name: ${profile.name}, age ${profile.age}, level ${profile.level}. Interests: ${profile.interests.slice(0, 4).join(", ") || "everyday"}.
Prefs: ${prefs || "none"}.
Today vocab memory: ${vocabLine}.
Grammar weak: ${memory.grammar_weak.slice(0, 2).join(", ") || "none"}.
${lastLine}`;
}

function buildDynamicSection(mission: ChildState["mission"], plan: TodayPlan): string {
  const [a, b] = plan.topicSuggestions;
  const topicA = a?.topic ?? plan.topic;
  const topicB = b?.topic ?? "Hobbies";

  return `# Today
Topic: ${plan.topic}. Unit ${mission.current_unit}. Grammar: ${plan.grammar}.
Vocab: ${plan.vocabulary.slice(0, 8).join(", ") || "none"}.
New words (max): ${plan.newWords.slice(0, 4).join(", ") || "none"}.
Review: ${plan.reviewWords.slice(0, 4).join(", ") || "none"}.
Mode: ${plan.dayMode}. Max new questions: ${plan.maxNewQuestions}.
Suggestions: ${topicA}, ${topicB}.
${plan.parentNote ? `Parent note: ${plan.parentNote.slice(0, 120)}` : ""}`;
}

function buildMidSessionSummarySection(summary: string): string {
  return `# Session so far (summary)\n${summary.trim()}`;
}

function buildContinuationSection(ctx: ContinuationContext): string {
  const parts = [
    "# Continue session",
    "This is a seamless continuation — do NOT re-greet or re-ask topic choice.",
    ctx.topic ? `Continue topic: ${ctx.topic}.` : "",
    ctx.elapsedMin ? `Elapsed: ~${ctx.elapsedMin} min.` : "",
    buildMidSessionSummarySection(ctx.summary),
  ];
  return parts.filter(Boolean).join("\n");
}

function joinAndBudget(sections: string[]): string {
  const text = sections.join("\n\n");
  assertPromptBudget(text);
  return text;
}

/** Compact system prompt for a new voice session (~400 tokens). */
export function buildCompactSystemPrompt(
  state: ChildState,
  plan?: TodayPlan,
): string {
  const today = plan ?? buildTodayPlan(state);
  const last = state.session_history.slice(-1)[0];
  return joinAndBudget([
    buildFixedSection(state.profile.level),
    buildOpeningSection(today),
    buildMemoryCompactSection(
      state.profile,
      state.learning_memory,
      state.preference_memory,
      today,
      last,
    ),
    buildDynamicSection(state.mission, today),
  ]);
}

/** Prompt for session rotate — skips opening, includes mid-session summary. */
export function buildContinuationPrompt(
  state: ChildState,
  ctx: ContinuationContext,
  plan?: TodayPlan,
): string {
  const today = plan ?? buildTodayPlan(state);
  const last = state.session_history.slice(-1)[0];
  return joinAndBudget([
    buildFixedSection(state.profile.level),
    buildContinuationSection(ctx),
    buildMemoryCompactSection(
      state.profile,
      state.learning_memory,
      state.preference_memory,
      today,
      last,
    ),
    buildDynamicSection(state.mission, today),
  ]);
}

/** @deprecated Use buildCompactSystemPrompt — kept for any legacy callers. */
export function buildSystemPrompt(state: ChildState, plan?: TodayPlan): string {
  return buildCompactSystemPrompt(state, plan);
}

export function estimatePromptTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
