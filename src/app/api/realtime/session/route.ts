import { NextResponse } from "next/server";
import { loadChildState } from "@/lib/load-child-state";
import { buildSystemPrompt } from "@/lib/prompt-builder";

export const runtime = "nodejs";

const REALTIME_MODEL = "gpt-realtime";
const REALTIME_VOICE = "coral";

/**
 * Unified WebRTC session: browser sends SDP offer;
 * server attaches session config (instructions from minh.json) and
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
    const state = await loadChildState("minh");
    instructions = buildSystemPrompt(state);
  } catch (err) {
    console.error("Failed to load child state / build prompt:", err);
    return NextResponse.json(
      { error: "Failed to load data/minh.json or build system prompt" },
      { status: 500 },
    );
  }

  const sessionConfig = JSON.stringify({
    type: "realtime",
    model: REALTIME_MODEL,
    instructions,
    audio: {
      input: {
        turn_detection: { type: "server_vad" },
        // Needed for English captions of what the child says
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en",
        },
      },
      output: {
        voice: REALTIME_VOICE,
        // Slightly slower speech for young learners
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
