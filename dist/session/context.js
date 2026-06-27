"use strict";
/**
 * Context window tracking and auto-compaction.
 * Mirrors Kiro's token_counter.rs + CompactStrategy approach.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateContext = calculateContext;
exports.shouldAutoCompact = shouldAutoCompact;
exports.compactHistory = compactHistory;
exports.formatContextBar = formatContextBar;
const MAX_CONTEXT_TOKENS = 180000;
const WARNING_THRESHOLD = 0.6; // 60% = show warning
const CRITICAL_THRESHOLD = 0.75; // 75% = auto-compact
const CHARS_PER_TOKEN = 4;
function calculateContext(history) {
    const totalChars = history.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
    const usagePercent = Math.round((estimatedTokens / MAX_CONTEXT_TOKENS) * 100);
    let warningLevel = "none";
    if (usagePercent >= CRITICAL_THRESHOLD * 100)
        warningLevel = "critical";
    else if (usagePercent >= WARNING_THRESHOLD * 100)
        warningLevel = "warning";
    return {
        totalChars,
        estimatedTokens,
        maxTokens: MAX_CONTEXT_TOKENS,
        usagePercent,
        warningLevel,
        messageCount: history.length,
    };
}
function shouldAutoCompact(context) {
    return context.warningLevel === "critical";
}
/**
 * Compact strategy (like Kiro's CompactStrategy):
 * - Keep last N message pairs
 * - Generate summary of older messages via API
 * - Replace history with summary + kept messages
 */
function compactHistory(history, keepLastPairs = 4, summary) {
    const keepCount = keepLastPairs * 2; // pairs = user + assistant
    const kept = history.slice(-keepCount);
    const compacted = [];
    if (summary) {
        compacted.push({ role: "assistant", content: `[Context Summary] ${summary}` });
    }
    compacted.push(...kept);
    return compacted;
}
function formatContextBar(context) {
    const used = (context.estimatedTokens / 1000).toFixed(1);
    const indicator = context.warningLevel === "critical" ? "⚠" :
        context.warningLevel === "warning" ? "△" : "";
    return `${used}K (${context.usagePercent}%)${indicator ? " " + indicator : ""}`;
}
