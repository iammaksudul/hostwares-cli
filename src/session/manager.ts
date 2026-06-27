import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const SESSION_DIR = path.join(os.homedir(), ".hostwares", "sessions");

export interface SessionData {
  id: string;
  conversationId: string | null;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  history: { role: string; content: string; timestamp: string }[];
  summary: string | null;
  totalCreditsUsed: number;
  messageCount: number;
}

function ensureDir() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

function sessionPath(cwd: string): string {
  // Directory-based session (like Kiro) — hash the cwd
  const hash = Buffer.from(cwd).toString("base64url").slice(0, 20);
  return path.join(SESSION_DIR, `${hash}.json`);
}

export function loadSession(cwd: string): SessionData | null {
  const p = sessionPath(cwd);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch { return null; }
}

export function saveSession(session: SessionData): void {
  ensureDir();
  const p = sessionPath(session.cwd);
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(session, null, 2));
}

export function createSession(cwd: string): SessionData {
  return {
    id: crypto.randomUUID(),
    conversationId: null,
    cwd,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
    summary: null,
    totalCreditsUsed: 0,
    messageCount: 0,
  };
}

export function listSessions(): { cwd: string; updatedAt: string; messageCount: number }[] {
  ensureDir();
  const files = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith(".json"));
  return files.map(f => {
    try {
      const data: SessionData = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, f), "utf8"));
      return { cwd: data.cwd, updatedAt: data.updatedAt, messageCount: data.messageCount };
    } catch { return null; }
  }).filter(Boolean) as any[];
}

export function deleteSession(cwd: string): boolean {
  const p = sessionPath(cwd);
  if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
  return false;
}

export function exportSession(session: SessionData, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(session, null, 2));
}

export function importSession(inputPath: string): SessionData | null {
  try {
    return JSON.parse(fs.readFileSync(inputPath, "utf8"));
  } catch { return null; }
}
