# SL/TP Analyzer — Debug & Integration Notes

## Endpoint

`GET /api/candles?symbol=EURUSD&resolution=15m&from=<ms>&to=<ms>`

Returns OHLC bars from cTrader historical data. Response format:
```json
{
  "symbol": "EURUSD",
  "resolution": "15m",
  "period": "M15",
  "bars": [{ "open", "high", "low", "close", "volume", "timestamp" }],
  "count": 77
}
```

## Fixes Applied (2026-05-01)

### 1. Route Shadowing — `/api/candles` caught by `/api/markers/:symbol`

**Symptom**: 401 UNAUTHORIZED on `/api/candles` even though the endpoint has no auth middleware.

**Root cause**: Express matches routes in registration order. `persistenceRoutes` (mounted at `app.use(persistenceRoutes)`) includes `/api/markers/:symbol`. When `addCandleApiRoutes` registered `/api/candles` AFTER persistenceRoutes, the request to `/api/candles` was matched by `/api/markers/:symbol` (with `:symbol` = "candles"), which requires auth → 401.

**Fix**: Moved `app.use(persistenceRoutes)` from module scope into `addCandleApiRoutes()`, called AFTER the candles router is mounted. Route order is now: auth → candles → persistence.

**File**: `services/tick-backend/httpServer.js`

### 2. Pandas `KeyError: 'timestamp'` in `fetch_ohlc`

**Symptom**: Script crashes with `KeyError: 'timestamp'` after backend starts returning data.

**Root cause**: Line 190 did `df[["Open", "High", "Low", "Close"]]` which drops the `timestamp` column. Line 192 then tried `df["timestamp"]` which no longer exists. Also had a redundant duplicate index assignment.

**Fix**: Keep `timestamp` in the column selection, removed redundant index logic.

**File**: `scripts/sl_tp_analyzer.py` (fetch_ohlc function, ~line 186-192)

## Script Usage

```bash
python3 scripts/sl_tp_analyzer.py data/20260430_full_history.csv --sl 25 --tp 60 --timeframe 15m --fx-only --n-trades 100
python3 scripts/sl_tp_analyzer.py data/20260430_full_history.csv --sl 25 --tp 60 --timeframe 15m --fx-only --sl-map data/sl_by_pair.txt
```

### --max-bars Scaling

The `--max-bars` parameter defaults scale with timeframe to ensure sufficient historical data:

| Timeframe | Default Bars | Approx Range |
|-----------|-------------|--------------|
| 5m / 15m / 30m | 2000 | ~7–14 days |
| 1h | 500 | ~21 days |
| 1d | 60 | ~60 days |

Override with `--max-bars <N>` when needed. Trades for the same symbol share one OHLC fetch (batched by date range + 48h padding).

### Parameters
- `--sl <pips>`: Stop loss in pips (default: 25)
- `--tp <pips>`: Take profit in pips (default: 40)
- `--timeframe`: 15m, 1h, or 1d (default: 1h)
- `--mode`: conservative (SL first), optimistic (TP first), neutral (EV split)
- `--backend`: cTrader backend URL (default: http://localhost:8080)
- `--fx-only`: Skip metals, oil, indices, crypto
- `--n-trades <N>`: Process only the last N trades (default: all)
- `--sl-map <file>`: Per-symbol SL override file (SYMBOL=PIP format, e.g. `data/sl_by_pair.txt`)

### Requirements
```bash
pip install pandas matplotlib openpyxl requests
```

### Output
- Console: full trade-by-trade results + summary metrics
- PNG: cumulative P/L chart (`cumulative_pips_SL{sl}_TP{tp}_{tf}_{mode}_{timestamp}.png`)
- CSV: per-trade simulation results (`simulation_results_SL{sl}_TP{tp}_{tf}_{mode}_{timestamp}.csv`)
