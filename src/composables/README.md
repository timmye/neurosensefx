# Composables Module

## Overview

The composables module provides Svelte reactive utilities for `FloatingDisplay.svelte` with focused composables following Crystal Clarity principles. Each composable is a pure function that returns reactive state and methods.

## Architecture

```
FloatingDisplay.svelte
    ├── useSymbolData (Data transformation)
    ├── useWebSocketSub (Subscription lifecycle)
    ├── useDisplayState (Status tracking)
    ├── useDataCallback (Message processing)
    └── useDisplayHandlers (Event consolidation)
```

**Data Flow:**
```
WebSocket Message → useDataCallback.createCallback()
    ↓
useSymbolData.processSymbolData()
    ↓
Update Svelte $state refs
    ↓
Component re-renders
```

## Design Decisions

### Why Composables Instead of Component Logic?

FloatingDisplay.svelte manages data transformation, subscription management, connection status tracking, and event handling. Extracting to composables:
- Separates concerns (each <50 lines)
- Enables unit testing without Svelte mounting
- Allows reuse across components

### Why Composables Over Child Components?

Svelte 5 supports extractable logic via `$state` runes and composables. Instead of child components (which add DOM overhead and prop drilling), composables extract pure logic while preserving Svelte reactivity. This keeps logic in JavaScript without creating unnecessary component hierarchy.

### Why Callback Factory Pattern?

`useDataCallback` returns a function, not a singleton:

```javascript
// Good: Factory pattern (supports multiple displays)
const callback1 = createCallback(symbol1, ref1, ref2, canvas1);
const callback2 = createCallback(symbol2, ref3, ref4, canvas2);

// Bad: Singleton pattern (only works for single display)
const callback = getCallback();  // Which display?
```

Each `FloatingDisplay` instance creates its own callback with isolated refs.

### Why External State Refs?

Composables accept Svelte `$state` refs as parameters:

```javascript
// Component owns state
let lastData = $state(null);
let lastMarketProfileData = $state(null);

// Composable operates on external refs
const callback = createCallback(symbol, { value: lastData }, { value: lastMarketProfileData }, canvasRef);
```

Benefits:
- State lives in component (Svelte reactivity works naturally)
- Composables are pure functions (no internal state)
- Easier to test (pass mock refs)

## Invariants

1. **No Direct DOM Manipulation**: Composables return state/values, components handle rendering.
2. **ConnectionManager Injection**: All composables receive `connectionManager` as parameter (testability).
3. **Callback Factory Pattern**: `useDataCallback` returns functions, not singletons (multiple displays).
4. **State Refs are External**: Svelte `$state` refs are passed in from component.
5. **Svelte Reactivity Preserved**: WebSocket callbacks in FloatingDisplay must trigger Svelte reactivity via reactive statements (`$:`) or store updates.

## Error Handling

Each composable handles errors at its layer:

| Composable       | Error Strategy                                  |
| ---------------- | ----------------------------------------------- |
| `useSymbolData`  | Returns error in result object, does not throw  |
| `useWebSocketSub`| No errors (connectionManager handles them)       |
| `useDisplayState`| No errors (read-only operations)                 |
| `useDataCallback`| Catches all errors, calls `canvasRef.renderError()` |
| `useDisplayHandlers`| No errors (dispatches actions)               |
