import {
  REALTIME_COMPACT_EVERY_TURNS,
  REALTIME_KEEP_TURNS,
} from "./realtime-config";

export type TurnRole = "user" | "assistant";

export type Turn = {
  itemId: string;
  role: TurnRole;
  text: string;
};

export type UsageStats = {
  lastInputTokens: number;
  lastTotalTokens: number;
  turnPairCount: number;
  compactionCount: number;
  rotateCount: number;
};

export class RealtimeSessionManager {
  turns: Turn[] = [];
  summaryText: string | null = null;
  topicChosen: string | null = null;
  turnPairCount = 0;
  lastInputTokens = 0;
  lastTotalTokens = 0;
  compactionCount = 0;
  rotateCount = 0;
  isCompacting = false;
  pendingAssistantItemId: string | null = null;

  private readonly compactEvery: number;
  private readonly keepTurns: number;

  constructor(
    compactEvery = REALTIME_COMPACT_EVERY_TURNS,
    keepTurns = REALTIME_KEEP_TURNS,
  ) {
    this.compactEvery = compactEvery;
    this.keepTurns = keepTurns;
  }

  resetForNewSession(carrySummary?: string | null, carryTopic?: string | null): void {
    this.turns = [];
    if (carrySummary) this.summaryText = carrySummary;
    if (carryTopic) this.topicChosen = carryTopic;
    this.turnPairCount = 0;
    this.pendingAssistantItemId = null;
    this.isCompacting = false;
  }

  setPendingAssistantItemId(itemId: string): void {
    this.pendingAssistantItemId = itemId;
  }

  onUsage(inputTokens: number, totalTokens: number): void {
    this.lastInputTokens = inputTokens;
    this.lastTotalTokens = totalTokens;
  }

  onTranscript(role: TurnRole, text: string, itemId?: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    const id =
      itemId ??
      (role === "assistant" && this.pendingAssistantItemId
        ? this.pendingAssistantItemId
        : `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

    if (role === "assistant") {
      this.pendingAssistantItemId = null;
    }

    const existing = this.turns.find((t) => t.itemId === id);
    if (existing) {
      existing.text = trimmed;
      return;
    }

    this.turns.push({ itemId: id, role, text: trimmed });

    if (role === "user" && this.turns.length === 1) {
      this.topicChosen = trimmed.slice(0, 120);
    }

    if (role === "assistant") {
      this.turnPairCount += 1;
    }
  }

  shouldCompact(): boolean {
    return (
      !this.isCompacting &&
      this.turnPairCount > 0 &&
      this.turnPairCount % this.compactEvery === 0 &&
      this.turnsToSummarize().length > 0
    );
  }

  /** Turns to fold into summary (everything except last N user+assistant pairs). */
  turnsToSummarize(): Turn[] {
    const keepCount = this.keepTurns * 2;
    if (this.turns.length <= keepCount) return [];
    return this.turns.slice(0, this.turns.length - keepCount);
  }

  turnsToKeep(): Turn[] {
    const keepCount = this.keepTurns * 2;
    return this.turns.slice(-keepCount);
  }

  applyCompaction(summary: string): { deletedIds: string[]; kept: Turn[] } {
    const toDelete = this.turnsToSummarize();
    const kept = this.turnsToKeep();
    const deletedIds = toDelete.map((t) => t.itemId).filter((id) => !id.startsWith("local-"));

    this.summaryText = summary;
    this.turns = [...kept];
    this.turnPairCount = kept.filter((t) => t.role === "assistant").length;
    this.compactionCount += 1;
    this.isCompacting = false;

    return { deletedIds, kept };
  }

  beginCompaction(): void {
    this.isCompacting = true;
  }

  cancelCompaction(): void {
    this.isCompacting = false;
  }

  recordRotate(): void {
    this.rotateCount += 1;
  }

  getStats(): UsageStats {
    return {
      lastInputTokens: this.lastInputTokens,
      lastTotalTokens: this.lastTotalTokens,
      turnPairCount: this.turnPairCount,
      compactionCount: this.compactionCount,
      rotateCount: this.rotateCount,
    };
  }

  allTurnsForSummary(): Turn[] {
    return [...this.turns];
  }
}
