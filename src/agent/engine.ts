import { executeLocalTool, ToolCall } from "./tools";
import { askPermission, resetTrust } from "./permissions";

const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

export type AgentConfig = {
  apiCall: (message: string | null, opts: { agentMode: boolean; conversationId?: string; toolResults?: any[] }) => Promise<any>;
};

export async function agentLoop(message: string, config: AgentConfig, conversationId?: string): Promise<{ text: string; conversationId: string }> {
  let currentConvoId = conversationId;
  let iterations = 0;
  const MAX_ITERATIONS = 10;

  // Initial request
  let response = await config.apiCall(message, { agentMode: true, conversationId: currentConvoId });
  currentConvoId = response.conversationId || currentConvoId;

  while (response.localToolCalls?.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const results: { id: string; result: string }[] = [];

    for (const tool of response.localToolCalls as ToolCall[]) {
      const allowed = await askPermission(tool);
      if (!allowed) {
        results.push({ id: tool.id, result: "User denied this action." });
        console.log(`  ${DIM}⊘ Skipped${RESET}`);
        continue;
      }

      try {
        console.log(`  ${DIM}⟳ Running...${RESET}`);
        const result = await executeLocalTool(tool);
        const truncated = result.length > 4000 ? result.slice(0, 4000) + "\n... (truncated)" : result;
        results.push({ id: tool.id, result: truncated });
        console.log(`  ${GREEN}✓${RESET} ${DIM}Done${RESET}`);
      } catch (e: any) {
        results.push({ id: tool.id, result: `Error: ${e.message}` });
        console.log(`  ${RED}✗${RESET} ${e.message}`);
      }
    }

    // Send results back to API
    console.log(`${DIM}thinking...${RESET}`);
    response = await config.apiCall(null, { agentMode: true, conversationId: currentConvoId, toolResults: results });
    currentConvoId = response.conversationId || currentConvoId;
  }

  if (iterations >= MAX_ITERATIONS) {
    return { text: (response.message || "") + "\n\n⚠️ Reached max iterations (10). Let me know if you need more.", conversationId: currentConvoId! };
  }

  return { text: response.message || "", conversationId: currentConvoId! };
}

export { resetTrust };
