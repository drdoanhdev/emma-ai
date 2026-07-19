import { NextResponse } from "next/server";
import { getChildState, saveChildState } from "@/lib/state";
import type { DayMode, ChildState } from "@/lib/types";

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
    return NextResponse.json(state);
  } catch (err) {
    console.error("GET /api/parent/mission:", err);
    const message = err instanceof Error ? err.message : "Failed to load state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type MissionPatch = {
  parent_note?: string;
  day_mode?: DayMode;
};

export async function POST(request: Request) {
  let body: MissionPatch;
  try {
    body = (await request.json()) as MissionPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    body.day_mode !== undefined &&
    !DAY_MODES.includes(body.day_mode)
  ) {
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
    };
    await saveChildState(DEFAULT_CHILD, next);
    return NextResponse.json(next);
  } catch (err) {
    console.error("POST /api/parent/mission:", err);
    const message = err instanceof Error ? err.message : "Failed to save state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
