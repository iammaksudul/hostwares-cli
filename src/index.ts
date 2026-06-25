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
${PURPLE}██║  ██║██║    ██║${RESET}    ${BOLD}Hostwares CLI${RESET} ${DIM}v1.0.0${RESET}
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

async function chat(message: string): Promise<string> {
  const body: any = { message, agentMode: true };
  if (_conversationId) body.conversationId = _conversationId;
  const data = await apiRaw("/api/chat", { method: "POST", body: JSON.stringify(body) });
  if (data.conversationId) _conversationId = data.conversationId;

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
    throw new Error(e.error || e.message || `HTTP ${res.status}`);
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
  startChat();
} else {
  program.parse();
}

async function startChat() {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`${PURPLE}Hostwares AI${RESET} ${DIM}— your DevOps engineer. Type anything or 'exit' to quit.${RESET}\n`);
  const prompt = () => rl.question(`${BOLD}you>${RESET} `, async (input) => {
    const trimmed = input.trim();
    if (!trimmed) { prompt(); return; }
    if (trimmed === "exit" || trimmed === "quit" || trimmed === "/quit") { console.log(`\n${DIM}Goodbye!${RESET}\n`); rl.close(); return; }
    console.log(`${DIM}thinking...${RESET}`);
    try {
      const resp = await chat(trimmed);
      console.log(`\n${CYAN}hw>${RESET} ${resp}\n`);
    } catch (e: any) {
      console.log(`\n${"\x1b[31m"}Error:${RESET} ${e.message}\n`);
    }
    prompt();
  });
  prompt();
}

