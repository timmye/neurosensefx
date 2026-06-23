/**
 * Canonical symbol normalization shared across backend data feeds.
 *
 * Upper-cases and strips slashes + broker suffixes (e.g. ".P", ".F", "US500.MAY25")
 * so cTrader, TradingView, and the frontend all key the same instrument identically.
 * Examples: "USD/JPY.P" -> "USDJPY", "usdjpy" -> "USDJPY".
 *
 * Reconciles the cross-feed case/suffix divergence behind the
 * stale-data-after-hours regression (docs/bugs/stale-data-after-hours.md): cTrader
 * emits normalized names (e.g. "USDJPY") while TradingView emits raw names
 * (e.g. "usdjpy"), so the same instrument was keyed twice under each feed. Used by
 * MarketProfileService and TwapService so every data feed behaves identically.
 *
 * Deliberately more aggressive than CTraderSymbolLoader.normalizeName (which
 * preserves case for the tick path); the profile/TWAP subsystems reconcile case.
 *
 * Idempotent: normalizeSymbol(normalizeSymbol(x)) === normalizeSymbol(x).
 * Mirrored by the frontend in src/lib/connection/subscriptionManager.js.
 *
 * @param {string} raw - Raw symbol string from any feed
 * @returns {string} Canonical symbol key
 */
function normalizeSymbol(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  return raw.toUpperCase().replace(/\//g, '').replace(/\.[A-Za-z]+\d*$/g, '');
}

module.exports = { normalizeSymbol };
