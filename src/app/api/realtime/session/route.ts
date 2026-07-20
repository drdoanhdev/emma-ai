import { NextResponse } from "next/server";
import { getChildState } from "@/lib/state";
import { buildTodayPlan } from "@/lib/planner";
import {
  buildCompactSystemPrompt,
  buildContinuationPrompt,
  type ContinuationContext,
} from "@/lib/prompt-builder";
import { DEFAULT_CHILD_ID } from "@/lib/child-id";
import {
  REALTIME_MODEL,
  REALTIME_VOICE,
  REALTIME_MAX_OUTPUT_TOKENS,
  REALTIME_POST_INSTRUCTIONS,
  REALTIME_RETENTION_RATIO,
  maxOutputTokensForLevel,
  getRealtimeSessionMeta,
} from "@/lib/realtime-config";

export const runtime = "nodejs";

type SessionRequestBody = {
  sdp: string;
  continuation?: ContinuationContext;
};

function parseRequestBody(raw: string, contentType: string | null): SessionRequestBody {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Missing SDP offer body");
  }

  const isJson =
    contentType?.includes("application/json") || trimmed.startsWith("{");
  if (!isJson) {
    return { sdp: raw };
  }

  const parsed = JSON.parse(raw) as SessionRequestBody;
  if (!parsed.sdp?.trim()) {
    throw new Error("Missing sdp in JSON body");
  }
  return parsed;
}

/**
 * Unified WebRTC session: browser sends SDP offer (raw or JSON);
 * server loads child state, builds compact prompt, authenticates with OPENAI_API_KEY.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY (.env.local or Vercel env)" },
      { status: 500 },
    );
  }

  const contentType = request.headers.get("content-type");
  const rawBody = await request.text();

  let sdpOffer: string;
  let continuation: ContinuationContext | undefined;
  try {
    const body = parseRequestBody(rawBody, contentType);
    sdpOffer = body.sdp;
    continuation = body.continuation;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let instructions: string;
  let level: "A1" | "A2" | "B1";
  try {
    const state = await getChildState(DEFAULT_CHILD_ID);
    const plan = buildTodayPlan(state);
    level = state.profile.level;
    instructions = continuation
      ? buildContinuationPrompt(state, continuation, plan)
      : buildCompactSystemPrompt(state, plan);
  } catch (err) {
    console.error("Failed to load child state / build prompt:", err);
    const message =
      err instanceof Error ? err.message : "Failed to build system prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const maxOutput = maxOutputTokensForLevel(level);

  const sessionConfig = JSON.stringify({
    type: "realtime",
    model: REALTIME_MODEL,
    instructions,
    max_output_tokens: maxOutput,
    truncation: {
      type: "retention_ratio",
      retention_ratio: REALTIME_RETENTION_RATIO,
      token_limits: {
        post_instructions: REALTIME_POST_INSTRUCTIONS,
      },
    },
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
  const meta = getRealtimeSessionMeta(level);

  return NextResponse.json({
    sdp: answerSdp,
    meta: {
      ...meta,
      maxOutputTokens: maxOutput,
      model: REALTIME_MODEL,
      promptMaxOutputCeiling: REALTIME_MAX_OUTPUT_TOKENS,
    },
  });
}
