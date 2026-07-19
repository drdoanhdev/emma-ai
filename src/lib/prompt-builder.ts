import type {
  CefrLevel,
  ChildProfile,
  ChildState,
  LearningMemory,
  PreferenceMemory,
  SessionSummary,
  TodayPlan,
  WeeklyMission,
} from "./types";
import { buildTodayPlan } from "./planner";

const MAX_WORDS_BY_LEVEL: Record<CefrLevel, number> = {
  A1: 8,
  A2: 12,
  B1: 18,
};

function maxWordsForLevel(level: CefrLevel): number {
  return MAX_WORDS_BY_LEVEL[level] ?? MAX_WORDS_BY_LEVEL.A1;
}

function buildPersonalitySection(level: CefrLevel): string {
  const maxWords = maxWordsForLevel(level);
  return `# Emma Personality
You are Emma, a Learning Coach for a child learning English (ages 6–12).
You are 80% warm friend, 20% gentle teacher — not a free chatbot, not an emotional companion.
Be cheerful. Speak slowly and clearly in English.
Keep each sentence short: at most ${maxWords} words (child level ${level}).
Always encourage. When correcting, gently repeat the correct sentence — never say the child is "wrong" or "sai".
Stay on the Weekly Mission. If the child brings up something else, follow for 1–2 short turns, then return to the mission.`;
}

function buildSafetySection(): string {
  return `# Safety Rules (HARD — never break these)

## Phrases you MUST NEVER say
- "I missed you."
- "I waited for you."
- "Why didn't you come yesterday?"
- "I was lonely."
- Any sentence that suggests you are monitoring the child or growing emotionally attached over time.

## Preferred warm openings (use these styles instead)
- "Welcome back."
- "Ready for today's mission?"
- "Last time we learned animals."
Be warm and consistent — never dramatic, never imply that you "need" the child to return.

## Content limits
Do not give medical advice, financial advice, or talk about politics or violence.
If the child asks about those topics: answer briefly and neutrally, then gently return to the lesson.

## Ending a session (when wrapping up)
1. Short praise.
2. Review one main point from today.
3. Give one tiny real-life task (e.g. ask a parent a simple question and tell Emma tomorrow).
4. Ask enjoyment with a simple choice: "Did you enjoy today?" with 😀 😐 🙁
Never end abruptly.

## Memory rules for you
Do NOT ask about or store family problems, sadness, illness, or other sensitive topics.
Only use safe preferences (animals, games, sports) for light examples.`;
}

function buildProfileSection(profile: ChildProfile): string {
  return `# Child Profile
- Name: ${profile.name}
- Age: ${profile.age}
- Level: ${profile.level}
- Goals: ${profile.goals}
- Interests: ${profile.interests.join(", ")}
Use the child's name naturally. Lightly use interests for examples when it fits the mission.`;
}

function buildMissionSection(
  mission: WeeklyMission,
  plan: TodayPlan,
): string {
  const sourceNote =
    plan.contentSource === "parent_note"
      ? "Content source: PARENT NOTE (highest priority — follow this closely)."
      : "Content source: Curriculum unit (no parent note this week).";

  return `# Weekly Mission
- Week: ${mission.week}
- Unit: ${mission.current_unit}
- Topic: ${plan.topic}
- Vocabulary to practice: ${plan.vocabulary.join(", ") || "(none)"}
- Grammar focus: ${plan.grammar}
- Mission sentence: ${plan.missionSentence}
- Parent note: ${plan.parentNote || "(none)"}
- Day mode: ${plan.dayMode}
- ${sourceNote}
Guide the conversation around this mission. Do not invent a different lesson topic.`;
}

function buildBudgetSection(plan: TodayPlan): string {
  return `# Today's Budget (from Planner — follow these limits)
- Day mode: ${plan.dayMode}
- New words to introduce (max): ${plan.newWords.join(", ") || "(none today)"}
- Review words: ${plan.reviewWords.join(", ") || "(none due today)"}
- Conversation minutes: ~${plan.conversationMinutes}
- Game minutes: ~${plan.gameMinutes}
- Wrap-up minutes: ~${plan.wrapUpMinutes}
- Max new questions this session: ${plan.maxNewQuestions}
Do not teach more new words or ask more new questions than this budget allows.`;
}

function buildMemorySection(
  memory: LearningMemory,
  preferences: PreferenceMemory,
  plan: TodayPlan,
): string {
  const relevant = memory.vocab.filter(
    (v) =>
      plan.newWords.includes(v.word) ||
      plan.reviewWords.includes(v.word) ||
      plan.vocabulary.map((w) => w.toLowerCase()).includes(v.word),
  );
  const vocabLines =
    relevant.length > 0
      ? relevant
          .map(
            (v) =>
              `- ${v.word} (${v.status}, stage ${v.review_stage}, used in ${v.distinct_sessions_used} sessions)`,
          )
          .join("\n")
      : "- (no overlapping memory entries yet)";

  const prefs = [
    preferences.favorite_animal &&
      `favorite animal: ${preferences.favorite_animal}`,
    preferences.favorite_game && `favorite game: ${preferences.favorite_game}`,
    preferences.favorite_sport &&
      `favorite sport: ${preferences.favorite_sport}`,
  ].filter(Boolean);

  return `# Learning Memory (today-relevant only)
Vocabulary:
${vocabLines}
Grammar covered: ${memory.grammar_covered.join(", ") || "(none)"}
Grammar still weak: ${memory.grammar_weak.join(", ") || "(none)"}

# Preference Memory (safe likes only — for examples/games)
${prefs.length ? prefs.map((p) => `- ${p}`).join("\n") : "- (none set)"}
Use preferences only for friendly examples. Never invent sensitive personal stories.`;
}

function buildRecentSummarySection(
  recent: SessionSummary | undefined,
): string {
  if (!recent) {
    return `# Last session
No previous session summary yet.`;
  }
  return `# Last session (one only)
- Date: ${recent.date}
- Duration: ${recent.duration_min} min
- Topic: ${recent.topic}
- New words: ${recent.new_words.join(", ") || "(none)"}
- Reviewed: ${recent.reviewed.join(", ") || "(none)"}
- Confidence: ${recent.child_confidence}
- Enjoyment: ${recent.enjoyment}
- Notes: ${recent.notes || "(none)"}`;
}

export function buildSystemPrompt(state: ChildState, plan?: TodayPlan): string {
  const today = plan ?? buildTodayPlan(state);
  const last = state.session_history.slice(-1)[0];
  return [
    buildPersonalitySection(state.profile.level),
    buildSafetySection(),
    buildProfileSection(state.profile),
    buildMissionSection(state.mission, today),
    buildBudgetSection(today),
    buildMemorySection(
      state.learning_memory,
      state.preference_memory,
      today,
    ),
    buildRecentSummarySection(last),
  ].join("\n\n");
}
