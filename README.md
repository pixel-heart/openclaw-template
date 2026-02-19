# OpenClaw Railway Template

Deploy OpenClaw to Railway in one click. Get a 24/7 AI agent connected to Telegram or Discord, with your entire config and workspace backed up to GitHub.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/_S3bQQ?referralCode=jcFhp_)

## What you get

- **OpenClaw Gateway** running 24/7
- **Everything version controlled** — config, cron jobs, workspace, and memory backed up to GitHub automatically
- **Telegram or Discord** configured out of the box
- **Secrets never committed** — raw API keys are replaced with `${ENV_VAR}` references before pushing to GitHub
- **Setup UI** — web-based welcome screen and env var management

## Deploy

Only one variable is needed at deploy time:

| Variable | Required | Description |
|----------|----------|-------------|
| `SETUP_PASSWORD` | ✅ Required | Password for the setup UI |
| `OPENCLAW_GATEWAY_TOKEN` | 🔒 Auto | Auto-generated, secures your gateway |
| `PORT` | 🔒 Auto | Set by Railway |
| `WEBHOOK_TOKEN` | 🔒 Auto | Auto-generated, secures webhook endpoints |

Click the button to deploy:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/_S3bQQ?referralCode=jcFhp_)

Everything else — AI keys, GitHub credentials, channel tokens — is configured through the setup UI after your first login.

## First-time setup

After deploying, visit your Railway app URL at `/setup` (e.g. `https://your-app.up.railway.app/setup`).

### 1. Log in with your setup password

### 2. Complete the welcome screen

The welcome screen walks you through entering the minimum required variables:

- **AI Provider** (at least one): Anthropic API Key, Anthropic Setup Token, OpenAI API Key, or Gemini API Key
- **GitHub**: Personal access token + an empty private repo for backing up your agent's state
- **Channel** (at least one): Telegram Bot Token or Discord Bot Token

Each field includes instructions and links for how to get the value. Optional fields (like Brave Search API Key) can be filled in later from the Envars tab.

Click **Complete Setup** — the server runs onboarding, configures channels, and pushes an initial commit to your GitHub repo. This takes 15–30 seconds.

### 3. Approve channel pairing

DM your bot on Telegram (or Discord). It will reply with a pairing code. The setup UI shows pending pairings — click **Approve** to connect.

### 4. Connect Google Workspace (optional)

The setup UI lets you connect Gmail, Calendar, Drive, Contacts, and Sheets:

1. Click **Set up Google** and enter your OAuth client credentials (from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))
2. Select which permissions to grant
3. Click **Sign in with Google** to complete the OAuth flow
4. The UI shows API status for each service — click **Enable API** links for any that need enabling

### 5. Start chatting

DM your bot again — you're live!

Check your GitHub repo — you should see the initial commit with your agent's full config and workspace.

> **Memory search:** For your agent to semantically search its own memory, you need either `OPENAI_API_KEY` or `GEMINI_API_KEY` set. OpenClaw uses these to generate embeddings. Without one, memory recall won't work.

## Managing environment variables

After onboarding, the setup UI has a **General | Envars** tab layout. The **Envars** tab lets you:

- View and edit all configured environment variables
- See which vars are set (green dot) vs empty (gray dot)
- Toggle visibility for secret values
- Add custom variables with **+ Add**
- Save changes to the persistent `/data/.env` file

The server watches `/data/.env` for changes — including ones written by the OpenClaw agent itself. When the agent needs an API key for a tool, it adds a placeholder to `/data/.env` and tells you to visit the Envars tab to fill it in.

### All configurable variables

| Variable | Group | Description |
|----------|-------|-------------|
| `ANTHROPIC_API_KEY` | AI Provider | From [console.anthropic.com](https://console.anthropic.com/) (recommended) |
| `ANTHROPIC_TOKEN` | AI Provider | From `claude setup-token` |
| `OPENAI_API_KEY` | AI Provider | From [platform.openai.com](https://platform.openai.com/) |
| `GEMINI_API_KEY` | AI Provider | From [aistudio.google.com](https://aistudio.google.com/) |
| `GITHUB_TOKEN` | GitHub | PAT with `repo` scope |
| `GITHUB_WORKSPACE_REPO` | GitHub | Your repo (any format) |
| `TELEGRAM_BOT_TOKEN` | Channels | From [@BotFather](https://t.me/BotFather) · [full guide](https://docs.openclaw.ai/channels/telegram) |
| `DISCORD_BOT_TOKEN` | Channels | From [Developer Portal](https://discord.com/developers/applications) · [full guide](https://docs.openclaw.ai/channels/discord) |
| `BRAVE_API_KEY` | Tools | From [brave.com/search/api](https://brave.com/search/api/) — free tier available |

## How it works

```
/data/.openclaw/           ← Railway volume + git repo
├── openclaw.json          ← Config (secrets → ${ENV_VAR} references)
├── cron/jobs.json         ← Scheduled tasks
├── .gitignore             ← Excludes keys, logs, caches
├── agents/                ← Session state
└── workspace/             ← Agent workspace
    ├── AGENTS.md          ← Agent instructions
    ├── TOOLS.md           ← Tool notes + git discipline + env var guidance
    ├── HEARTBEAT.md       ← Periodic check instructions
    ├── skills/            ← Agent skills
    └── memory/            ← Agent memory

/data/.env                 ← Persistent env vars (managed via Setup UI)
```

### First boot

1. Container starts, installs dependencies
2. Server starts and serves the setup UI
3. User completes the welcome screen with required variables
4. Server runs `openclaw onboard`, configures channels, sanitizes secrets
5. Everything committed and pushed to your GitHub repo
6. Gateway starts

### Subsequent boots

1. `/data/.env` is sourced (picks up any variables set via the UI)
2. If config exists, channel reconciliation runs (picks up new tokens)
3. Server starts, gateway starts immediately

## Local development

Run the full stack locally with Docker:

```bash
# Copy and fill in your env vars
cp .env.example .env

# Start the container
docker compose up

# Visit the setup UI
open http://localhost:3000/setup
```

Source files in `src/` are mounted as a volume — edit locally and restart the container to pick up changes. Client-side JS changes (`src/public/`) only need a browser refresh.

## Troubleshooting

### Pairing

First time you DM the bot, it replies with a pairing code. Approve it in the setup UI at `/setup`. If the pairing doesn't appear, refresh the page.

### Bot doesn't respond

- Check deploy logs for errors
- Verify your channel token is correct (Envars tab)
- Redeploy to pick up variable changes

### Gateway crash loop

- Ensure the Railway volume is mounted at `/data`
- Check Anthropic credentials are valid
- Check deploy logs for the specific error

## Links

- [OpenClaw docs](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Community Discord](https://discord.com/invite/clawd)
