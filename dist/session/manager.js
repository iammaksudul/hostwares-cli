"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSession = loadSession;
exports.saveSession = saveSession;
exports.createSession = createSession;
exports.listSessions = listSessions;
exports.deleteSession = deleteSession;
exports.exportSession = exportSession;
exports.importSession = importSession;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const SESSION_DIR = path.join(os.homedir(), ".hostwares", "sessions");
function ensureDir() {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}
function sessionPath(cwd) {
    // Directory-based session (like Kiro) — hash the cwd
    const hash = Buffer.from(cwd).toString("base64url").slice(0, 20);
    return path.join(SESSION_DIR, `${hash}.json`);
}
function loadSession(cwd) {
    const p = sessionPath(cwd);
    if (!fs.existsSync(p))
        return null;
    try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
    }
    catch {
        return null;
    }
}
function saveSession(session) {
    ensureDir();
    const p = sessionPath(session.cwd);
    session.updatedAt = new Date().toISOString();
    fs.writeFileSync(p, JSON.stringify(session, null, 2));
}
function createSession(cwd) {
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
function listSessions() {
    ensureDir();
    const files = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith(".json"));
    return files.map(f => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, f), "utf8"));
            return { cwd: data.cwd, updatedAt: data.updatedAt, messageCount: data.messageCount };
        }
        catch {
            return null;
        }
    }).filter(Boolean);
}
function deleteSession(cwd) {
    const p = sessionPath(cwd);
    if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        return true;
    }
    return false;
}
function exportSession(session, outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(session, null, 2));
}
function importSession(inputPath) {
    try {
        return JSON.parse(fs.readFileSync(inputPath, "utf8"));
    }
    catch {
        return null;
    }
}
