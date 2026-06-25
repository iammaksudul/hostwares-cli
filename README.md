# Hostwares CLI

Deploy, manage, and monitor your sites from the terminal.

## Install

```bash
npm install -g hostwares-cli
```

## Login

```bash
hostwares login --token YOUR_API_KEY
```

Get your API key at: https://hostwares.com/dashboard/api-keys

## Commands

```bash
# Deploy
hostwares deploy                        # Deploy current directory
hostwares deploy --repo user/repo       # Deploy from GitHub
hostwares deploy --name my-app          # Custom name

# Sites
hostwares list                          # List all sites
hostwares status my-app                 # Check status
hostwares logs my-app                   # View deploy logs
hostwares restart my-app                # Restart
hostwares stop my-app                   # Stop
hostwares start my-app                  # Start

# Environment
hostwares env my-app                    # List env vars
hostwares env my-app set KEY=VALUE      # Set env var

# Domains
hostwares domain my-app example.com     # Set custom domain

# Databases
hostwares db list                       # List databases
hostwares db create my-db --type postgresql

# AI Chat
hostwares ask "why is my site down?"    # One-off question
hostwares chat                          # Interactive session

# Billing
hostwares credits                       # Check balance
```

## Zero-Config Deploy

```bash
cd my-nextjs-app
hostwares deploy
# ✓ Detected Next.js
# ✓ Deployed to my-nextjs-app.hostwares.app
# ✓ SSL provisioned
```

## License
MIT — Hostwares LLC
