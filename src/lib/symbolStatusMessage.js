// Symbol subscription status → display message.
//
// Centralizes the wording for the per-symbol no-data states (pending/error)
// so every market-data display shares one source of truth. Layer A (precise
// code-keyed error messages, once the error frame carries a `code`) plugs in
// here as a one-line map — see resolveSymbolStatus.
//
// Only the no-data states are covered: once price data has arrived the caller
// renders normally (these helpers return null). Stale-after-data freshness is
// handled by separate logic (FX basket) and is intentionally out of scope.

// Maps a per-symbol status to a short display descriptor, or null when the
// caller should render normally (data present / healthy).
//
// Inputs:
//   status           — marketDataStore per-symbol status ('pending'|'connected'|'error'|'stale'|…)
//   hasData          — boolean, true when price data has arrived (current != null)
//   globalConnected  — boolean, true when the WebSocket itself is connected
//
// Returns one of: 'offline' | 'pending' | 'error' | null
//
//   'offline' — socket down; this dominates a per-symbol error (can't blame the
//               symbol when the transport is gone)
//   'pending' — resolving, no data yet
//   'error'   — per-symbol subscription failed, no data yet
//   null      — healthy / has data; render normally
export function resolveSymbolStatus(status, hasData, globalConnected) {
  if (hasData) return null;
  if (globalConnected === false) return 'offline';
  if (status === 'error') return 'error';
  if (status === 'pending') return 'pending';
  return null;
}

// Full-sentence variant for canvas displays (FloatingDisplay/DisplayCanvas).
// Returns the message string, or null when the caller should render normally.
//
// When the backend attaches a structured `code` (Layer A) the error branch
// returns a precise, actionable message keyed by source+code. When `code` is
// absent or unrecognized it falls back to the generic "No data available" so it
// stays backward-compatible with older backends/clients.
export function symbolStatusMessage(status, { hasData = false, symbol = '', globalConnected = true, code = null, source = '' } = {}) {
  switch (resolveSymbolStatus(status, hasData, globalConnected)) {
    case 'offline':
      return 'Disconnected from server';
    case 'pending':
      return `Resolving ${symbol || 'symbol'}…`;
    case 'error':
      return errorStatusMessage(code, source, symbol);
    default:
      return null;
  }
}

// Layer A: precise code-keyed error wording (canvas displays only). The ticker
// (~8-char symbol field) can't fit the distinction, so tickerSymbolStatus below
// stays terse — precise messages are canvas-only by design.
function errorStatusMessage(code, source, symbol) {
  switch (code) {
    case 'SYMBOL_NOT_FOUND':
      return source === 'ctrader'
        ? `${symbol || 'Symbol'} isn't available on your cTrader account.`
        : 'No data available';
    case 'RATE_LIMIT':
      return source === 'ctrader'
        ? 'Broker is busy — retrying…'
        : 'No data available';
    case 'TIMEOUT':
      return source === 'tradingview'
        ? 'No data from TradingView for this symbol — check the symbol.'
        : 'No response from the broker — try again.';
    case 'RESOLVE_FAILED':
      return source === 'tradingview'
        ? 'TradingView couldn\'t resolve this symbol.'
        : 'No data available';
    case 'INVALID_SYMBOL':
      return 'That doesn\'t look like a valid symbol.';
    default:
      return 'No data available';
  }
}


// Terse variant for the PriceTicker symbol field (auto-uppercased by CSS;
// stored in title case per §6.1). Returns null when the symbol should show
// normally (pending leaves the symbol untouched — see §6.1).
//
// Deliberately UNCHANGED by Layer A: the ticker's ~8-char symbol field can't
// fit the precise code-keyed distinction, so it keeps NO DATA/OFFLINE. Precise
// messages are canvas-only (symbolStatusMessage above).
export function tickerSymbolStatus(status, { hasData = false, globalConnected = true } = {}) {
  switch (resolveSymbolStatus(status, hasData, globalConnected)) {
    case 'offline':
      return 'Offline';
    case 'error':
      return 'No data';
    // 'pending' → null: ticker keeps the symbol + existing '…' placeholder
    default:
      return null;
  }
}
