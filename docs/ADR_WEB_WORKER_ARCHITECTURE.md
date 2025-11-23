# ADR: Per-Display Web Worker Architecture

## Status
Accepted - 2024-11-23

## Context
NeuroSense FX needed parallel market data processing for multiple displays while preventing race conditions and ensuring clean resource management.

## Decision
We will use per-display Web Workers with unique worker keys (symbol-displayId) rather than per-symbol workers, implementing sequential initialization to prevent race conditions.

## Consequences
**Benefits:**
- True parallel processing - each display has isolated computation
- Eliminates race conditions through sequential worker creation
- Clean resource lifecycle tied to display lifecycle
- Simplified error handling and debugging per display

**Tradeoffs:**
- Increased memory usage with multiple workers per symbol
- More complex worker management overhead
- Duplicate computation for same symbol across displays

## Implementation
1. Worker creation uses unique keys: `${symbol}-${displayId}`
2. Sequential initialization with async/await pattern
3. Automatic worker termination on display removal
4. Global configuration propagation to all workers
5. Defensive state checking prevents crashes

## Key Pattern
```javascript
// Sequential initialization prevents race conditions
await createWorkerForSymbol(symbol, displayId);
initializeWorker(symbol, displayId, initData);
```