"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetTrust = void 0;
exports.agentLoop = agentLoop;
const tools_1 = require("./tools");
const permissions_1 = require("./permissions");
Object.defineProperty(exports, "resetTrust", { enumerable: true, get: function () { return permissions_1.resetTrust; } });
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
async function agentLoop(message, config, conversationId) {
    let currentConvoId = conversationId;
    let iterations = 0;
    const MAX_ITERATIONS = 10;
    // Initial request
    let response = await config.apiCall(message, { agentMode: true, conversationId: currentConvoId });
    currentConvoId = response.conversationId || currentConvoId;
    while (response.localToolCalls?.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        const results = [];
        for (const tool of response.localToolCalls) {
            const allowed = await (0, permissions_1.askPermission)(tool);
            if (!allowed) {
                results.push({ id: tool.id, result: "User denied this action." });
                console.log(`  ${DIM}⊘ Skipped${RESET}`);
                continue;
            }
            try {
                console.log(`  ${DIM}⟳ Running...${RESET}`);
                const result = await (0, tools_1.executeLocalTool)(tool);
                const truncated = result.length > 4000 ? result.slice(0, 4000) + "\n... (truncated)" : result;
                results.push({ id: tool.id, result: truncated });
                console.log(`  ${GREEN}✓${RESET} ${DIM}Done${RESET}`);
            }
            catch (e) {
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
        return { text: (response.message || "") + "\n\n⚠️ Reached max iterations (10). Let me know if you need more.", conversationId: currentConvoId };
    }
    return { text: response.message || "", conversationId: currentConvoId };
}
