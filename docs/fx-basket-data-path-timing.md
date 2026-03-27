# FX Basket Data Path Timing Analysis

**Date:** 2026-03-27
**Scope:** FX Basket display data pipeline from subscription to render
**Purpose:** Understand timing chain, identify bottlenecks, and document latency budgets

---

## Overview

The FX Basket display aggregates currency strength from 28 FX pairs using ln-weighted geometric mean calculations. This document maps the complete timing chain from frontend initialization through data arrival and rendering.

---

## Timing Chain Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           FX BASKET DATA TIMING CHAIN                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

PHASE 1: FRONTEND INITIALIZATION
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ FxBasketDisplay │────►│ ConnectionManager│────►│ waitForConnection│
│   onMount()     │     │  .connect()      │     │   (10s timeout)  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                                        │
                          ~WebSocket handshake ~        ▼

PHASE 2: SUBSCRIPTION PHASE (28 pairs x 600ms)
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  for each pair (28 pairs):                                                               │
│    ┌────────────────────┐     ┌─────────────────────┐     ┌──────────────────────────┐   │
│    │ subscribeAndRequest│────►│ subscriptionManager │────►│ ws.send(get_symbol_data) │   │
│    │   (pair, cb, 14)   │     │   .subscribe()      │     │                          │   │
│    └────────────────────┘     └─────────────────────┘     └──────────────────────────┘   │
│                                       │                                                  │
│                                       ▼                                                  │
│                             await sleep(600ms)                                           │
│                           (rate limit: ~1.67 req/sec)                                    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 28 pairs x 600ms = ~16.8 seconds (subscription phase only)
                              ▼

PHASE 3: BACKEND REQUEST COORDINATION
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ RequestCoordinator.handleCTraderRequest()                                               │
│                                                                                         │
│   ┌────────────────────┐     ┌─────────────────────────────────────────────────────┐   │
│   │ checkCoalescing()  │────►│ cTraderSession.getSymbolDataPackage(symbol, 14)    │   │
│   │ (dedup requests)   │     │                                                     │   │
│   └────────────────────┘     └─────────────────────────────────────────────────────┘   │
│                                        │                                                │
│            ~cTrader API latency ~       ▼                                                │
│                               (varies: 50-500ms per pair)                               │
│                                        │                                                │
│                                        ▼                                                │
│                              ┌─────────────────────┐                                    │
│                              │ sendDataToClients() │                                    │
│                              └─────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼

PHASE 4: WEBSOCKET TRANSMISSION
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  Backend -> Frontend                                                                    │
│                                                                                         │
│   ┌───────────────────┐     ┌─────────────────────┐     ┌────────────────────────────┐  │
│   │ DataRouter        │────►│ broadcastToClients()│────►│ client.send(JSON.stringify)│  │
│   │ .routeFromCTrader │     │                     │     │                            │  │
│   └───────────────────┘     └─────────────────────┘     └────────────────────────────┘  │
│                                                                   │                      │
│                              ~network latency (1-50ms)~           ▼                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘

PHASE 5: FRONTEND PROCESSING
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  FxBasketDisplay.svelte                                                                 │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │ processorCallback (createProcessorCallback)                                      │  │
│   │   │                                                                              │  │
│   │   ├─► handleDataPackage() - for symbolDataPackage                               │  │
│   │   │     ├─► setDailyOpen(store, pair, todaysOpen)                               │  │
│   │   │     ├─► setCurrentPrice(store, pair, currentPrice)                          │  │
│   │   │     └─► processPairData()                                                   │  │
│   │   │           ├─► trackPair(stateMachine, pair, dailyOpen, currentPrice)        │  │
│   │   │           └─► updateBaskets(store, stateMachine) [when all 28 pairs ready]  │  │
│   │   │                                                                              │  │
│   │   └─► handleTick() - for tick messages                                          │  │
│   │         └─► processPairData()                                                   │  │
│   └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                                │
│                                        ▼                                                │
│                             handleBasketUpdate(baskets)                                 │
│                                        │                                                │
│                                        ▼                                                │
│                               renderCanvas()                                           │
│                                        │                                                │
│                                        ▼                                                │
│                          renderFxBasket(ctx, baskets, config, dimensions)              │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Timing Values

| Stage | Timing | Source Code |
|-------|--------|-------------|
| **Subscription Rate Limit** | 600ms per pair | `FxBasketDisplay.svelte:83` |
| **Total Subscription Time** | ~16.8s (28 x 600ms) | 28 FX pairs |
| **State Machine Timeout** | 60,000ms (60s) | `FxBasketDisplay.svelte:38` |
| **Connection Wait Timeout** | 10,000ms | `FxBasketDisplay.svelte:143` |
| **Data Freshness Check** | 5,000ms interval | `FxBasketDisplay.svelte:202` |
| **Resubscribe Delay** | 400ms | `subscriptionManager.js:101` |
| **Backend Retry Delay** | 500ms initial, exponential backoff | `RequestCoordinator.js:14` |
| **Max Backend Retries** | 3 | `RequestCoordinator.js:13` |

---

## State Machine Flow

```
┌───────────┐     first pair arrives      ┌───────────┐     all 28 pairs      ┌───────────┐
│  FAILED   │ ─────────────────────────► │  WAITING  │ ───────────────────► │   READY   │
└───────────┘                             └───────────┘                      └───────────┘
                                                │                                 ▲
                                                │ 60s timeout                     │
                                                │ < 60% coverage                 │ │
                                                ▼                                 │
                                          ┌───────────┐                           │
                                          │   ERROR   │ ──────────────────────────┘
                                          └───────────┘   >= 60% coverage (partial)
```

### State Definitions

| State | Meaning | Render Behavior |
|-------|---------|-----------------|
| `FAILED` | Initial state, no data received | Status message |
| `WAITING` | Receiving pairs, not all 28 yet | Progress indicator (X/28) |
| `READY` | All pairs received, baskets calculated | Full basket display |
| `ERROR` | Timeout with <60% coverage | Error message with missing pairs |

---

## Calculation Timing (per basket update)

| Operation | Complexity | Description |
|-----------|------------|-------------|
| `calculateBasketValue()` | O(7) per currency | Iterates 7 pairs per basket |
| `updateBaskets()` | O(8 x 7) = O(56) | 8 currencies x 7 pairs each |
| `normalizeToBaseline()` | O(1) | Simple exponential calculation |
| Canvas render | O(8) | 8 basket markers with labels |

All calculations are sub-millisecond on modern hardware.

---

## Timing Stacking Analysis

### Total Time to First Render

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│  WebSocket Connect     ~100-500ms                                              │
│  Subscription Phase    ~16,800ms  (28 x 600ms)                                 │
│  Backend Fetch         ~1,400-14,000ms (28 pairs x 50-500ms API latency)       │
│  Network Transmission  ~1-50ms per message                                     │
│  Frontend Processing   ~1-5ms per pair                                         │
│  Canvas Render         ~1-5ms                                                  │
│  ─────────────────────────────────────────────────────────────────────────     │
│  TOTAL                 ~18-32 seconds for full initialization                  │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Bottleneck Analysis

| Phase | Duration | Bottleneck? | Reason |
|-------|----------|-------------|--------|
| WebSocket Connect | ~100-500ms | No | Normal connection latency |
| Subscription Phase | ~16.8s | **YES** | Rate limiting (600ms/pair) |
| Backend Fetch | ~1.4-14s | Moderate | cTrader API latency varies |
| Network/Processing | ~10-100ms | No | Fast local operations |

**Primary bottleneck:** Subscription phase at ~17 seconds due to rate limiting.

---

## Data Flow Components

### Frontend Components

| File | Role | Timing Impact |
|------|------|---------------|
| `FxBasketDisplay.svelte` | UI component, orchestrates subscriptions | Rate limiting (600ms) |
| `fxBasketProcessor.js` | Routes messages to state machine | Negligible |
| `fxBasketStateMachine.js` | Tracks pair arrival, manages state | Timeout (60s) |
| `fxBasketStore.js` | Dual-Map store for baseline/current | Negligible |
| `fxBasketManager.js` | High-level basket operations | Negligible |
| `fxBasketCalculations.js` | Ln-weighted calculations | Negligible |
| `fxBasketOrchestrator.js` | Canvas rendering coordination | Negligible |

### Backend Components

| File | Role | Timing Impact |
|------|------|---------------|
| `RequestCoordinator.js` | Request coalescing, retry logic | Retry delays (500ms+) |
| `DataRouter.js` | Routes data to subscribed clients | Negligible |
| `CTraderSession.js` | cTrader API communication | API latency (50-500ms) |
| `WebSocketServer.js` | Client connection management | Negligible |

---

## Critical Timing Dependencies

1. **Subscription Phase** (16.8s): Must complete before all pairs can arrive
2. **State Machine Timeout** (60s): Covers subscription + backend fetch + buffer
3. **Rate Limiting**: 600ms prevents cTrader API `REQUEST_FREQUENCY_EXCEEDED` errors
4. **Coalescing**: Multiple clients requesting same symbol share one backend request

---

## Optimization Opportunities

| Area | Current | Potential Improvement |
|------|---------|----------------------|
| Subscription rate | 600ms/pair | Parallel subscriptions with backend queue |
| Backend coalescing | Per-symbol | Could extend to batch responses |
| State machine timeout | 60s fixed | Could be adaptive based on arrival rate |

---

## Related Documentation

- `src/lib/fxBasket/README.md` - FX Basket architecture
- `docs/data-pipeline-architecture.md` - General data pipeline
- `services/tick-backend/CLAUDE.md` - Backend service reference
