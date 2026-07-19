import type { ChildState } from "./types";
import minhState from "../../data/minh.json";

const DEFAULT_CHILD = "minh";

/** Bundled seeds — works on Vercel (no filesystem read at runtime). */
const BUNDLED: Record<string, ChildState> = {
  minh: minhState as ChildState,
};

/**
 * Load child state for Prompt Builder.
 * Prefer CHILD_STATE_JSON env (Vercel) when set; otherwise use bundled data/*.json.
 */
export async function loadChildState(
  childName: string = DEFAULT_CHILD,
): Promise<ChildState> {
  const fromEnv = process.env.CHILD_STATE_JSON?.trim();
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as ChildState;
    } catch {
      throw new Error("CHILD_STATE_JSON is not valid JSON");
    }
  }

  const state = BUNDLED[childName];
  if (!state) {
    throw new Error(`Unknown child: ${childName}`);
  }
  return state;
}
