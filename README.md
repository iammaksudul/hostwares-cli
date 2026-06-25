# `hw` — AI DevOps Agent for Your Terminal

The Hostwares CLI is a **full local DevOps AI agent**. It can read your files, run commands, push to GitHub, SSH into servers, deploy to cloud, and manage your entire infrastructure — all from one terminal.

## Install

```bash
curl -fsSL https://hostwares.com/install.sh | bash
```

## Quick Start

```bash
hw login          # Authenticate (opens browser)
hw                # Start interactive AI session
```

## Agent Capabilities

When you type `hw` and start chatting, the AI can:

| Category | Tools |
|----------|-------|
| **Filesystem** | read, write, edit (str_replace), search, delete |
| **Shell** | run commands, install packages (brew/apt) |
| **Git** | status, add, commit, push, pull, branch, clone |
| **SSH** | connect to servers, run remote commands, upload/download |
| **Docker** | list containers, view logs, exec |
| **Network** | check ports, HTTP requests |
| **Cloud** | deploy sites, manage DBs, domains, SSL, billing |

**Permission model:** Before each action, you choose:
- `t` = Trust all actions this session
- `y` = Yes to this one
- `n` = No, skip

## Commands

```bash
hw                    # Interactive AI agent session
hw deploy             # Deploy current project
hw deploy --repo URL  # Deploy from GitHub
hw list               # List all sites
hw status <name>      # Check site health
hw logs <name>        # View deploy logs
hw restart <name>     # Restart a site
hw env <name>         # Manage env vars
hw domain <name> <d>  # Set custom domain
hw db create <name>   # Create database
hw ask "question"     # One-off AI question
hw credits            # Check balance
hw update             # Update hw to latest
hw logout             # Sign out
hw help               # Full usage guide
```

## Example Session

```
$ hw
you> push this to github and deploy with SSL on mysite.com

hw> I need to: Run: git add -A
  [t] Trust all  [y] Yes  [n] No: t
  ✓ Trusted for this session

  ⟳ git add -A... ✓
  ⟳ git commit... ✓
  ⟳ git push origin main... ✓
  ⟳ Deploying on Hostwares... ✓
  ⟳ Setting domain mysite.com... ✓
  ⟳ Activating SSL... ✓

  🟢 Live at https://mysite.com
```

## Uninstall

```bash
curl -fsSL https://hostwares.com/uninstall.sh | bash
```

## Links

- [Documentation](https://hostwares.com/docs/cli)
- [Platform](https://hostwares.com)
- [MCP Server](https://github.com/iammaksudul/hostwares-mcp)
