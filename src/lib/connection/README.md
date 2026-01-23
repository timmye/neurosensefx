# Connection Module

## Overview

The connection module manages WebSocket connectivity through a split-responsibility architecture with focused modules for connection lifecycle, subscription management, and reconnection logic while preserving the singleton pattern for backward compatibility.

## Architecture

```
ConnectionManager (Singleton Facade)
    ├── ConnectionHandler (WebSocket lifecycle)
    ├── SubscriptionManager (Message routing)
    └── ReconnectionHandler (Exponential backoff)
```

**Data Flow:**
```
WebSocket Message → SubscriptionManager.dispatch()
    ↓
System message? → All callbacks
Symbol message? → Key-based routing (${symbol}:${source})
    ↓
Callback invoked with error handling
```

## Design Decisions

### Why Split ConnectionManager?

Connection management splits three concerns: WebSocket lifecycle, subscription management, and reconnection logic. The split creates focused modules for each responsibility:
- `connectionManager.js` (~80 lines): Singleton facade, public API
- `connectionHandler.js` (~60 lines): WebSocket connect/disconnect
- `subscriptionManager.js` (~100 lines): Subscribe/unsubscribe, dispatch
- `reconnectionHandler.js` (~60 lines): Exponential backoff, retry logic

### Why Source-Aware Subscription Keys?

Format: `${symbol}:${source}` (e.g., `EURUSD:ctrader`)

Enables multi-source FX data (same symbol, different providers) with O(1) subscription lookup via Map and independent callbacks per source.

### Why Exponential Backoff with 5 Max Attempts?

Formula: `delay = 1000ms * 2^attempt`
- Attempt 1: 1s delay
- Attempt 5: 16s delay (cumulative: 31s)

Rationale: Prevents thundering herd on server during outages. 5 attempts covers 99% of transient outages, and users perceive >30s delay as system failure.

### Why Preserve Singleton Pattern?

Four components depend on `ConnectionManager.getInstance()`. Breaking the singleton would require cascading updates to Workspace.svelte, FloatingDisplay.svelte, FxBasketDisplay.svelte, and PriceMarkerManager.svelte. Preserving getInstance() reduces test breakage while new modules remain internal implementation details.

## Invariants

1. **ConnectionHandler Ownership**: ConnectionHandler owns the WebSocket instance - no other module accesses it directly.
2. **Subscription Uniqueness**: `${symbol}:${source}` keys must be unique per subscription. SubscriptionManager prevents duplicate keys.
3. **Exponential Backoff**: Reconnection delay follows `1000ms * 2^attempt` with max 5 attempts (31s total window).
4. **System Message Broadcasting**: Messages with type `status`, `ready`, or `reinit` must broadcast to ALL active subscriptions.
5. **Optional Callbacks**: All callbacks are optional - handlers check for existence before invoking.
