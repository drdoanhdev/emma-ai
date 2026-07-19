import { Redis } from "@upstash/redis";
import type { ChildState } from "./types";
import { KHANG_SEED } from "./seed-khang";
import { defaultChildState, normalizeChildState } from "./normalize-state";
import { DEFAULT_CHILD_ID } from "./child-id";

const SEEDS: Record<string, ChildState> = {
  [DEFAULT_CHILD_ID]: defaultChildState(KHANG_SEED),
};

function childKey(childId: string): string {
  return `child:${childId}`;
}

function getRedisEnv(): { url: string; token: string } {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    "";

  if (!url || !token) {
    throw new Error(
      "Missing Redis env. Set KV_REST_API_URL + KV_REST_API_TOKEN " +
        "(or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) in .env.local / Vercel.",
    );
  }

  return { url, token };
}

let redisSingleton: Redis | null = null;

function getRedis(): Redis {
  if (!redisSingleton) {
    const { url, token } = getRedisEnv();
    redisSingleton = new Redis({ url, token });
  }
  return redisSingleton;
}

/**
 * Load child state. Migrates legacy `child:minh` → `child:khang` once if needed.
 */
export async function getChildState(
  childId: string = DEFAULT_CHILD_ID,
): Promise<ChildState> {
  const redis = getRedis();
  const key = childKey(childId);
  let stored = await redis.get<ChildState>(key);

  // One-time migrate from Week 1–2 key
  if (!stored && childId === DEFAULT_CHILD_ID) {
    const legacy = await redis.get<ChildState>(childKey("minh"));
    if (legacy) {
      stored = normalizeChildState({
        ...legacy,
        profile: {
          ...legacy.profile,
          name: "Duy Khang",
        },
      });
      await redis.set(key, stored);
    }
  }

  if (stored) {
    const normalized = normalizeChildState(stored);
    // Ensure display name matches the household child
    if (
      childId === DEFAULT_CHILD_ID &&
      normalized.profile.name !== "Duy Khang"
    ) {
      normalized.profile = { ...normalized.profile, name: "Duy Khang" };
      await redis.set(key, normalized);
      return normalized;
    }
    if (
      !stored.learning_memory ||
      !stored.preference_memory ||
      !stored.session_history
    ) {
      await redis.set(key, normalized);
    }
    return normalized;
  }

  const seed = SEEDS[childId];
  if (!seed) {
    throw new Error(`Unknown childId (no seed): ${childId}`);
  }

  await redis.set(key, seed);
  return seed;
}

export async function saveChildState(
  childId: string,
  state: ChildState,
): Promise<void> {
  const redis = getRedis();
  await redis.set(childKey(childId), normalizeChildState(state));
}
