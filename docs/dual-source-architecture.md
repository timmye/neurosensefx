# Dual-Source Architecture Pattern

## Overview

The system has two data sources feeding the same frontend:

| Source | Protocol | Data |
|--------|----------|------|
| cTrader | Protobuf (OpenAPI) | Ticks, M1 bars, historical candles |
| TradingView | JSON WebSocket | Ticks, M1 bars, D1 candles |

Both sources can serve the same symbols. TradingView covers symbols cTrader doesn't (crypto, indices, different brokers).

## The Pattern

### Routing layer: source-aware

Subscriptions are keyed by `symbol:source` (e.g., `EURUSD:tradingview`). The source tag determines which backend pipeline handles the initial data fetch and which WebSocket delivers live updates.

- Frontend: `SubscriptionManager` dispatches by `symbol:source` key
- Backend: `SubscriptionManager.getSubscribedClients(symbol, source)` routes broadcasts

### Computation layer: source-agnostic

Services that compute derived data (TWAP, Market Profile) must treat both pipelines as equivalent — they deliver the same market reality.

**Rules for derived-data services:**

| Concern | Correct approach | Why |
|---------|-----------------|-----|
| State key | `symbol` only | Both sources write to the same accumulator |
| Deduplication | `symbol` only | Both pipelines deliver the same M1 bar |
| Initialization | Idempotent (skip if already initialized) | Prevents source race overwrites |
| Broadcast | All subscribers (both sources) | Frontend doesn't care which pipeline fed the data |
| `source` field in emit | Omit | Forces routing layer to broadcast universally |

## Bug Class: Source-Awareness Mismatch

Every derived-data service must answer 4 questions consistently. Getting any wrong produces silent data loss or corruption:

1. Key state by `symbol` or `symbol:source`?
2. Initialize from one source or both?
3. Deduplicate by `symbol` or `symbol:source`?
4. Broadcast to one source's subscribers or all?

**50 source-awareness points across 11 files** in the backend. Each new derived-data feature must navigate these correctly at the service, router, and dispatcher layers.

## Current Status (2026-04-09)

### TWAP — fixed but unverified

Applied the source-agnostic pattern to TwapService:

- `TwapService.js`: idempotent init, symbol-only dedup, no source in state/emits, isInitializing guard
- `DataRouter.js`: `routeTwapUpdate` always broadcasts to both ctrader + tradingview subscribers
- `WebSocketServer.js`: removed dead `data.source` reference, added isInitializing to daily reset guard
- `subscriptionManager.js` (frontend): added source-agnostic dispatch for twapUpdate (match by symbol prefix across all sources)

**TWAP dots still not showing for some symbols.** The code changes are correct in theory but the bug hasn't been verified in a running session. Possible remaining issues:

- Frontend HMR may not have picked up the subscriptionManager.js change
- The `delivered` Set in the new dispatch path deduplicates callback references — if the same callback is registered under different keys, it only fires once (correct). But if the FX basket and marketDataStore register different callbacks for the same symbol, both should fire (also correct).
- Need to check browser console for twapUpdate dispatch logs to confirm messages are reaching the frontend

### Market Profile — same bug class, not yet fixed

`MarketProfileService` still deduplicates by `${symbol}:${barSource}` (double-counts when both pipelines deliver the same bar). Needs the same source-agnostic dedup treatment.

## Files

| File | Source-awareness role |
|------|----------------------|
| `services/tick-backend/WebSocketServer.js` | Wires both sources to all services |
| `services/tick-backend/DataRouter.js` | Routes data to subscribers by source |
| `services/tick-backend/SubscriptionManager.js` | Backend subscription tracking by `symbol:source` |
| `services/tick-backend/TwapService.js` | Source-agnostic (fixed) |
| `services/tick-backend/MarketProfileService.js` | Still per-source dedup (needs fix) |
| `services/tick-backend/RequestCoordinator.js` | Branches into cTrader/TradingView init paths |
| `services/tick-backend/TradingViewCandleHandler.js` | Separate TV init path for TWAP + profile |
| `src/lib/connection/subscriptionManager.js` | Frontend dispatch by `symbol:source` |
| `src/stores/marketDataStore.js` | Handles twapUpdate messages |
