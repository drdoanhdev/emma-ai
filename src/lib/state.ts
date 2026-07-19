import { Redis } from "@upstash/redis";
import type { ChildState } from "./types";
import minhSeed from "../../data/minh.json";
import { defaultChildState, normalizeChildState } from "./normalize-state";

const DEFAULT_CHILD = "minh";

const SEEDS: Record<string, ChildState> = {
  minh: defaultChildState(minhSeed as ChildState),
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

export async function getChildState(
  childId: string = DEFAULT_CHILD,
): Promise<ChildState> {
  const redis = getRedis();
  const key = childKey(childId);
  const stored = await redis.get<ChildState>(key);

  if (stored) {
    const normalized = normalizeChildState(stored);
    // Persist migration so subsequent reads stay complete
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
