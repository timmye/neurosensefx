# `/health` — backend health & recovery endpoint

The tick-backend exposes a no-auth HTTP endpoint for **liveness** (Docker) and **feed observability**
(operators/monitoring), plus a dev-only companion action to force a reconnect. This doc covers how to
invoke it, read it, and act on it practically.

- **Implementation:** `services/tick-backend/httpServer.js` → `addRecoveryRoutes(supervisor, tradingViewSession)` (mounted in `server.js`).
- **Source of truth for the payload:** `FeedSupervisor.observableState()` (`services/tick-backend/supervision/FeedSupervisor.js`).

---

## The two roles

1. **Docker container liveness** — `docker-compose.dev.yml` and `docker-compose.yml` poll `/health`;
   HTTP 200 marks the container `healthy`. ⚠️ This only proves the **process is up**, not that feeds are working.
2. **Operator / monitoring visibility** — the `feeds` payload exposes each supervised feed's live
   state-machine state, how long it's been there, and reconnect attempts — so you can see what cTrader
   is doing without grepping logs.

---

## How to invoke

```bash
# Dev (direct backend on :8080)
curl http://localhost:8080/health

# Prod (via nginx on :80)
curl http://localhost/health
# or from another host:
curl http://<host>/health

# Pretty-printed:
curl -s http://localhost:8080/health | python3 -m json.tool

# Just the HTTP status code (what Docker's healthcheck does):
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/health
```

No authentication required.

---

## Response shape

```json
{
  "status": "ok",
  "feeds": [
    { "feed": "ctrader", "state": "CONNECTED", "since": 1782344157213, "attempts": 0 }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `status` | **Always `"ok"`** (hardcoded). Do **not** read into it — it just means the HTTP server answered. Trust `feeds[].state`. |
| `feeds[].feed` | Feed name (currently only `ctrader` is supervised). |
| `feeds[].state` | Live state-machine value — the useful field (see table below). |
| `feeds[].since` | Epoch-ms the feed entered that state (so you can tell "how long has it been DEGRADED?"). |
| `feeds[].attempts` | Reconnect attempts since the last `CONNECTED`. Climbing = the feed is struggling; resets to 0 on each successful `CONNECTED`. |

---

## States — what they mean and when to act

| State | Meaning | Action |
|-------|---------|--------|
| `CONNECTED` | Healthy; handshake done, (re)subscribing. | None — good. |
| `CONNECTING` / `HANDSHAKING` | Mid-(re)connect. | Transient — check again in a few seconds. |
| `DEGRADED` | Connected but no data ticks arriving (idle / 0 clients, or a real stall). | Watch `since`; if it lingers **while clients are subscribed**, investigate. |
| `BACKOFF` | Reconnect failed; waiting to retry with backoff. | If `attempts` keeps climbing, the broker/network is the problem. |
| `DISCONNECTED` | Supervisor stopped (shutdown). | Expected only during a restart. |

> With **0 frontend subscriptions** no data ticks arrive, so the supervisor correctly parks cTrader in
> `DEGRADED` and force-reconnects every `dataStaleMs` (60s). This is **expected** with no clients, not a
> fault. With subscriptions active, data flows and the feed stays `CONNECTED`.

---

## Practical patterns

**One-shot check:**
```bash
curl -s http://localhost:8080/health | python3 -c "import sys,json; \
  f=json.load(sys.stdin)['feeds'][0]; print(f['state'], 'attempts='+str(f['attempts']))"
```

**Watch it live (poor-man's monitor):**
```bash
watch -n2 'curl -s http://localhost:8080/health | python3 -m json.tool'
```

**Alert on (the things that actually matter):**
- `attempts` climbing past a threshold (e.g. > 5) → broker/network trouble.
- `state` stuck in `BACKOFF` or `DEGRADED` (with clients subscribed) for longer than N minutes →
  something is wrong, **even though `status:"ok"`**.

---

## The action side — `POST /admin/reconnect` (dev-only)

When `/health` shows a stuck feed, force a clean reconnect. **Disabled in production** (dev / `NODE_ENV !== production` only).

```bash
curl -X POST http://localhost:8080/admin/reconnect                 # → {"ok":true,"feed":"all"}
curl -X POST "http://localhost:8080/admin/reconnect?feed=ctrader"  # one feed only
```

It calls `supervisor.reset('ctrader')` (clears timers, zeroes attempts, force-closes, reconnects). Then
watch `/health` flip `CONNECTING` → `CONNECTED` (typically ≤1 cycle, ~2s).

---

## Caveats

- **`status:"ok"` + HTTP 200 is always returned while the process runs** — a container can be "healthy"
  with all feeds down. Trust `feeds[].state`, not `status`.
- **Only cTrader is reflected.** TradingView is not under the `FeedSupervisor`, so its state is absent
  here (see the TradingView section of `docs/bugs/stale-data-after-hours.md`). A lightweight addition
  to expose TV's `isConnected()` / last-data time here is the recommended follow-up (no supervisor port
  needed).
- **`attempts` is a "current struggle" counter**, not lifetime — it resets to 0 on each successful `CONNECTED`.

---

## Observed behavior (live demo, 2026-06-24)

```
$ curl http://localhost:8080/health
{"status":"ok","feeds":[{"feed":"ctrader","state":"CONNECTED","since":1782344157213,"attempts":0}]}

$ curl -X POST http://localhost:8080/admin/reconnect
{"ok":true,"feed":"all"}

$ curl http://localhost:8080/health        # immediately after
{"...","state":"CONNECTING","since":1782344187199,"attempts":0}

$ curl http://localhost:8080/health        # 3s later — converged in 1 cycle
{"...","state":"CONNECTED","since":1782344188848,"attempts":0}
```

**Net:** `GET /health` to look, `POST /admin/reconnect` (dev) to act. `status:"ok"` means "process up";
`feeds[].state` is the real signal.
