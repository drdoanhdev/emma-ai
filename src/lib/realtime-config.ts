import type { CefrLevel } from "./types";

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envFloat(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Server-side Realtime session defaults (override via env). */
export const REALTIME_MODEL = process.env.REALTIME_MODEL ?? "gpt-realtime";
export const REALTIME_VOICE = process.env.REALTIME_VOICE ?? "coral";
export const REALTIME_MAX_OUTPUT_TOKENS = envInt("REALTIME_MAX_OUTPUT_TOKENS", 50);
export const REALTIME_POST_INSTRUCTIONS = envInt("REALTIME_POST_INSTRUCTIONS", 1200);
export const REALTIME_RETENTION_RATIO = envFloat("REALTIME_RETENTION_RATIO", 0.8);
export const REALTIME_COMPACT_EVERY_TURNS = envInt("REALTIME_COMPACT_EVERY_TURNS", 10);
export const REALTIME_KEEP_TURNS = envInt("REALTIME_KEEP_TURNS", 5);
export const REALTIME_ROTATE_MINUTES = envInt("REALTIME_ROTATE_MINUTES", 5);
export const REALTIME_PROMPT_BUDGET = envInt("REALTIME_PROMPT_BUDGET", 600);

const MAX_OUTPUT_BY_LEVEL: Record<CefrLevel, number> = {
  A1: 40,
  A2: 50,
  B1: 60,
};

/** Level-based output cap; env default is the ceiling for A2. */
export function maxOutputTokensForLevel(level: CefrLevel): number {
  const levelCap = MAX_OUTPUT_BY_LEVEL[level] ?? MAX_OUTPUT_BY_LEVEL.A1;
  return Math.min(levelCap, REALTIME_MAX_OUTPUT_TOKENS);
}

export function estimatePromptTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function assertPromptBudget(text: string, max = REALTIME_PROMPT_BUDGET): void {
  const est = estimatePromptTokens(text);
  if (est > max) {
    console.warn(
      `[prompt-budget] Estimated ${est} tokens exceeds budget ${max} (chars=${text.length})`,
    );
  }
}

/** Client-safe session metadata returned alongside SDP answer. */
export type RealtimeSessionMeta = {
  maxOutputTokens: number;
  compactEveryTurns: number;
  keepTurns: number;
  rotateMinutes: number;
};

export function getRealtimeSessionMeta(level: CefrLevel): RealtimeSessionMeta {
  return {
    maxOutputTokens: maxOutputTokensForLevel(level),
    compactEveryTurns: REALTIME_COMPACT_EVERY_TURNS,
    keepTurns: REALTIME_KEEP_TURNS,
    rotateMinutes: REALTIME_ROTATE_MINUTES,
  };
}
