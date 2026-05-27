# services/tick-backend/utils/

Shared utility modules for reconnection logic and message building.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `ReconnectionManager.js` | Exponential backoff reconnection logic for session recovery | Debugging reconnection failures, modifying backoff parameters, implementing reconnection in new sessions |
| `MessageBuilder.js` | Conditional field inclusion and message construction utilities | Adding new message fields, modifying message format, understanding data routing messages |
