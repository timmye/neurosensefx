# Web Worker Communication Protocol

NeuroSense FX uses per-display Web Workers with unique keys for parallel market data processing.

## Architecture

**Worker Creation Pattern**
```javascript
// Unique worker per display (not per symbol)
const workerKey = `${symbol}-${displayId}`;
const worker = new Worker('../workers/dataProcessor.js');
```

**Sequential Initialization**
```javascript
// Prevents race conditions with async creation
await createWorkerForSymbol(symbol, displayId);
initializeWorker(symbol, displayId, initData);
```

## Message Protocol

**Main → Worker Messages**
- `init`: Worker initialization with config and market data
- `tick`: Real-time market data updates
- `updateConfig`: Configuration changes propagation

**Worker → Main Messages**
- `stateUpdate`: Processed visualization state updates

## Lifecycle Management

**Worker Cleanup**
```javascript
// Automatic termination on display removal
worker.terminate();
workers.delete(workerKey);
```

**Error Handling**
- Defensive state checks before processing
- Schema validation for state updates
- Graceful degradation on worker failures

## Configuration Propagation

Global config changes propagate instantly to all workers:
```javascript
workers.forEach((worker, key) => {
  worker.postMessage({ type: 'updateConfig', payload: newConfig });
});
```

Workers maintain isolated state per display while sharing configuration globally.