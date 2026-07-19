import { NextResponse } from "next/server";
import { getChildState } from "@/lib/state";
import { buildTodayPlan } from "@/lib/planner";
import { buildSystemPrompt } from "@/lib/prompt-builder";
import { DEFAULT_CHILD_ID } from "@/lib/child-id";

export const runtime = "nodejs";

const REALTIME_MODEL = "gpt-realtime";
const REALTIME_VOICE = "coral";

/**
 * Unified WebRTC session: browser sends SDP offer;
 * server loads child state from Redis, builds prompt via Planner,
 * authenticates with OPENAI_API_KEY — key never reaches the client.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY (.env.local or Vercel env)" },
      { status: 500 },
    );
  }

  const sdpOffer = await request.text();
  if (!sdpOffer.trim()) {
    return NextResponse.json({ error: "Missing SDP offer body" }, { status: 400 });
  }

  let instructions: string;
  try {
    const state = await getChildState(DEFAULT_CHILD_ID);
    const plan = buildTodayPlan(state);
    instructions = buildSystemPrompt(state, plan);
  } catch (err) {
    console.error("Failed to load child state / build prompt:", err);
    const message =
      err instanceof Error ? err.message : "Failed to build system prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const sessionConfig = JSON.stringify({
    type: "realtime",
    model: REALTIME_MODEL,
    instructions,
    audio: {
      input: {
        turn_detection: { type: "server_vad" },
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en",
        },
      },
      output: {
        voice: REALTIME_VOICE,
        speed: 0.9,
      },
    },
  });

  const form = new FormData();
  form.set("sdp", sdpOffer);
  form.set("session", sessionConfig);

  const openaiRes = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!openaiRes.ok) {
    const detail = await openaiRes.text();
    console.error("OpenAI Realtime session error:", openaiRes.status, detail);
    return NextResponse.json(
      { error: "Failed to create Realtime session", detail },
      { status: 502 },
    );
  }

  const answerSdp = await openaiRes.text();
  return new NextResponse(answerSdp, {
    status: 200,
    headers: { "Content-Type": "application/sdp" },
  });
}
