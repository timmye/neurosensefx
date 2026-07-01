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
export function symbolStatusMessage(status, { hasData = false, symbol = '', globalConnected = true } = {}) {
  switch (resolveSymbolStatus(status, hasData, globalConnected)) {
    case 'offline':
      return 'Disconnected from server';
    case 'pending':
      return `Resolving ${symbol || 'symbol'}…`;
    case 'error':
      return 'No data available';
    default:
      return null;
  }
}

// Terse variant for the PriceTicker symbol field (auto-uppercased by CSS;
// stored in title case per §6.1). Returns null when the symbol should show
// normally (pending leaves the symbol untouched — see §6.1).
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
