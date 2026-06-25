import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type ToolCall = { id: string; name: string; input: any; destructive: boolean };
export type ToolResult = { id: string; result: string; error?: boolean };

export async function executeLocalTool(tool: ToolCall): Promise<string> {
  const { name, input } = tool;
  switch (name) {
    // Filesystem
    case "read_file": return fs.readFileSync(resolve(input.path), "utf8");
    case "write_file": fs.mkdirSync(path.dirname(resolve(input.path)), { recursive: true }); fs.writeFileSync(resolve(input.path), input.content); return `Written to ${input.path}`;
    case "list_directory": return listDir(resolve(input.path), input.recursive);
    case "search_files": return run(`grep -rn ${input.include ? `--include='${input.include}'` : ""} '${input.pattern}' ${input.directory || "."} 2>/dev/null | head -50`);
    case "delete_path": fs.rmSync(resolve(input.path), { recursive: true }); return `Deleted ${input.path}`;

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
      if (input.action === "list") return run("git branch -a", input.directory);
      if (input.action === "create") return run(`git checkout -b ${input.name}`, input.directory);
      if (input.action === "switch") return run(`git checkout ${input.name}`, input.directory);
      if (input.action === "delete") return run(`git branch -d ${input.name}`, input.directory);
      return "Unknown branch action";
    case "check_github_auth": return run("gh auth status 2>&1 || git config user.name && git config user.email");

    // SSH
    case "ssh_run": return sshRun(input.host, input.user, input.password, input.keyPath, input.command);
    case "ssh_upload": return scp(input.host, input.user, input.password, input.localPath, input.remotePath, "up");
    case "ssh_download": return scp(input.host, input.user, input.password, input.remotePath, input.localPath, "down");

    default: return `Unknown tool: ${name}`;
  }
}

function resolve(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : path.resolve(p);
}

function run(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, { cwd: cwd ? resolve(cwd) : undefined, timeout: 30000, maxBuffer: 1024 * 1024 }).toString().trim();
  } catch (e: any) {
    return e.stdout?.toString() || e.stderr?.toString() || e.message;
  }
}

function listDir(dir: string, recursive?: boolean): string {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const lines = entries.map(e => `${e.isDirectory() ? "d" : "-"} ${e.name}`);
  if (recursive) {
    entries.filter(e => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
      .forEach(e => { try { lines.push(...listDir(path.join(dir, e.name), true).split("\n").map(l => `  ${e.name}/${l.slice(2)}`)); } catch {} });
  }
  return lines.join("\n");
}

function installPkg(name: string): string {
  const platform = os.platform();
  if (platform === "darwin") return run(`brew install ${name} 2>&1 || npm install -g ${name} 2>&1`);
  if (platform === "linux") return run(`apt-get install -y ${name} 2>&1 || npm install -g ${name} 2>&1`);
  return run(`npm install -g ${name} 2>&1`);
}

function getSystemInfo(): string {
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

function sshRun(host: string, user: string, password?: string, keyPath?: string, cmd?: string): string {
  // Ensure sshpass is available for password auth
  if (password) {
    try { execSync("which sshpass", { stdio: "pipe" }); } catch {
      run(os.platform() === "darwin" ? "brew install sshpass 2>&1 || brew install hudochenkov/sshpass/sshpass 2>&1" : "apt-get install -y sshpass 2>&1");
    }
    return run(`sshpass -p '${password}' ssh -o StrictHostKeyChecking=no ${user}@${host} '${cmd}'`);
  }
  if (keyPath) return run(`ssh -i ${keyPath} -o StrictHostKeyChecking=no ${user}@${host} '${cmd}'`);
  return run(`ssh -o StrictHostKeyChecking=no ${user}@${host} '${cmd}'`);
}

function scp(host: string, user: string, password: string | undefined, src: string, dst: string, direction: "up" | "down"): string {
  const auth = password ? `sshpass -p '${password}' scp -o StrictHostKeyChecking=no` : "scp -o StrictHostKeyChecking=no";
  if (direction === "up") return run(`${auth} ${src} ${user}@${host}:${dst}`);
  return run(`${auth} ${user}@${host}:${src} ${dst}`);
}
