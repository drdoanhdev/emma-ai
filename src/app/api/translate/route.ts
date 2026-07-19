import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Short EN → VI translation for live captions.
 * API key stays on the server.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY (.env.local or Vercel env)" },
      { status: 500 },
    );
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: string };
    text = body.text?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You translate English speech captions into natural Vietnamese for parents of a child learning English. Reply with ONLY the Vietnamese translation — no quotes, no explanation.",
        },
        { role: "user", content: text },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const detail = await openaiRes.text();
    console.error("Translate error:", openaiRes.status, detail);
    return NextResponse.json(
      { error: "Translation failed", detail },
      { status: 502 },
    );
  }

  const data = (await openaiRes.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const translation = data.choices?.[0]?.message?.content?.trim() ?? "";
  return NextResponse.json({ translation });
}
