# Tunnel (zrok) Optimization

## Problem

zrok and similar tunnel services add relay latency and occasional jitter to WebSocket connections. Two issues manifest:

1. **Slow initial load (30+ seconds)** — 75 subscriptions sent sequentially with 400ms delay each through the tunnel relay
2. **False disconnects / "needs refreshing"** — heartbeat/staleness thresholds too tight for tunnel jitter

## Root Causes

### Slow Load: Subscription Throttling

`subscriptionManager.js` sent each subscription individually with a 400ms `await` between them. 75 subs x 400ms = ~30s of artificial delay. Designed for local connections to avoid backend overload, but through zrok each message has added relay latency on top.

### False Disconnects: Tight Heartbeat Window

Backend sends heartbeat every 5s. Frontend considers connection stale after 10s. Through a tunnel, a few hundred ms of extra latency plus jitter causes the frontend to trigger false disconnects.

## Changes

### Subscription Batching (biggest impact)

**File:** `src/lib/connection/subscriptionManager.js:57-64, 131`

| | Before | After |
|--|--------|-------|
| Strategy | 400ms delay per subscription | Burst of 10, 200ms pause between batches |
| 75 subscriptions | ~30 seconds | ~1.4 seconds |

Rationale: Sending in bursts of 10 reduces tunnel round-trips. The 200ms pause between batches prevents overwhelming the backend while cutting total time from 30s to ~1.4s.

### Backend Heartbeat Interval

**File:** `services/tick-backend/WebSocketServer.js:113`

| | Before | After |
|--|--------|-------|
| Interval | 5000ms (5s) | 15000ms (15s) |

Rationale: 15s is frequent enough to detect real dead connections while tolerating tunnel jitter. The cTrader heartbeat is already 10s, so the backend-to-frontend heartbeat was unnecessarily aggressive.

### Frontend Staleness Threshold

**File:** `src/lib/connection/connectionHandler.js:23`

| | Before | After |
|--|--------|-------|
| `heartbeatTimeoutMs` | 10000ms (10s) | 30000ms (30s) |
| Check interval | 5000ms (timeout/2) | 15000ms (timeout/2) |

Rationale: 30s threshold gives 2x headroom above the 15s backend heartbeat, plus room for tunnel jitter. The check interval scales automatically (timeout/2).

### Frontend Reconnection Timing

**File:** `src/lib/connection/reconnectionHandler.js:17-18`

| | Before | After |
|--|--------|-------|
| `baseDelay` | 500ms | 1000ms (1s) |
| `maxDelayMs` | 10000ms (10s) | 15000ms (15s) |

Rationale: 500ms initial delay causes thundering herd through the tunnel when multiple tabs reconnect simultaneously. 1s base with 15s cap gives breathing room for the tunnel to recover.

## Settings Summary

```
Subscription batching:   burst of 10, 200ms between batches
Backend heartbeat:       15s send interval
Frontend stale timeout:  30s (no messages = reconnect)
Frontend check:          every 15s
Reconnect base delay:    1s
Reconnect max delay:     15s
Reconnect max attempts:  Infinity (unchanged)
Hidden tab multiplier:   3x, cap 60s (unchanged)
```

## What This Doesn't Change

- cTrader heartbeat (10s) — backend-to-cTrader, unrelated to tunnel
- Hidden tab behavior — already well-tuned
- Max reconnect attempts — Infinity, appropriate for trading
- Any auth, data pipeline, or chart rendering code

## Reverting

All changes are constants in 4 files. To revert, restore original values:
- `subscriptionManager.js`: change batch logic back to `400ms` per-subscription delay
- `WebSocketServer.js`: change `15000` back to `5000`
- `connectionHandler.js`: change `30000` back to `10000`
- `reconnectionHandler.js`: change `1000` back to `500`, `15000` back to `10000`
