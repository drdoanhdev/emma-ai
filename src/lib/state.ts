import { Redis } from "@upstash/redis";
import type { ChildState } from "./types";
import minhSeed from "../../data/minh.json";

const DEFAULT_CHILD = "minh";

/** Seed used when Redis key is empty (first run / new deploy). */
const SEEDS: Record<string, ChildState> = {
  minh: minhSeed as ChildState,
};

function childKey(childId: string): string {
  return `child:${childId}`;
}

/**
 * Resolve Redis REST credentials.
 * Supports Vercel KV names and native Upstash names.
 * (.env.local currently may only have OPENAI_API_KEY — add Redis vars before use.)
 */
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
    return stored;
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
  await redis.set(childKey(childId), state);
}
