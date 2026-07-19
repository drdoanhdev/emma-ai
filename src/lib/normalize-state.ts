import type { ChildState } from "./types";
import {
  EMPTY_LEARNING_MEMORY,
  EMPTY_PREFERENCE_MEMORY,
} from "./types";

/** Fill missing Week 3+ fields for older Redis payloads. */
export function normalizeChildState(raw: ChildState): ChildState {
  const interests = raw.profile?.interests ?? [];
  const pref = raw.preference_memory;

  return {
    profile: raw.profile,
    mission: raw.mission,
    learning_memory: {
      vocab: raw.learning_memory?.vocab ?? [],
      grammar_covered: raw.learning_memory?.grammar_covered ?? [],
      grammar_weak: raw.learning_memory?.grammar_weak ?? [],
    },
    preference_memory: {
      favorite_animal:
        pref?.favorite_animal ??
        EMPTY_PREFERENCE_MEMORY.favorite_animal,
      favorite_game:
        pref?.favorite_game ||
        (interests.find((i) => /minecraft|game/i.test(i)) ?? ""),
      favorite_sport: pref?.favorite_sport ?? "",
    },
    session_history: raw.session_history ?? [],
  };
}

export function defaultChildState(seed: ChildState): ChildState {
  return normalizeChildState({
    ...seed,
    learning_memory: seed.learning_memory ?? EMPTY_LEARNING_MEMORY,
    preference_memory: seed.preference_memory ?? EMPTY_PREFERENCE_MEMORY,
    session_history: seed.session_history ?? [],
  });
}
