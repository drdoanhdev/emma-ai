import { NextResponse } from "next/server";
import { getChildState } from "@/lib/state";
import { buildTodayPlan } from "@/lib/planner";

export const runtime = "nodejs";

const DEFAULT_CHILD = "minh";

/** Today's plan words — used by end-session checklist. */
export async function GET() {
  try {
    const state = await getChildState(DEFAULT_CHILD);
    const plan = buildTodayPlan(state);
    return NextResponse.json({
      topic: plan.topic,
      grammar: plan.grammar,
      newWords: plan.newWords,
      reviewWords: plan.reviewWords,
      vocabulary: plan.vocabulary,
    });
  } catch (err) {
    console.error("GET /api/session/today:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
