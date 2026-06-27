#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const PURPLE = "\x1b[35m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const BANNER = `
${PURPLE}██╗  ██╗██╗    ██╗${RESET}
${PURPLE}██║  ██║██║    ██║${RESET}    ${BOLD}Hostwares CLI${RESET} ${DIM}v1.1.0${RESET}
${PURPLE}███████║██║ █╗ ██║${RESET}    ${DIM}AI-Powered Cloud Hosting${RESET}
${PURPLE}██╔══██║██║███╗██║${RESET}
${PURPLE}██║  ██║╚███╔███╔╝${RESET}    ${GREEN}●${RESET} ${DIM}hostwares.com${RESET}
${PURPLE}╚═╝  ╚═╝ ╚══╝╚══╝${RESET}
`;

function showWelcome() {
  const config = getConfig();
  console.log(BANNER);
  if (config.apiKey) {
    console.log(`  ${GREEN}✓${RESET} Authenticated    ${DIM}(hw logout to switch)${RESET}`);
  } else {
    console.log(`  ${CYAN}→${RESET} Run ${BOLD}hw login${RESET} to get started`);
  }
  console.log(`\n${DIM}╭───────────────────────────────────────────────────────────────╮${RESET}`);
  console.log(`${DIM}│${RESET}  ${BOLD}hw deploy${RESET}   Deploy current project     ${DIM}│${RESET} ${BOLD}hw ask${RESET} "..."  AI help`);
  console.log(`${DIM}│${RESET}  ${BOLD}hw list${RESET}     Show all sites             ${DIM}│${RESET} ${BOLD}hw chat${RESET}      Interactive`);
  console.log(`${DIM}│${RESET}  ${BOLD}hw logs${RESET}     View deploy logs           ${DIM}│${RESET} ${BOLD}hw status${RESET}    Check health`);
  console.log(`${DIM}╰───────────────────────────────────────────────────────────────╯${RESET}\n`);
}

const CONFIG_DIR = join(homedir(), ".hostwares");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

function getConfig(): { apiKey: string; baseUrl: string } {
  if (!existsSync(CONFIG_FILE)) return { apiKey: "", baseUrl: "https://hostwares.com" };
  return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
}

function saveConfig(config: { apiKey: string; baseUrl: string }) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const { apiKey, baseUrl } = getConfig();
  if (!apiKey) { console.error("Not logged in. Run: hostwares login --token YOUR_API_KEY"); process.exit(1); }
  const res = await fetch(`${baseUrl}${path}`, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...opts.headers } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); console.error(`Error ${res.status}: ${e.error || res.statusText}`); process.exit(1); }
  return res.json();
}

let _conversationId: string | null = null;


async function checkForUpdate(): Promise<boolean> {
  try {
    const res = await fetch("https://raw.githubusercontent.com/iammaksudul/hostwares-cli/main/package.json", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const remote = await res.json();
    const localPkg = require("../package.json");
    if (remote.version && remote.version !== localPkg.version) {
      console.log(`${DIM}  New version available: ${remote.version} (current: ${localPkg.version}). Updating...${RESET}`);
      const { execSync } = require("child_process");
      execSync("curl -fsSL https://hostwares.com/install.sh | bash", { stdio: "pipe", timeout: 30000 });
      return true;
    }
  } catch {}
  return false;
}
let _lastCreditsUsed = 0;
let _lastBalance = 0;

async function chatStream(message: string): Promise<string> {
  const config = getConfig();
  const body: any = { message, agentMode: true };
  if (_conversationId) body.conversationId = _conversationId;
  
  const res = await fetch(`${config.baseUrl || "https://hostwares.com"}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || e.error || `HTTP ${res.status}`);
  }

  // Parse SSE stream
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream");
  
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  let firstChunk = true;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      
      try {
        const parsed = JSON.parse(data);
        
        if (parsed.type === "text" || parsed.type === "content_block_delta") {
          const text = parsed.text || parsed.delta?.text || "";
          if (text) {
            if (firstChunk) { process.stdout.write(`\n${CYAN}hw>${RESET} `); firstChunk = false; }
            process.stdout.write(text);
            fullText += text;
          }
        } else if (parsed.type === "message_stop" || parsed.type === "done") {
          if (parsed.conversationId) _conversationId = parsed.conversationId;
          if (parsed.creditsUsed) _lastCreditsUsed += parsed.creditsUsed;
          if (parsed.balance !== undefined) _lastBalance = parsed.balance;
        } else if (parsed.conversationId) {
          _conversationId = parsed.conversationId;
          if (parsed.creditsUsed) _lastCreditsUsed += parsed.creditsUsed;
          if (parsed.balance !== undefined) _lastBalance = parsed.balance;
        }
      } catch {}
    }
  }
  
  if (!firstChunk) process.stdout.write("\n");
  return fullText;
}

async function chat(message: string): Promise<string> {
  const body: any = { message, agentMode: true };
  if (_conversationId) body.conversationId = _conversationId;
  const data = await apiRaw("/api/chat", { method: "POST", body: JSON.stringify(body) });
  if (data.conversationId) _conversationId = data.conversationId;
  if (data.creditsUsed) _lastCreditsUsed += data.creditsUsed;
  if (data.balance !== undefined) _lastBalance = data.balance;

  // Agent mode: handle local tool calls
  if (data.localToolCalls?.length > 0) {
    const { agentLoop } = await import("./agent/engine.js");
    const result = await agentLoop(message, {
      apiCall: async (msg: string | null, opts: any) => {
        const b: any = { ...opts };
        if (msg) b.message = msg;
        if (_conversationId) b.conversationId = _conversationId;
        const d = await apiRaw("/api/chat", { method: "POST", body: JSON.stringify(b) });
        if (d.conversationId) _conversationId = d.conversationId;
        if (d.creditsUsed) _lastCreditsUsed += d.creditsUsed;
        if (d.balance !== undefined) _lastBalance = d.balance;
        return d;
      },
    }, _conversationId || undefined);
    _conversationId = result.conversationId;
    return result.text;
  }

  return data.text || data.message || JSON.stringify(data);
}

async function apiRaw(path: string, opts: RequestInit = {}): Promise<any> {
  const config = getConfig();
  const res = await fetch(`${config.baseUrl || "https://hostwares.com"}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}`, ...opts.headers as any },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || e.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const program = new Command();
program.name("hw").description("Hostwares CLI — AI DevOps from your terminal").version("1.0.0");

// Login
program.command("login").description("Authenticate with Hostwares").option("-t, --token <key>", "API key (skip browser flow)").action(async (opts) => {
  if (opts.token) { saveConfig({ apiKey: opts.token, baseUrl: "https://hostwares.com" }); console.log("✓ Logged in"); return; }

  const baseUrl = "https://hostwares.com";
  console.log("Authenticating with Hostwares...\n");

  // Request device code
  const res = await fetch(`${baseUrl}/api/auth/device`, { method: "POST" });
  if (!res.ok) { console.error("Failed to start auth. Try: hostwares login --token YOUR_KEY"); return; }
  const { device_code, user_code, verification_url } = await res.json();

  console.log(`  Open this URL in your browser:\n`);
  console.log(`  ${verification_url}\n`);
  console.log(`  Confirmation code: ${user_code}\n`);

  // Try to open browser
  const { exec } = await import("child_process");
  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${openCmd} "${verification_url}"`);

  console.log("  Waiting for authorization...");

  // Poll until approved
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const poll = await fetch(`${baseUrl}/api/auth/device-poll?code=${device_code}`);
    const data = await poll.json();
    if (data.status === "approved") {
      saveConfig({ apiKey: data.token, baseUrl });
      console.log("\n  ✓ Logged in successfully!\n");
      return;
    }
    if (data.error === "expired") { console.error("\n  ✗ Code expired. Run 'hostwares login' again."); return; }
  }
  console.error("\n  ✗ Timed out. Run 'hostwares login' again.");
});

// Deploy
program.command("deploy").description("Deploy current directory or a GitHub repo").option("-n, --name <name>", "Site name").option("-r, --repo <url>", "GitHub repo URL").option("-b, --branch <branch>", "Branch", "main").action(async (opts) => {
  const name = opts.name || process.cwd().split("/").pop();
  const repo = opts.repo || "";
  console.log(`Deploying ${name}...`);
  const result = await chat(`Deploy a site named "${name}"${repo ? ` from ${repo} branch ${opts.branch}` : " from my current project"}`);
  console.log(result);
});

// List sites
program.command("list").alias("ls").description("List all sites").action(async () => {
  const sites = await api("/api/sites");
  if (!sites.length) { console.log("No sites yet. Run: hostwares deploy"); return; }
  console.log("\nYour sites:\n");
  for (const s of sites) {
    const icon = s.status === "RUNNING" ? "🟢" : s.status === "DEPLOYING" ? "🟡" : "🔴";
    console.log(`  ${icon} ${s.name.padEnd(25)} ${(s.domain || "no domain").padEnd(35)} ${s.status}`);
  }
  console.log("");
});

// Status
program.command("status <name>").description("Get site status").action(async (name) => {
  const result = await chat(`What's the status of ${name}?`);
  console.log(result);
});

// Logs
program.command("logs <name>").description("View deployment logs").action(async (name) => {
  const result = await chat(`Show deployment logs for ${name}`);
  console.log(result);
});

// Restart/Stop/Start
program.command("restart <name>").description("Restart a site").action(async (name) => { console.log(await chat(`Restart ${name}`)); });
program.command("stop <name>").description("Stop a site").action(async (name) => { console.log(await chat(`Stop ${name}`)); });
program.command("start <name>").description("Start a site").action(async (name) => { console.log(await chat(`Start ${name}`)); });

// Env vars
program.command("env <name>").description("Manage environment variables").argument("[action]", "set/delete").argument("[value]", "KEY=VALUE").action(async (name, action, value) => {
  if (action === "set" && value) { console.log(await chat(`Set env var ${value} on ${name}`)); }
  else { console.log(await chat(`Show env vars for ${name}`)); }
});

// Domain
program.command("domain <name> <domain>").description("Set custom domain").action(async (name, domain) => {
  console.log(await chat(`Set domain ${domain} on ${name}`));
});

// Database
const db = program.command("db").description("Manage databases");
db.command("list").action(async () => { const dbs = await api("/api/databases"); if (!dbs.length) { console.log("No databases."); return; } for (const d of dbs) console.log(`  ${d.status === "RUNNING" ? "🟢" : "🔴"} ${d.name.padEnd(20)} ${d.type.padEnd(12)} ${d.status}`); });
db.command("create <name>").option("-t, --type <type>", "Type", "postgresql").action(async (name, opts) => { console.log(await chat(`Create a ${opts.type} database named ${name}`)); });

// AI chat
program.command("ask [message...]").description("Ask AI anything (opens chat if no message)").action(async (words) => {
  if (!words || words.length === 0) { showWelcome(); await startChat(); return; }
  console.log(`${DIM}thinking...${RESET}`);
  const resp = await chat(words.join(" "));
  console.log(`\n${CYAN}hw>${RESET} ${resp}\n`);
});
program.command("chat").description("Interactive AI chat session").action(async () => {
  showWelcome();
  await startChat();
});

// Credits
program.command("credits").description("Check credit balance").action(async () => { console.log(await chat("What's my credit balance?")); });

// Logout
program.command("logout").description("Sign out and remove credentials").action(() => {
  const { existsSync, unlinkSync } = require("fs");
  if (existsSync(CONFIG_FILE)) {
    unlinkSync(CONFIG_FILE);
    console.log(`${GREEN}✓${RESET} Logged out. Run ${BOLD}hw login${RESET} to sign in again.`);
  } else {
    console.log("Not logged in.");
  }
});

// Update
program.command("update").description("Update hw to the latest version").action(async () => {
  console.log(`${DIM}Updating Hostwares CLI...${RESET}`);
  const { execSync } = require("child_process");
  try {
    execSync("curl -fsSL https://hostwares.com/install.sh | bash", { stdio: "inherit" });
  } catch {
    console.log(`\n${"\x1b[31m"}Update failed.${RESET} Try manually: curl -fsSL https://hostwares.com/install.sh | bash`);
  }
});

// Help / Instructions
program.command("help").description("Show help and usage instructions").action(() => {
  console.log(`
${PURPLE}${BOLD}Hostwares CLI${RESET} — AI-Powered Cloud Hosting from your terminal.

${BOLD}INSTALL${RESET}
  curl -fsSL https://hostwares.com/install.sh | bash

${BOLD}AUTHENTICATE${RESET}
  hw login                  Opens browser for secure login
  hw login --token KEY      Use API key directly (for CI/CD)
  hw logout                 Sign out

${BOLD}DEPLOY${RESET}
  hw deploy                 Deploy current directory (auto-detects framework)
  hw deploy --repo URL      Deploy from a GitHub repo
  hw deploy --name NAME     Set a custom site name

${BOLD}MANAGE SITES${RESET}
  hw list                   List all your sites
  hw status NAME            Check site status
  hw logs NAME              View deployment logs
  hw restart NAME           Restart a site
  hw stop NAME              Stop a site
  hw start NAME             Start a stopped site
  hw env NAME               List environment variables
  hw env NAME set KEY=VAL   Set an environment variable
  hw domain NAME DOMAIN     Set a custom domain

${BOLD}DATABASES${RESET}
  hw db list                List all databases
  hw db create NAME         Create PostgreSQL database
  hw db create NAME -t TYPE Create specific type (mysql, redis, mongodb)

${BOLD}AI ASSISTANT${RESET}
  hw                        Start interactive AI session
  hw chat                   Start interactive AI session
  hw ask "MESSAGE"          Ask a one-off question

${BOLD}BILLING${RESET}
  hw credits                Check credit balance

${BOLD}MAINTENANCE${RESET}
  hw update                 Update to latest version
  hw logout                 Sign out
  hw help                   Show this help

${BOLD}EXAMPLES${RESET}
  hw deploy --repo github.com/user/my-app
  hw ask "why is my-app returning 502?"
  hw env my-app set DATABASE_URL=postgres://...
  hw domain my-app mysite.com

${BOLD}DOCS${RESET}
  https://hostwares.com/docs/cli

${BOLD}UNINSTALL${RESET}
  curl -fsSL https://hostwares.com/uninstall.sh | bash
`);
});

// Show banner + start interactive session when no command given
if (process.argv.length <= 2) {
  showWelcome();
  const config = getConfig();
  if (!config.apiKey) {
    console.log(`  Run ${BOLD}hw login${RESET} to get started.\n`);
    process.exit(0);
  }
  // Auto-update check (non-blocking)
  checkForUpdate().then(updated => { if (updated) console.log(`${GREEN}✓ Updated to latest version${RESET}\n`); });
  startChat();
} else {
  program.parse();
}

async function startChat() {
  const readline = await import("readline");
  const { execSync } = await import("child_process");
  const fs = await import("fs");
  const path = await import("path");
  const { loadSession, saveSession, createSession } = await import("./session/manager.js");
  const { calculateContext, shouldAutoCompact, compactHistory, formatContextBar } = await import("./session/context.js");
  
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  const sessionStart = Date.now();
  let msgCount = 0;
  const cwd = process.cwd();
  
  // Directory-based session resume (like Kiro)
  let session = loadSession(cwd);
  const history: { role: string; content: string }[] = [];
  
  if (session && session.conversationId) {
    _conversationId = session.conversationId;
    history.push(...session.history.map(h => ({ role: h.role, content: h.content })));
    msgCount = session.messageCount;
    console.log(`${DIM}  ↻ Resumed session (${session.messageCount} msgs). /new for fresh start${RESET}\n`);
  } else {
    session = createSession(cwd);
  }

  const updateContext = () => calculateContext(history);
  
  const getContextBar = () => {
    const ctx = calculateContext(history);
    return `${DIM}${formatContextBar(ctx)}${RESET}`;
  };

  // Auto-save session periodically
  const autoSave = () => {
    session!.conversationId = _conversationId;
    session!.history = history.map(h => ({ ...h, timestamp: new Date().toISOString() }));
    session!.messageCount = msgCount;
    session!.totalCreditsUsed = _lastCreditsUsed;
    saveSession(session!);
  };

  console.log(`${PURPLE}Hostwares AI${RESET} ${DIM}— your DevOps engineer. Type / for commands${RESET}\n`);

  const prompt = () => {
    // Auto-compact if context is critical (like Kiro's auto-compaction on overflow)
    const ctx = calculateContext(history);
    if (shouldAutoCompact(ctx) && history.length > 8) {
      console.log(`${DIM}⟳ Auto-compacting context (${formatContextBar(ctx)})...${RESET}`);
      const compacted = compactHistory(history, 4);
      history.length = 0;
      history.push(...compacted);
      autoSave();
      const newCtx = calculateContext(history);
      console.log(`${DIM}✓ Compacted → ${formatContextBar(newCtx)}${RESET}\n`);
    }
    
    rl.question(`${BOLD}you>${RESET} `, async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) { prompt(); return; }

    // Exit
    if (trimmed === "exit" || trimmed === "quit" || trimmed === "/quit" || trimmed === "/exit") {
      const duration = Math.round((Date.now() - sessionStart) / 1000);
      console.log(`\n${DIM}Session: ${msgCount} messages, ${duration}s. Credits used: ${_lastCreditsUsed.toFixed(2)}. Goodbye!${RESET}\n`);
      rl.close(); return;
    }

    // Slash commands (Kiro-style) — show preview if just "/"
    if (trimmed === "/") {
      showSlashPreview();
      prompt(); return;
    }
    if (trimmed.startsWith("/")) {
      handleSlashCommand(trimmed, history, rl);
      prompt(); return;
    }

    // Inline shell (!command) — runs directly without AI
    if (trimmed.startsWith("!")) {
      const cmd = trimmed.slice(1).trim();
      if (!cmd) { prompt(); return; }
      console.log(`${DIM}$ ${cmd}${RESET}`);
      try {
        const out = execSync(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 }).toString();
        console.log(out);
      } catch (e: any) {
        console.log(e.stdout?.toString() || e.stderr?.toString() || e.message);
      }
      prompt(); return;
    }

    // AI chat
    msgCount++;
    const msgStart = Date.now();
    console.log(`${DIM}thinking...${RESET}`);
    try {
      // Try streaming first, fall back to non-streaming (for agent tool calls)
      let resp: string;
      let streamed = false;
      try {
        resp = await chatStream(trimmed);
        streamed = true;
      } catch {
        // Streaming failed (might be agent mode with tool calls) — use regular
        resp = await chat(trimmed);
      }
      history.push({ role: "user", content: trimmed });
      history.push({ role: "assistant", content: resp });
      msgCount++;
      autoSave(); // Persist session
      const elapsed = ((Date.now() - msgStart) / 1000).toFixed(0);
      if (!streamed) console.log(`\n${CYAN}hw>${RESET} ${resp}`);
      console.log(`${DIM}  ▸ Credits: ${_lastBalance.toFixed(2)} • Time: ${elapsed}s • ${getContextBar()}${RESET}\n`);
    } catch (e: any) {
      if (e.message?.includes("401") || e.message?.includes("Unauthorized")) {
        console.log(`\n${"\x1b[33m"}Session expired.${RESET} Re-authenticating...\n`);
        const { execSync } = require("child_process");
        try {
          execSync("hw login", { stdio: "inherit" });
          console.log(`\n${GREEN}✓ Re-authenticated. Try your command again.${RESET}\n`);
        } catch {
          console.log(`${"\x1b[31m"}Login failed.${RESET} Run: hw login\n`);
        }
      } else {
        console.log(`\n${"\x1b[31m"}Error:${RESET} ${e.message}\n`);
      }
    }
    prompt();
  });
  };
  prompt();
}


function showSlashPreview() {
  const BOLD = "\x1b[1m", DIM = "\x1b[2m", CYAN = "\x1b[36m", RESET = "\x1b[0m";
  const BG = "\x1b[48;5;236m", FG = "\x1b[38;5;214m";
  const cmds = [
    ["/help", "Show all commands"],
    ["/clear", "Clear conversation & start fresh"],
    ["/context", "Show context usage & session info"],
    ["/tools", "List all 95 available tools"],
    ["/credits", "Check credit balance"],
    ["/history", "Show conversation history"],
    ["/save [path]", "Save session to file"],
    ["/load [path]", "Load session from file"],
    ["/compact", "Compress context to free space"],
    ["/system", "Show machine/OS info"],
    ["/trust", "Trust all actions (skip prompts)"],
    ["/new", "Start new conversation"],
    ["/model", "Show model info"],
    ["/usage", "Session stats"],
  ];
  console.log(`\n${BG}${BOLD} COMMANDS ${RESET}`);
  for (const [cmd, desc] of cmds) {
    console.log(`${BG} ${FG}${cmd.padEnd(14)}${RESET}${BG} ${DIM}${desc}${RESET}`);
  }
  console.log("");
}

function handleSlashCommand(cmd: string, history: any[], rl: any) {
  const BOLD = "\x1b[1m", DIM = "\x1b[2m", CYAN = "\x1b[36m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m", RESET = "\x1b[0m";
  const parts = cmd.split(" ");
  const command = parts[0];

  switch (command) {
    case "/help":
      console.log(`
${BOLD}SLASH COMMANDS${RESET}
  /help             Show this help
  /clear            Clear conversation history
  /context          Show current context info
  /tools            List available tools
  /credits          Check credit balance
  /history          Show conversation history
  /save [path]      Save conversation to file
  /load [path]      Load conversation from file
  /compact          Summarize conversation to save context
  /system           Show system info
  /trust            Trust all actions this session (skip permission prompts)
  /untrust          Re-enable permission prompts
  /model            Show current model info
  /usage            Show session usage stats

${BOLD}SHORTCUTS${RESET}
  !command          Run shell command directly (no AI)
  exit, /quit       End session
`);
      break;
    case "/clear":
      history.length = 0;
      _conversationId = null;
      console.log(`${GREEN}✓${RESET} Conversation cleared.\n`);
      break;
    case "/context": {
      const tk = history.reduce((s: number, m: any) => s + Math.ceil(m.content.length / 4), 0);
      const pct = Math.min(100, Math.round((tk / 180000) * 100));
      console.log(`${BOLD}Context:${RESET}
  Working dir: ${process.cwd()}
  Conversation: ${_conversationId || "new"}
  Messages: ${history.length / 2} exchanges
  Tokens: ~${(tk/1000).toFixed(1)}K / 180K (${pct}%)
  Agent mode: enabled (34 local + 61 cloud = 95 tools)
  ${pct > 70 ? "⚠ High — will auto-compact at 70%" : "✓ Healthy"}
`);
      break;
    }
    case "/tools":
      console.log(`${BOLD}LOCAL TOOLS (34):${RESET}
  ${DIM}Filesystem:${RESET} read_file, write_file, str_replace_file, append_file, list_directory, search_files, delete_path
  ${DIM}Shell:${RESET} run_command, install_package, get_system_info
  ${DIM}Git:${RESET} git_status, git_add, git_commit, git_push, git_pull, git_clone, git_log, git_diff, git_branch, check_github_auth
  ${DIM}SSH:${RESET} ssh_run, ssh_upload, ssh_download
  ${DIM}Docker:${RESET} docker_ps, docker_logs, docker_exec
  ${DIM}Process:${RESET} list_processes, kill_process
  ${DIM}Network:${RESET} check_port, curl_request

${BOLD}CLOUD TOOLS (60):${RESET}
  ${DIM}Sites:${RESET} deploy, list, status, logs, restart, stop, start, domain, ssl, rollback, scale
  ${DIM}Database:${RESET} create, list, status, restart, backup
  ${DIM}Services:${RESET} create (326 apps), restart, stop, clone
  ${DIM}Billing:${RESET} credits, invoices, plans, purchase
  ${DIM}GitHub:${RESET} list_repos, add_secret, list_secrets
  ${DIM}Server:${RESET} order, list, recommend
  ${DIM}Intelligence:${RESET} memory, knowledge, auto-heal, webhooks
`);
      break;
    case "/credits":
      console.log(`${DIM}Checking balance...${RESET}`);
      apiRaw("/api/credits", {}).then((d: any) => {
        console.log(`${GREEN}Credits:${RESET} ${d.balance ?? "unknown"}\n`);
      }).catch(() => console.log(`${DIM}Could not fetch credits${RESET}\n`));
      break;
    case "/history":
      if (history.length === 0) { console.log(`${DIM}No messages yet.${RESET}\n`); break; }
      history.forEach((m: any, i: number) => {
        const prefix = m.role === "user" ? `${BOLD}you>${RESET}` : `${CYAN}hw>${RESET}`;
        console.log(`${prefix} ${m.content.slice(0, 100)}${m.content.length > 100 ? "..." : ""}`);
      });
      console.log("");
      break;
    case "/save": {
      const savePath = parts[1] || `./hw-session-${Date.now()}.json`;
      const fs = require("fs");
      fs.writeFileSync(savePath, JSON.stringify({ conversationId: _conversationId, history, savedAt: new Date().toISOString() }, null, 2));
      console.log(`${GREEN}✓${RESET} Saved to ${savePath}\n`);
      break;
    }
    case "/load": {
      const loadPath = parts[1];
      if (!loadPath) { console.log(`Usage: /load <path>\n`); break; }
      const fs = require("fs");
      try {
        const data = JSON.parse(fs.readFileSync(loadPath, "utf8"));
        if (data.conversationId) _conversationId = data.conversationId;
        if (data.history) { history.length = 0; history.push(...data.history); }
        console.log(`${GREEN}✓${RESET} Loaded ${history.length / 2} exchanges from ${loadPath}\n`);
      } catch { console.log(`${"\x1b[31m"}Failed to load ${loadPath}${RESET}\n`); }
      break;
    }
    case "/compact":
      console.log(`${DIM}Conversation compacted. Context freed.${RESET}\n`);
      if (history.length > 6) history.splice(0, history.length - 6);
      break;
    case "/system":
      try {
        const { execSync } = require("child_process");
        const os = require("os");
        console.log(`  OS: ${os.platform()} ${os.arch()} ${os.release()}`);
        console.log(`  Node: ${process.version}`);
        console.log(`  CWD: ${process.cwd()}`);
        console.log(`  User: ${os.userInfo().username}`);
        console.log(`  Home: ${os.homedir()}\n`);
      } catch {}
      break;
    case "/trust":
      console.log(`${GREEN}✓${RESET} All actions trusted this session. No more permission prompts.\n`);
      break;
    case "/untrust":
      console.log(`${YELLOW}✓${RESET} Permission prompts re-enabled.\n`);
      break;
    case "/model":
      console.log(`  Model: Claude (auto-selected by hostwares.com)\n  Routing: Haiku for simple, Sonnet for complex, Opus for business tier\n`);
      break;
    case "/usage":
      console.log(`  Messages: ${history.length / 2}\n  ConversationID: ${_conversationId || "none"}\n`);
      break;
    case "/new":
      history.length = 0;
      _conversationId = null;
      console.log(`${GREEN}✓${RESET} New conversation started.\n`);
      break;
    default:
      console.log(`${DIM}Unknown command: ${command}. Type / for available commands.${RESET}\n`);
  }
}

