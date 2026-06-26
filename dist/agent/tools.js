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
exports.executeLocalTool = executeLocalTool;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
async function executeLocalTool(tool) {
    const { name, input } = tool;
    switch (name) {
        // Filesystem
        case "read_file": return fs.readFileSync(resolve(input.path), "utf8");
        case "write_file":
            fs.mkdirSync(path.dirname(resolve(input.path)), { recursive: true });
            fs.writeFileSync(resolve(input.path), input.content);
            return `Written to ${input.path}`;
        case "list_directory": return listDir(resolve(input.path), input.recursive);
        case "search_files": return run(`grep -rn ${input.include ? `--include='${input.include}'` : ""} '${input.pattern}' ${input.directory || "."} 2>/dev/null | head -50`);
        case "delete_path":
            fs.rmSync(resolve(input.path), { recursive: true });
            return `Deleted ${input.path}`;
        // Shell
        case "run_command": return run(input.command, input.workingDir);
        case "install_package": return installPkg(input.name);
        case "get_system_info": return getSystemInfo();
        // Git
        case "git_status": return run("git status --short && echo '---' && git branch --show-current", input.directory);
        case "git_add": return run(`git add ${input.files}`, input.directory);
        case "git_commit": return run(`git commit -m '${input.message.replace(/'/g, "'\\''")}'`, input.directory);
        case "git_push": return run(`git push ${input.remote || "origin"} ${input.branch || ""}`.trim(), input.directory);
        case "git_pull": return run(`git pull ${input.remote || "origin"} ${input.branch || ""}`.trim(), input.directory);
        case "git_clone": return run(`git clone ${input.url} ${input.directory || ""}`);
        case "git_log": return run(`git log --oneline -${input.count || 10}`, input.directory);
        case "git_diff": return run("git diff", input.directory);
        case "git_branch":
            if (input.action === "list")
                return run("git branch -a", input.directory);
            if (input.action === "create")
                return run(`git checkout -b ${input.name}`, input.directory);
            if (input.action === "switch")
                return run(`git checkout ${input.name}`, input.directory);
            if (input.action === "delete")
                return run(`git branch -d ${input.name}`, input.directory);
            return "Unknown branch action";
        case "check_github_auth": return run("gh auth status 2>&1 || git config user.name && git config user.email");
        // SSH
        case "ssh_run": return sshRun(input.host, input.user, input.password, input.keyPath, input.command);
        case "ssh_upload": return scp(input.host, input.user, input.password, input.localPath, input.remotePath, "up");
        case "ssh_download": return scp(input.host, input.user, input.password, input.remotePath, input.localPath, "down");
        // Smart editing
        case "str_replace_file": {
            const content = fs.readFileSync(resolve(input.path), "utf8");
            if (!content.includes(input.oldStr))
                return `Error: oldStr not found in ${input.path}`;
            const count = content.split(input.oldStr).length - 1;
            if (count > 1)
                return `Error: oldStr found ${count} times in ${input.path}. Make it more specific.`;
            fs.writeFileSync(resolve(input.path), content.replace(input.oldStr, input.newStr));
            return `Replaced in ${input.path}`;
        }
        case "append_file":
            fs.appendFileSync(resolve(input.path), input.content);
            return `Appended to ${input.path}`;
        // Process
        case "list_processes": return run(input.filter ? `ps aux | grep '${input.filter}' | grep -v grep` : "ps aux | head -20");
        case "kill_process": return run(`pkill -f '${input.target}' 2>&1 || kill ${input.target} 2>&1`);
        // Docker
        case "docker_ps": return run(`docker ps ${input.all ? "-a" : ""} --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'`);
        case "docker_logs": return run(`docker logs --tail ${input.lines || 50} ${input.container}`);
        case "docker_exec": return run(`docker exec ${input.container} ${input.command}`);
        // Network
        case "check_port": return run(`lsof -i :${input.port} 2>/dev/null | grep LISTEN || echo "Port ${input.port} not in use"`);
        case "curl_request": {
            let cmd = `curl -s -w '\\nHTTP_STATUS:%{http_code}' ${input.method ? `-X ${input.method}` : ""}`;
            if (input.headers)
                cmd += ` -H '${input.headers}'`;
            if (input.body)
                cmd += ` -d '${input.body}'`;
            cmd += ` '${input.url}' 2>&1 | tail -100`;
            return run(cmd);
        }
        // Web
        case "web_search": return run(`curl -s 'https://api.duckduckgo.com/?q=${encodeURIComponent(input.query)}&format=json&no_html=1' | head -2000`);
        case "web_fetch": return run(`curl -s -L '${input.url}' 2>&1 | head -200`);
        default: return `Unknown tool: ${name}`;
    }
}
function resolve(p) {
    return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : path.resolve(p);
}
function run(cmd, cwd) {
    try {
        return (0, child_process_1.execSync)(cmd, { cwd: cwd ? resolve(cwd) : undefined, timeout: 30000, maxBuffer: 1024 * 1024 }).toString().trim();
    }
    catch (e) {
        return e.stdout?.toString() || e.stderr?.toString() || e.message;
    }
}
function listDir(dir, recursive) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const lines = entries.map(e => `${e.isDirectory() ? "d" : "-"} ${e.name}`);
    if (recursive) {
        entries.filter(e => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
            .forEach(e => { try {
            lines.push(...listDir(path.join(dir, e.name), true).split("\n").map(l => `  ${e.name}/${l.slice(2)}`));
        }
        catch { } });
    }
    return lines.join("\n");
}
function installPkg(name) {
    const platform = os.platform();
    if (platform === "darwin")
        return run(`brew install ${name} 2>&1 || npm install -g ${name} 2>&1`);
    if (platform === "linux")
        return run(`apt-get install -y ${name} 2>&1 || npm install -g ${name} 2>&1`);
    return run(`npm install -g ${name} 2>&1`);
}
function getSystemInfo() {
    return [
        `OS: ${os.platform()} ${os.arch()} ${os.release()}`,
        `Node: ${run("node --version")}`,
        `npm: ${run("npm --version")}`,
        `Git: ${run("git --version")}`,
        `User: ${run("git config user.name")} <${run("git config user.email")}>`,
        `CWD: ${process.cwd()}`,
        `Home: ${os.homedir()}`,
    ].join("\n");
}
function sshRun(host, user, password, keyPath, cmd) {
    // Ensure sshpass is available for password auth
    if (password) {
        try {
            (0, child_process_1.execSync)("which sshpass", { stdio: "pipe" });
        }
        catch {
            run(os.platform() === "darwin" ? "brew install sshpass 2>&1 || brew install hudochenkov/sshpass/sshpass 2>&1" : "apt-get install -y sshpass 2>&1");
        }
        return run(`sshpass -p '${password}' ssh -o StrictHostKeyChecking=no ${user}@${host} '${cmd}'`);
    }
    if (keyPath)
        return run(`ssh -i ${keyPath} -o StrictHostKeyChecking=no ${user}@${host} '${cmd}'`);
    return run(`ssh -o StrictHostKeyChecking=no ${user}@${host} '${cmd}'`);
}
function scp(host, user, password, src, dst, direction) {
    const auth = password ? `sshpass -p '${password}' scp -o StrictHostKeyChecking=no` : "scp -o StrictHostKeyChecking=no";
    if (direction === "up")
        return run(`${auth} ${src} ${user}@${host}:${dst}`);
    return run(`${auth} ${user}@${host}:${src} ${dst}`);
}
