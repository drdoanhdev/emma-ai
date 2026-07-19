import { NextResponse } from "next/server";
import { getChildState, saveChildState } from "@/lib/state";
import { updateStateFromSession } from "@/lib/update-state";
import { DEFAULT_CHILD_ID } from "@/lib/child-id";
import type {
  ChildConfidence,
  Enjoyment,
  SessionReport,
} from "@/lib/types";

export const runtime = "nodejs";

const CONFIDENCE: ChildConfidence[] = ["good", "ok", "shy"];
const ENJOYMENT: Enjoyment[] = ["😀", "😐", "🙁"];

export async function POST(request: Request) {
  let body: Partial<SessionReport>;
  try {
    body = (await request.json()) as Partial<SessionReport>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body.duration_min !== "number" ||
    !body.topic ||
    !Array.isArray(body.words_correct) ||
    !Array.isArray(body.words_forgot) ||
    !body.child_confidence ||
    !CONFIDENCE.includes(body.child_confidence) ||
    !body.enjoyment ||
    !ENJOYMENT.includes(body.enjoyment)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid session report fields" },
      { status: 400 },
    );
  }

  const report: SessionReport = {
    duration_min: body.duration_min,
    topic: body.topic,
    words_correct: body.words_correct,
    words_forgot: body.words_forgot,
    child_confidence: body.child_confidence,
    enjoyment: body.enjoyment,
    notes: body.notes,
    grammar_weak: body.grammar_weak,
  };

  try {
    const state = await getChildState(DEFAULT_CHILD_ID);
    const next = updateStateFromSession(state, report);
    await saveChildState(DEFAULT_CHILD_ID, next);
    return NextResponse.json({ ok: true, state: next });
  } catch (err) {
    console.error("POST /api/session/complete:", err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
