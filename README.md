# OpenClaw Railway Template

Deploy OpenClaw to Railway in one click. Get a 24/7 AI agent connected to Telegram or Discord, with your entire config and workspace backed up to GitHub.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/2VgcTk?referralCode=jcFhp_)

## What you get

- **OpenClaw Gateway** running 24/7
- **Everything version controlled** — config, cron jobs, workspace, and memory backed up to GitHub automatically
- **Telegram or Discord** configured out of the box
- **Secrets never committed** — raw API keys are replaced with `${ENV_VAR}` references before the first push

## Before you deploy

You need three things ready:

### 1. Anthropic authentication (pick one)

**Option A: API key (recommended)** — direct billing to your Anthropic account.

1. Go to [console.anthropic.com](https://console.anthropic.com/) → API Keys → Create Key

**Option B: Setup token** — uses your Claude Pro/Max subscription.

1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
2. Run `claude` and complete the OAuth login
3. Run `claude setup-token`
4. Copy the token

*Note: Anthropic has stated that using setup tokens outside of Claude Code may violate their terms of service.*

### 2. GitHub repo

Your agent's `.openclaw` directory (config, cron, workspace, memory) is version controlled and pushed to GitHub.

1. Create a **new private repo** on GitHub (leave it empty — no README, no .gitignore)
2. Create a [personal access token](https://github.com/settings/tokens) with `repo` scope
3. Copy the repo URL (any format works: `owner/repo`, SSH, or HTTPS)

### 3. Chat channel (pick at least one)

**Telegram:**
1. Message **@BotFather** on Telegram
2. Send `/newbot`, pick a name and username
3. Copy the token (looks like `123456789:AAHdq...`)

**Discord:**
1. [discord.com/developers/applications](https://discord.com/developers/applications) → New Application
2. Bot tab → Reset Token → copy it
3. Enable **Message Content Intent** under Privileged Gateway Intents
4. OAuth2 → URL Generator → `bot` scope + `Send Messages` → invite to your server

## Deploy

Click the deploy button and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Pick one | From Anthropic console (recommended) |
| `ANTHROPIC_TOKEN` | Pick one | From `claude setup-token` |
| `GITHUB_TOKEN` | ✅ | GitHub PAT with `repo` scope |
| `GITHUB_WORKSPACE_REPO` | ✅ | e.g. `owner/repo`, `git@github.com:owner/repo.git`, or HTTPS URL |
| `TELEGRAM_BOT_TOKEN` | Pick one | From BotFather |
| `DISCORD_BOT_TOKEN` | Pick one | From Discord Developer Portal |
| `OPENCLAW_GATEWAY_TOKEN` | Auto | Auto-generated, secures your gateway |
| `GIT_EMAIL` | Optional | For commits (default: agent@openclaw.ai) |
| `GIT_NAME` | Optional | For commits (default: OpenClaw Agent) |
| `OPENAI_API_KEY` | Optional | For OpenAI models |
| `GEMINI_API_KEY` | Optional | For Gemini models / image generation |
| `NOTION_API_KEY` | Optional | For Notion integration |

## After deploy

1. DM your bot on Telegram (or Discord)
2. The agent will request pairing — check the deploy logs or visit the Control UI at `https://your-app.up.railway.app/openclaw`
3. Approve the pairing
4. You're live

## How it works

```
/data/.openclaw/           ← Railway volume + git repo
├── openclaw.json          ← Config (secrets → ${ENV_VAR} references)
├── cron/jobs.json         ← Scheduled tasks
├── .gitignore             ← Excludes keys, logs, caches
├── agents/                ← Session state
└── workspace/             ← Agent workspace
    ├── AGENTS.md          ← Agent instructions
    ├── TOOLS.md           ← Tool notes + git discipline
    ├── HEARTBEAT.md       ← Periodic check instructions
    ├── skills/            ← Agent skills
    └── memory/            ← Agent memory
```

### First boot

1. `setup.sh` initializes a git repo at `/data/.openclaw/`
2. `openclaw onboard` scaffolds the config and workspace
3. Channel config (Telegram/Discord) is injected
4. Secrets are sanitized — raw values replaced with `${ENV_VAR}` references
5. Git discipline instructions appended to TOOLS.md and HEARTBEAT.md
6. Everything committed and force-pushed to your GitHub repo
7. Gateway starts

### Subsequent boots

Config already exists, gateway starts immediately. Your agent commits and pushes changes during normal operation.

## Troubleshooting

### Pairing

The first time you DM the bot, it needs pairing approval. Visit the Control UI at `https://your-app.up.railway.app/openclaw` and authenticate with your `OPENCLAW_GATEWAY_TOKEN` (find it in Railway variables).

### Bot doesn't respond

- Check deploy logs for errors
- Verify your channel token is correct
- Redeploy to pick up variable changes

### Gateway crash loop

- Ensure the Railway volume is mounted at `/data`
- Check that Anthropic credentials are valid
- Check deploy logs for the specific error

## Links

- [OpenClaw docs](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Community Discord](https://discord.com/invite/clawd)
