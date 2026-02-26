# Render + Railway Template Design

## Goal
Make this repository a single template that supports both Railway and Render deployments with minimal drift, while preserving existing behavior and paths by default.

## Scope
- Add a Render Blueprint (`render.yaml`).
- Update runtime defaults to allow `PORT` and state/workspace paths to be configured by env.
- Update README to include both Railway and Render deployment instructions and environment notes.
- Keep Railway config (`railway.json`) and behavior intact.

## Architecture / Changes
- **Render Blueprint**: A single web service using the Dockerfile with `healthCheckPath: /health`, `plan: starter`, and a persistent disk mounted at `/data` (1GB). The Blueprint sets `PORT=8080`, `OPENCLAW_STATE_DIR=/data/.openclaw`, and `OPENCLAW_WORKSPACE_DIR=/data/workspace`, prompts for `SETUP_PASSWORD`, and auto-generates `OPENCLAW_GATEWAY_TOKEN`.
- **Port Handling**: The app continues to read `PORT` from env with a fallback (default `3000`). Render sets `PORT=8080` via the Blueprint. The Dockerfile `EXPOSE` is updated to `8080` to align with Render guidance, while Railway still uses `PORT` and ignores `EXPOSE`.
- **State/Workspace Paths**: Introduce env overrides for `OPENCLAW_STATE_DIR` and `OPENCLAW_WORKSPACE_DIR` across constants and shell scripts. Defaults preserve existing `/data/.openclaw` and `/data/.openclaw/workspace` locations. Render Blueprint sets workspace to `/data/workspace` per guide.
- **System Vars**: Treat `OPENCLAW_STATE_DIR` and `OPENCLAW_WORKSPACE_DIR` as system vars so they are hidden from the setup UI.
- **README**: Consolidate Railway and Render deployment instructions into one README, with clear platform-specific env and URL notes.

## Error Handling
No behavioral change to server error handling. Blueprint uses existing `/health` endpoint for health checks.

## Testing
- Update or add unit tests where constants or system vars are modified (`tests/server/routes-system.test.js` if needed).
- Run: `node --check src/server.js`, `node --check src/server/**/*.js`, and `npm test` (as per AGENTS.md) before push.

