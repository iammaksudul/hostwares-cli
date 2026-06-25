#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

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

async function chat(message: string): Promise<string> {
  const data = await api("/api/chat", { method: "POST", body: JSON.stringify({ message }) });
  return data.text || data.message || JSON.stringify(data);
}

const program = new Command();
program.name("hostwares").description("Hostwares CLI — Deploy and manage from your terminal").version("1.0.0");

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
program.command("ask <message...>").description("Ask AI anything").action(async (words) => { console.log(await chat(words.join(" "))); });
program.command("chat").description("Interactive AI chat").action(async () => {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("Hostwares AI (type 'exit' to quit)\n");
  const ask = () => rl.question("you> ", async (input) => { if (input === "exit") { rl.close(); return; } console.log("\n" + await chat(input) + "\n"); ask(); });
  ask();
});

// Credits
program.command("credits").description("Check credit balance").action(async () => { console.log(await chat("What's my credit balance?")); });

program.parse();
