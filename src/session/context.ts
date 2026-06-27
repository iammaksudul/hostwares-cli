/**
 * Context window tracking and auto-compaction.
 * Mirrors Kiro's token_counter.rs + CompactStrategy approach.
 */

export interface ContextState {
  totalChars: number;
  estimatedTokens: number;
  maxTokens: number;
  usagePercent: number;
  warningLevel: "none" | "warning" | "critical";
  messageCount: number;
}

const MAX_CONTEXT_TOKENS = 180000;
const WARNING_THRESHOLD = 0.6;  // 60% = show warning
const CRITICAL_THRESHOLD = 0.75; // 75% = auto-compact
const CHARS_PER_TOKEN = 4;

export function calculateContext(history: { role: string; content: string }[]): ContextState {
  const totalChars = history.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
  const usagePercent = Math.round((estimatedTokens / MAX_CONTEXT_TOKENS) * 100);
  
  let warningLevel: "none" | "warning" | "critical" = "none";
  if (usagePercent >= CRITICAL_THRESHOLD * 100) warningLevel = "critical";
  else if (usagePercent >= WARNING_THRESHOLD * 100) warningLevel = "warning";

  return {
    totalChars,
    estimatedTokens,
    maxTokens: MAX_CONTEXT_TOKENS,
    usagePercent,
    warningLevel,
    messageCount: history.length,
  };
}

export function shouldAutoCompact(context: ContextState): boolean {
  return context.warningLevel === "critical";
}

/**
 * Compact strategy (like Kiro's CompactStrategy):
 * - Keep last N message pairs
 * - Generate summary of older messages via API
 * - Replace history with summary + kept messages
 */
export function compactHistory(
  history: { role: string; content: string }[],
  keepLastPairs: number = 4,
  summary?: string,
): { role: string; content: string }[] {
  const keepCount = keepLastPairs * 2; // pairs = user + assistant
  const kept = history.slice(-keepCount);
  
  const compacted: { role: string; content: string }[] = [];
  if (summary) {
    compacted.push({ role: "assistant", content: `[Context Summary] ${summary}` });
  }
  compacted.push(...kept);
  return compacted;
}

export function formatContextBar(context: ContextState): string {
  const used = (context.estimatedTokens / 1000).toFixed(1);
  const indicator = context.warningLevel === "critical" ? "⚠" : 
                    context.warningLevel === "warning" ? "△" : "";
  return `${used}K (${context.usagePercent}%)${indicator ? " " + indicator : ""}`;
}
