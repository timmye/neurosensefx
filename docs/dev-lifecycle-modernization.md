# Dev Service Recovery Endpoint

## Context

When testing the dev environment via a zrok browser, the system can become unstable or connections can drop out. There's no way to restart services from the browser — the user must switch back to VS Code and run `run.sh stop` / `run.sh dev` manually.

There is no process manager (pm2, systemd, Docker restart policy) in dev mode. `process.exit(0)` kills the backend permanently with no auto-restart.

## Approach: Fire-and-forget restart endpoint

A single dev-only endpoint on the backend that spawns a detached child process to cycle all services, then responds immediately.

```
Browser → POST /api/dev/restart
Backend → responds 200 immediately
       → spawns detached child: run.sh stop && sleep 2 && run.sh dev
       → child survives parent's death
       → pkill kills hung backend (even if stuck)
       → sleep 2
       → run.sh dev starts fresh services
Browser → WebSocket drops → reconnects when services come back up
```

### Why this works when the backend is unstable

- The HTTP request only needs to arrive — the endpoint responds before doing heavy work
- The restart runs in a **detached child process** (`detached: true, unref()`) that outlives the parent
- `pkill -f "node.*server.js"` kills even a hung/stuck process
- The zrok tunnel survives (separate process, unaffected)
- The browser's existing WebSocket reconnection logic handles the brief downtime

### Why not other approaches

| Approach | Problem |
|----------|---------|
| `process.exit(0)` | Nothing restarts the process — no process manager in dev mode |
| Separate watchdog service | Overkill for dev-only use, another process to manage |
| nodemon | Nice-to-have for backend code changes, but doesn't solve the recovery use case |
| Web admin panel | Over-engineered — a single endpoint is sufficient |

## Implementation

### Files to Modify

1. **`services/tick-backend/httpServer.js`** — add dev-only restart route
2. **`src/components/ConnectionStatus.svelte`** (or equivalent) — optional: add "Restart" button to connection status UI

### Endpoint Specification

```
POST /api/dev/restart
```

- Gated behind `process.env.NODE_ENV !== 'production'`
- Responds `{ status: 'restarting' }` immediately
- Spawns detached child process: `run.sh stop && sleep 2 && run.sh dev`
- Child process logs to a known file for debugging
- No auth required — dev port (8080) only, not exposed in production

### Security

- Routes only registered when `NODE_ENV !== 'production'`
- Dev port (8080) is not exposed outside the devcontainer/network
- No auth needed — this is a local dev tool, not a production endpoint

### Verification

1. Start dev environment with `run.sh dev`
2. Open app via zrok browser
3. Trigger `POST /api/dev/restart` (curl, browser console, or UI button)
4. Confirm services stop and restart
5. Confirm browser reconnects automatically

## Deferred

- **nodemon** — can add later if backend auto-restart on code edits becomes valuable
- **Full restart** — currently restarts both frontend and backend via `run.sh`. If backend-only restart is needed, the endpoint can accept a `?scope=backend` query param
- **Status endpoint** — `GET /api/dev/status` for uptime/connection/memory could be added if useful for debugging instability
