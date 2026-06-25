# src/lib/connection/

WebSocket connection management split into focused modules.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `connectionHandler.js` | WebSocket lifecycle (connect, disconnect, events) | Understanding connection states, event flow |
| `subscriptionManager.js` | Subscription tracking and message dispatch | Implementing new subscription types, debugging routing |
| `reconnectionHandler.js` | Exponential backoff reconnection logic | Tuning reconnection parameters, retry behavior |
| `README.md` | Connection module architecture overview | Understanding connection module architecture |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `__tests__/` | Unit tests for connection modules (`subscriptionManager.test.js`, `reconnectionHandler.test.js`) | Running connection tests, adding test coverage |
