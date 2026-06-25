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
exports.resetTrust = resetTrust;
exports.askPermission = askPermission;
const readline = __importStar(require("readline"));
let trustMode = false;
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
function resetTrust() { trustMode = false; }
async function askPermission(tool) {
    if (trustMode)
        return true;
    const desc = describeAction(tool.name, tool.input);
    console.log(`\n${YELLOW}hw>${RESET} I need to: ${BOLD}${desc}${RESET}`);
    if (tool.destructive) {
        console.log(`  ${RED}⚠ WARNING:${RESET} ${getConsequences(tool.name, tool.input)}`);
    }
    const answer = await prompt(`  ${DIM}[t] Trust all  [y] Yes  [n] No${RESET}: `);
    if (answer === "t") {
        trustMode = true;
        console.log(`  ${DIM}✓ Trusted for this session${RESET}`);
        return true;
    }
    if (answer === "y" || answer === "yes")
        return true;
    return false;
}
function prompt(msg) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(msg, (a) => { rl.close(); resolve(a.trim().toLowerCase()); }));
}
function describeAction(name, input) {
    switch (name) {
        case "read_file": return `Read ${input.path}`;
        case "write_file": return `Write to ${input.path} (${input.content?.length || 0} chars)`;
        case "list_directory": return `List ${input.path}`;
        case "search_files": return `Search for "${input.pattern}" in ${input.directory || "."}`;
        case "delete_path": return `DELETE ${input.path}`;
        case "run_command": return `Run: ${input.command}`;
        case "install_package": return `Install package: ${input.name}`;
        case "get_system_info": return "Get system info";
        case "git_status": return "Check git status";
        case "git_add": return `Stage: ${input.files}`;
        case "git_commit": return `Commit: "${input.message}"`;
        case "git_push": return `Push to ${input.remote || "origin"}/${input.branch || "current"}`;
        case "git_pull": return `Pull from ${input.remote || "origin"}`;
        case "git_clone": return `Clone ${input.url}`;
        case "git_log": return "Show git log";
        case "git_diff": return "Show git diff";
        case "git_branch": return `Branch: ${input.action} ${input.name || ""}`;
        case "check_github_auth": return "Check GitHub auth";
        case "ssh_run": return `SSH ${input.user}@${input.host}: ${input.command}`;
        case "ssh_upload": return `Upload ${input.localPath} → ${input.user}@${input.host}:${input.remotePath}`;
        case "ssh_download": return `Download ${input.user}@${input.host}:${input.remotePath} → ${input.localPath}`;
        case "str_replace_file": return `Edit ${input.path} (replace text)`;
        case "append_file": return `Append to ${input.path}`;
        case "list_processes": return `List processes${input.filter ? ` matching "${input.filter}"` : ""}`;
        case "kill_process": return `Kill process: ${input.target}`;
        case "docker_ps": return "List Docker containers";
        case "docker_logs": return `Docker logs: ${input.container}`;
        case "docker_exec": return `Docker exec in ${input.container}: ${input.command}`;
        case "check_port": return `Check port ${input.port}`;
        case "curl_request": return `HTTP ${input.method || "GET"} ${input.url}`;
        default: return `${name}(${JSON.stringify(input)})`;
    }
}
function getConsequences(name, input) {
    switch (name) {
        case "delete_path": return `This will permanently remove ${input.path}. Cannot be undone.`;
        case "git_push": return "This pushes commits to remote. Others may pull these changes.";
        case "git_branch":
            if (input.action === "delete")
                return `Branch ${input.name} will be deleted.`;
            return "";
        case "ssh_run": return `Executing command on remote server ${input.host}. Ensure you trust this server.`;
        default: return "This action may be irreversible.";
    }
}
