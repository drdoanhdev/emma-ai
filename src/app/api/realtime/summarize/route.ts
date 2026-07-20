import { NextResponse } from "next/server";
import type { Turn } from "@/lib/realtime-session-manager";
import type { CefrLevel } from "@/lib/types";

export const runtime = "nodejs";

const SUMMARIZE_MODEL = "gpt-4o-mini";

type SummarizeRequest = {
  turns: Turn[];
  priorSummary?: string;
  childName: string;
  level: CefrLevel;
};

const SUMMARIZE_SYSTEM = `You compress an English tutoring voice session into a short factual summary for the tutor's context window.
Rules:
- Only learning facts: topic, new words taught, words practiced, child's good phrases.
- Max ~100 tokens. Bullet format.
- Do NOT include family problems, emotions, illness, or sensitive personal details.
- Output exactly this structure:

Session so far:
- Topic: ...
- New words taught: ...
- Child said well: ...
- Still practicing: ...`;

function formatTurns(turns: Turn[]): string {
  return turns
    .map((t) => `${t.role === "user" ? "Child" : "Emma"}: ${t.text}`)
    .join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  let body: SummarizeRequest;
  try {
    body = (await request.json()) as SummarizeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.turns?.length) {
    return NextResponse.json({ error: "No turns to summarize" }, { status: 400 });
  }

  const convo = formatTurns(body.turns);
  const userContent = [
    body.priorSummary ? `Prior summary:\n${body.priorSummary}\n` : "",
    `Child: ${body.childName}, level ${body.level ?? "A1"}`,
    `Transcript:\n${convo}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SUMMARIZE_MODEL,
      max_tokens: 150,
      temperature: 0.2,
      messages: [
        { role: "system", content: SUMMARIZE_SYSTEM },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Summarize API error:", res.status, detail);
    return NextResponse.json(
      { error: "Failed to summarize session" },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    return NextResponse.json({ error: "Empty summary" }, { status: 502 });
  }

  return NextResponse.json({ summary });
}
