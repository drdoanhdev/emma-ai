import { Redis } from "@upstash/redis";
import type { ChildState } from "./types";
import { KHANG_SEED } from "./seed-khang";
import { defaultChildState, normalizeChildState } from "./normalize-state";
import { DEFAULT_CHILD_ID } from "./child-id";
import { applyCurrentUnitToMission } from "./planner";

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

async function finalizeState(
  redis: Redis,
  key: string,
  raw: ChildState,
  childId: string,
): Promise<ChildState> {
  let normalized = normalizeChildState(raw);

  if (childId === DEFAULT_CHILD_ID && normalized.profile.name !== "Duy Khang") {
    normalized = {
      ...normalized,
      profile: { ...normalized.profile, name: "Duy Khang" },
    };
  }

  // Recalculate current_unit/topic from start_date when no parent_note (docs 3c / user req)
  const withUnit = applyCurrentUnitToMission(normalized);
  const changed =
    JSON.stringify(withUnit.mission) !== JSON.stringify(normalized.mission) ||
    withUnit.profile.start_date !== normalized.profile.start_date ||
    withUnit.profile.name !== raw.profile?.name ||
    !raw.learning_memory ||
    !raw.preference_memory ||
    !raw.session_history;

  if (changed) {
    await redis.set(key, withUnit);
  }

  return withUnit;
}

/**
 * Load child state. Migrates legacy `child:minh` → `child:khang` once if needed.
 * Also refreshes mission.current_unit / topic from curriculum weeks.
 */
export async function getChildState(
  childId: string = DEFAULT_CHILD_ID,
): Promise<ChildState> {
  const redis = getRedis();
  const key = childKey(childId);
  let stored = await redis.get<ChildState>(key);

  if (!stored && childId === DEFAULT_CHILD_ID) {
    const legacy = await redis.get<ChildState>(childKey("minh"));
    if (legacy) {
      stored = {
        ...legacy,
        profile: { ...legacy.profile, name: "Duy Khang" },
      };
    }
  }

  if (stored) {
    return finalizeState(redis, key, stored, childId);
  }

  const seed = SEEDS[childId];
  if (!seed) {
    throw new Error(`Unknown childId (no seed): ${childId}`);
  }

  const finalized = applyCurrentUnitToMission(seed);
  await redis.set(key, finalized);
  return finalized;
}

export async function saveChildState(
  childId: string,
  state: ChildState,
): Promise<void> {
  const redis = getRedis();
  await redis.set(childKey(childId), normalizeChildState(state));
}
