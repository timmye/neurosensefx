# services/tick-backend/utils/

Shared utility modules for reconnection logic, message building, and symbol normalization.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `ReconnectionManager.js` | Exponential backoff reconnection logic for session recovery | Debugging reconnection failures, modifying backoff parameters, implementing reconnection in new sessions |
| `MessageBuilder.js` | Conditional field inclusion and message construction utilities | Adding new message fields, modifying message format, understanding data routing messages |
| `normalizeSymbol.js` | Canonical symbol normalization (upper-case + strip slashes/suffixes) shared by MarketProfileService and TwapService so both data feeds key the same instrument | Debugging cross-feed symbol-key divergence, stale profile/TWAP, modifying symbol canonicalization |
