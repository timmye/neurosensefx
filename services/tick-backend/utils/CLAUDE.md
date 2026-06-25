# services/tick-backend/utils/

Shared utility modules: logging, reconnection, message building, symbol normalization, and cTrader error classification.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `Logger.js` | Dependency-free leveled logging layer; every line prefixed with an ISO-8601 ms timestamp; exports `createLogger(moduleName)` and `describeError(err)` (surfaces `errorCode`/`description` from raw cTrader rejection payloads) | Adding module logging, diagnosing reconnect loops from `backend.log`, rendering cTrader rejections |
| `ReconnectionManager.js` | Exponential backoff reconnection for the unsupervised TradingView session; plateaus at `maxDelay` and never permanently gives up | Debugging TradingView reconnection, modifying backoff parameters |
| `ctraderErrorCode.js` | Classifies cTrader subscribe/symbol `errorCode` rejections into `ALREADY_SUBSCRIBED`/`RATE_LIMIT`/`PERMANENT`/`UNKNOWN` (used by the restore runner); strips `CH_` prefixes so bare and prefixed codes match | Modifying restore error handling, adding new retryable/permanent error codes |
| `MessageBuilder.js` | Conditional field inclusion + cTrader/TradingView/candleUpdate message construction (strips backend-only fields) | Adding message fields, modifying client-facing message format |
| `normalizeSymbol.js` | Canonical symbol normalization (upper-case + strip slashes/suffixes) shared by MarketProfileService and TwapService so both feeds key the same instrument | Debugging cross-feed symbol-key divergence, modifying symbol canonicalization |
| `constants.js` | Shared constants: `RESOLUTION_TO_PERIOD`, `VALID_PERIODS`, `SYMBOL_RE` | Adding resolutions/periods, validating symbols, mapping resolution strings |
| `SafeSender.js` | Backpressure-protected WebSocket `send()` (disconnects slow clients above 64KB buffered); `drainDisconnectCount()` counter | Debugging slow-client disconnects, adding backpressure protection |
