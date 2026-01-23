# src/lib/connection/

WebSocket connection management split into focused modules.

## Files

| File                    | What                                          | When to read                                        |
| ----------------------- | --------------------------------------------- | --------------------------------------------------- |
| `connectionHandler.js`  | WebSocket lifecycle (connect, disconnect, events) | Understanding connection states, event flow       |
| `subscriptionManager.js`| Subscription tracking and message dispatch     | Implementing new subscription types, debugging routing |
| `reconnectionHandler.js`| Exponential backoff reconnection logic         | Tuning reconnection parameters, retry behavior      |
| `connectionManager.js`  | Singleton orchestrator for all handlers        | Using the connection module from components         |

## README.md

Architecture decisions, invariants, and design rationale for the connection module.
