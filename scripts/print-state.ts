import { getChildState } from "../src/lib/state";
import { buildTopicSuggestions, buildTodayPlan } from "../src/lib/planner";

async function main() {
  const s = await getChildState();
  const plan = buildTodayPlan(s);
  const suggestions = buildTopicSuggestions(s);
  console.log(
    JSON.stringify(
      {
        profile: {
          name: s.profile.name,
          level: s.profile.level,
          start_date: s.profile.start_date,
          interests: s.profile.interests,
        },
        mission: {
          current_unit: s.mission.current_unit,
          topic: s.mission.topic,
          parent_note: s.mission.parent_note,
          day_mode: s.mission.day_mode,
          vocabulary: s.mission.vocabulary,
        },
        topicSuggestions: suggestions.map((u) => ({
          unit: u.unit,
          topic: u.topic,
        })),
        plan: {
          contentSource: plan.contentSource,
          newWords: plan.newWords,
          reviewWords: plan.reviewWords,
        },
        learning_memory: {
          vocab_count: s.learning_memory.vocab.length,
          learned: s.learning_memory.vocab.filter((v) => v.status === "learned")
            .length,
          grammar_covered: s.learning_memory.grammar_covered.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
