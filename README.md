# `hw` — Hostwares CLI

Your AI DevOps engineer in the terminal. Deploy, manage, and troubleshoot — powered by the same AI as hostwares.com.

## Install

```bash
npm install -g hostwares-cli
```

After install, you have the `hw` command available globally.

## Getting Started

```bash
# Step 1: Authenticate (opens browser)
hw login

# Step 2: Deploy your project
cd my-app
hw deploy

# That's it. Your app is live.
```

## Authentication

```bash
$ hw login
```

This opens your browser at `hostwares.com/cli/authorize` — log in with your Hostwares account and click **Authorize**. The CLI detects it automatically. No tokens to copy.

```
$ hw login

  Authenticating with Hostwares...

  Open this URL in your browser:
  https://hostwares.com/cli/authorize?code=A3F2B1

  Confirmation code: A3F2B1

  Waiting for authorization...

  ✓ Logged in successfully!
```

Alternative (for CI/CD or headless):
```bash
hw login --token YOUR_API_KEY
```

## Usage

### Deploy
```bash
hw deploy                          # Deploy current directory (auto-detect)
hw deploy --repo user/repo         # Deploy from GitHub URL
hw deploy --name my-app            # Custom name
```

### Manage Sites
```bash
hw list                            # List all sites
hw status my-app                   # Check status
hw logs my-app                     # View deploy logs
hw restart my-app                  # Restart
hw stop my-app                     # Stop
hw start my-app                    # Start
```

### Environment Variables
```bash
hw env my-app                      # List env vars
hw env my-app set DATABASE_URL=... # Set a variable
hw env my-app set PORT=8080        # Change port
```

### Domains
```bash
hw domain my-app mysite.com        # Set custom domain
```

### Databases
```bash
hw db list                         # List all databases
hw db create my-db                 # Create PostgreSQL (default)
hw db create my-db --type redis    # Specify type
```

### AI Assistant
```bash
hw ask "why is my-app returning 502?"     # One-off question
hw ask "deploy my-app from github.com/user/repo"
hw chat                                    # Interactive session
```

Interactive mode:
```
$ hw chat
Hostwares AI (type 'exit' to quit)

you> what's wrong with my-app?

Looking at logs... Build failed: Cannot find module 'prisma'.
Fix: Add prisma to dependencies (not devDependencies).
Run: npm install prisma --save, then redeploy.

you> redeploy my-app

✓ Redeploying my-app... deployment queued.
Build started. Watch progress at https://my-app.hostwares.app

you> exit
```

### Billing
```bash
hw credits                         # Check balance
```

## CI/CD (GitHub Actions)

```yaml
name: Deploy
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g hostwares-cli
      - run: hw login --token ${{ secrets.HW_TOKEN }}
      - run: hw deploy --name my-app
```

## How It Works

```
Your terminal → hw command → hostwares.com API → Coolify → Live site
```

The CLI is a thin client. All intelligence (AI, detection, provisioning) runs on hostwares.com. Your API key authenticates every request.

## Requirements

- Node.js 18+
- Hostwares account (free at hostwares.com/register)

## License
MIT — Hostwares LLC
