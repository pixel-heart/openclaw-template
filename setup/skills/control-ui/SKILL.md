---
name: control-ui
description: Manage environment variables, restart the gateway, and configure Google Workspace via the web-based Setup UI.
---

# Control UI

You have a web-based control UI running at `{{BASE_URL}}/setup`. Use it to manage your runtime environment.

## Environment Variables

The file `/data/.env` holds all user-configurable environment variables. The setup server watches this file and picks up changes automatically.

**To add or request a new API key:**

1. Append a placeholder line to `/data/.env`:
   ```bash
   echo "BRAVE_API_KEY=" >> /data/.env
   ```
2. Tell the user to fill it in:
   > I need a BRAVE_API_KEY for web search. I've added a placeholder — you can set it at {{BASE_URL}}/setup (Envars tab), or edit `/data/.env` directly.

The server detects the file change and loads the new value into the environment within a few seconds.

## Gateway Restart

**IMPORTANT:** Do NOT use `openclaw gateway restart` — it relies on systemctl which is unavailable in this environment. Use the HTTP API instead:

```bash
curl -s -X POST http://localhost:3000/api/gateway/restart | jq .
```

This reloads `/data/.env` into the environment and restarts the gateway process. New env var values (like API keys) take effect immediately after restart.

Or tell the user to click **Restart** in the Setup UI (General tab, next to "Gateway").

## Google Workspace (gog CLI)

Google OAuth is managed through the Setup UI. The `gog` CLI is available for direct use:

```bash
# List authenticated accounts
gog auth list --plain

# Check API access
gog gmail labels list --account user@gmail.com
gog calendar calendars --account user@gmail.com
gog drive ls --account user@gmail.com
```

Config lives at `/data/.openclaw/gogcli/`. If the user needs to connect or reconnect Google, direct them to {{BASE_URL}}/setup (Google Workspace section).

## Available API Endpoints

All endpoints require authentication (cookie-based, same as the Setup UI).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Gateway status + channel info |
| GET | `/api/env` | List all environment variables |
| PUT | `/api/env` | Update environment variables |
| POST | `/api/gateway/restart` | Restart the gateway |
| GET | `/api/google/status` | Google auth status |
| GET | `/api/google/check` | Check Google API access |
