import { NextResponse } from "next/server";
import { getChildState, saveChildState } from "@/lib/state";
import { buildParentDashboard } from "@/lib/dashboard";
import type { DayMode, PreferenceMemory, ChildState } from "@/lib/types";

export const runtime = "nodejs";

const DEFAULT_CHILD = "minh";

const DAY_MODES: DayMode[] = [
  "normal",
  "tired",
  "light_only",
  "review_focus",
];

export async function GET() {
  try {
    const state = await getChildState(DEFAULT_CHILD);
    const dashboard = buildParentDashboard(state);
    return NextResponse.json({ state, dashboard });
  } catch (err) {
    console.error("GET /api/parent/mission:", err);
    const message = err instanceof Error ? err.message : "Failed to load state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ParentPatch = {
  parent_note?: string;
  day_mode?: DayMode;
  preference_memory?: Partial<PreferenceMemory>;
};

export async function POST(request: Request) {
  let body: ParentPatch;
  try {
    body = (await request.json()) as ParentPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.day_mode !== undefined && !DAY_MODES.includes(body.day_mode)) {
    return NextResponse.json(
      { error: `Invalid day_mode. Use: ${DAY_MODES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const current = await getChildState(DEFAULT_CHILD);
    const next: ChildState = {
      ...current,
      mission: {
        ...current.mission,
        ...(body.parent_note !== undefined
          ? { parent_note: body.parent_note }
          : {}),
        ...(body.day_mode !== undefined ? { day_mode: body.day_mode } : {}),
      },
      preference_memory: body.preference_memory
        ? {
            favorite_animal:
              body.preference_memory.favorite_animal ??
              current.preference_memory.favorite_animal,
            favorite_game:
              body.preference_memory.favorite_game ??
              current.preference_memory.favorite_game,
            favorite_sport:
              body.preference_memory.favorite_sport ??
              current.preference_memory.favorite_sport,
          }
        : current.preference_memory,
    };
    await saveChildState(DEFAULT_CHILD, next);
    const dashboard = buildParentDashboard(next);
    return NextResponse.json({ state: next, dashboard });
  } catch (err) {
    console.error("POST /api/parent/mission:", err);
    const message = err instanceof Error ? err.message : "Failed to save state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
