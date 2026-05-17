# SL/TP Analyzer — Bug Analysis

**Date:** 2026-05-04
**Script:** `scripts/sl_tp_analyzer.py`

## Summary

The SL/TP walk-forward analyzer produces incorrect results due to a **data gap bug** caused by the cTrader backend's chunked historical fetch. When fetching a wide date range, entire periods are silently dropped, causing trades to be simulated against OHLC bars from completely wrong time periods.

---

## Root Cause: Chunked OHLC Fetch Loses Data

### How it works

1. The script groups trades by symbol and fetches OHLC data for the **entire date range** spanning all trades (+48h padding).
2. The cTrader backend (`CTraderDataProcessor.fetchHistoricalCandles`) enforces a **35-week range limit per chunk** for M15 bars (`PERIOD_RANGE_LIMITS['M15'] = 21168000000 ms`).
3. For a wide range (e.g., Aug 2024 to Mar 2026 = ~18.5 months), the backend chunks the request into multiple `ProtoOAGetTrendbarsReq` calls.
4. The chunking logic advances `currentFrom` based on the **last bar's timestamp** returned by each chunk, not the chunk boundary:

```js
// CTraderDataProcessor.js line 136-141
const lastBarTs = allBars[allBars.length - 1].timestamp;
if (lastBarTs <= currentFrom) {
    currentFrom = chunkEnd;  // no progress — jump to chunk end
} else {
    currentFrom = lastBarTs + 1;  // advance from last bar
}
```

5. When a chunk returns bars with gaps (weekends, holidays, or missing historical data), the next chunk starts from `lastBarTs + 1`, which can **skip over periods** where data exists but wasn't returned in the previous chunk.

### Evidence

| Fetch type | Result |
|---|---|
| Narrow fetch (May 3–14, 2025) | 738 bars, continuous coverage |
| Wide fetch (Aug 2024 – Mar 2026) | 32,525 bars, **zero bars for May 2025** |

The wide-range fetch is missing **May 2025 entirely** despite the narrow fetch confirming data exists for that period.

### Impact on simulation

When the OHLC data has a gap around a trade's entry time, the `df.index >= entry_dt` filter finds the first available bar **after the gap**, which may be days or weeks later in a completely different price regime.

**Concrete example — Trade #35:**

| Field | Value |
|---|---|
| Entry | 2025-05-08 09:20, EURUSD BUY @ 1.12881 |
| SL | 1.12631 (25 pips) |
| TP | 1.13481 (60 pips) |
| Actual close | 1.12351 (price went **down**, past SL) |
| Simulation result | **WIN, +60 pips, "TP hit after 2 bars"** |

The OHLC data for May 8 is missing. The first bar after the entry filter is **June 5**, when EURUSD was trading ~1.14. Since 1.14 > TP (1.13481), every bar "hits" TP. The simulation reports a win when the trade actually lost.

---

## Secondary Bugs

### 1. Mid-bar entry skip (line 495–498)

When an entry occurs mid-bar, the entry bar is skipped entirely. While this avoids look-ahead bias (price action before entry can't trigger stops), it means:

- SL/TP checks don't run on the entry bar, even though stops/limits are active immediately on entry.
- The `sim_bars` count is off by 1 (reports `idx + 1` where `idx` was incremented past the skipped bar).

```python
# Line 495-498: mid-bar skip
if idx == 0:
    bar_open_ts = ts.to_pydatetime().replace(tzinfo=None)
    if entry_dt_normalized != bar_open_ts:
        continue  # Entry was mid-bar; start checking from next bar
```

### 2. Fallback exit at last bar close (line 535–548)

When neither SL nor TP is hit within `max_bars` bars, the simulation uses the last bar's close price as the exit:

```python
if not sim_result:
    if len(future) > 0:
        last_bar = future.iloc[-1]
        exit_price = last_bar["Close"]
        sim_pips = ((exit_price - t["open_price"]) / pip_size) if is_buy \
                   else ((t["open_price"] - exit_price) / pip_size)
        sim_result = {
            "sim_result": "win" if sim_pips >= 0 else "loss",
            ...
        }
```

This is unrealistic — positions would either remain open or be manually closed. It can produce spurious wins/losses when the last bar's close happens to be above/below entry by chance.

---

## Affected Output

All generated charts (`cumulative_pips_*.png`) are unreliable because they contain simulated results from trades matched against wrong OHLC data. The graphs show large drawdowns where SL should have triggered because:

1. Trades with missing OHLC data are simulated against bars from wrong time periods
2. The fallback exit logic creates artificial P/L for trades where SL/TP wasn't hit

---

## Fixes Applied

### Primary fix: Backend chunking logic (DONE)

Changed `CTraderDataProcessor.js:141` from `currentFrom = lastBarTs + 1` to `currentFrom = chunkEnd`. Both branches of the if/else now advance to the chunk boundary, eliminating the gap-skipping bug for all consumers of `fetchHistoricalCandles`. The existing deduplication at lines 184-191 handles any resulting overlap between chunks.

### Analyzer script: Option C — Per-symbol forward windows (DONE)

Replaced the batch-per-symbol fetch in `simulate_trades` with per-symbol forward window fetching:

- Trades sorted chronologically per symbol
- `cached_df` reused when the next trade's entry falls within already-fetched data
- New windows fetched from `trade_entry - 48h` extending by `min(35 weeks, max_bars * interval_ms)`
- 0 `no_data` entries across 536 trades in full history (Aug 2024 – Apr 2026)
- 29 symbols covered, ~100 API calls total

### Verification

| Check | Result |
|---|---|
| Critical trade (May 8, 2025 EURUSD BUY @ 1.12881) | **LOSS -25 pips** (SL hit after 25 bars) — was false WIN +60 pips |
| May 2025 data availability | 2026 bars for EURUSD May 3 – Jun 2, 2025 |
| May 2025 trades in results | 23 trades, all processed correctly |
| Old batch-fetch vs new Option C (n=100) | 0 mismatches, identical metrics (53W/47L, +912.6 pips) |
| Full history (536 trades) | 223W/313L, 41.6% win rate, +1052.4 pips, 0 no_data |

### Data Handling Alternatives for the Analyzer Script

The current script fetches one wide-range OHLC per symbol (all trades for a symbol share one fetch spanning the full date range + 48h padding). Below are alternative data handling approaches, ordered from simplest to most robust.

#### Option A: Fix chunking only (minimal change)

Fix the backend chunking bug (`currentFrom = chunkEnd`) and leave the script's batch-per-symbol fetch as-is.

| | |
|---|---|
| **API calls** | One per symbol (e.g., 10 calls for 10 symbols) |
| **Data volume** | High — for an 18-month range, ~4 chunks × 35 weeks = 140 weeks fetched to get 72 weeks of actual data (~2x overhead from cTrader's 35-week limit) |
| **Correctness** | Good — chunking fix eliminates gaps |
| **Risk** | Low — one-line backend fix, existing dedup handles overlap |
| **Best for** | Quick fix, scripts that already batch by symbol |

This is the minimal viable fix. The script works correctly after the backend change, but still fetches redundant data for wide ranges because each chunk covers 35 weeks regardless of how much data is actually needed.

#### Option B: Per-trade fetch (eliminates chunking for the script)

For each trade, fetch OHLC from `entry_time - 48h` to `entry_time + max_bars * interval`. With max_bars=2000 at 15m, each window is ~87 days, well within the 35-week limit. No chunking needed.

| | |
|---|---|
| **API calls** | One per trade (e.g., 1000 calls for 1000 trades) |
| **Data volume** | Minimal — each fetch covers only what's needed for that trade |
| **Correctness** | Excellent — no chunking, no gap risk |
| **Risk** | Moderate — rate limiting could add latency (2s backoff on 429). 1000 calls at ~3s average = ~50 minutes. The existing retry logic handles this. |
| **Best for** | Maximum correctness, scripts where accuracy matters more than speed |

The existing cache at `fetch_ohlc` (keyed on `symbol_resolution_start_end`) deduplicates identical time windows. Trades at the same timestamp share cached data. However, adjacent trades at different timestamps produce different cache keys, so redundancy remains at the per-bar level.

#### Option C: Per-symbol forward windows (recommended)

For each symbol, sort trades by entry time. Walk through trades chronologically, fetching a forward window from the **unfetched point** to `unfetched + max_lookahead` (e.g., 35 weeks or `max_bars * interval`, whichever is smaller). Track the highest timestamp fetched so far. Each fetch extends the window forward, covering all trades whose entry times fall within the new window.

```
Trades sorted by time: T1, T2, T3, T4, T5
Unfetched: T1
Fetch [T1 - 48h, T1 + 35 weeks] → covers T1, T2, T3
Unfetched: T4
Fetch [T4 - 48h, T4 + 35 weeks] → covers T4, T5
```

| | |
|---|---|
| **API calls** | One per symbol per window (e.g., 2-5 calls for 10 symbols with clustered trades) |
| **Data volume** | Moderate — each window is bounded to 35 weeks, minimal overlap between consecutive windows |
| **Correctness** | Excellent — windows stay within 35-week limit, chunking rarely needed; with chunking fix, even wide windows are safe |
| **Risk** | Low — combines per-trade correctness with symbol-level batching efficiency |
| **Best for** | Production use — balances correctness, efficiency, and reusability |

This is the recommended approach because it:
- Keeps API call count low (one per symbol per window, not per trade)
- Bounds each window to 35 weeks, avoiding chunking in most cases
- Shares data across adjacent trades for the same symbol
- Produces a cache-friendly pattern (consecutive trades for the same symbol share the same fetch)
- Works correctly with or without the backend chunking fix

#### Option D: Shared data pre-fetch (most reusable)

Fetch all needed data for all symbols up front into a shared in-memory store (or SQLite file), keyed by `(symbol, date_range)`. The simulation reads from this store instead of making API calls during simulation.

| | |
|---|---|
| **API calls** | Same as Option C (one per symbol per window) |
| **Data volume** | Same as Option C |
| **Correctness** | Same as Option C |
| **Reuse** | High — the cached data persists across runs, enabling rapid iteration on SL/TP parameters without re-fetching |
| **Complexity** | Higher — requires a persistence layer (SQLite or JSON file), cache invalidation logic, and a two-phase workflow (fetch → simulate) |
| **Best for** | Iterative analysis — when running many parameter combinations against the same historical period |

This is valuable when running many SL/TP parameter sweeps (e.g., SL=20/25/30 × TP=50/60/80/120/160/200). With 18 parameter combinations, Option D pays for itself after the second sweep because the data is fetched once and reused.

### Remaining issues (not yet fixed)

1. **Mid-bar entry skip**: When entry occurs mid-bar, the entry bar is skipped entirely. SL/TP checks don't run on the entry bar.
2. **Fallback exit at last bar close**: When neither SL nor TP is hit within `max_bars` bars, the simulation uses the last bar's close as exit (3 occurrences in full history). This can produce spurious results.
3. **1 ambiguous bar**: 1 trade had both SL and TP hit in the same bar (conservative mode resolved to SL).

---

## Backend Context

| Component | Detail |
|---|---|
| File | `services/tick-backend/CTraderDataProcessor.js` |
| Range limit (M15) | 21168000000 ms = 35 weeks |
| Range limit (H1) | 21168000000 ms = 35 weeks |
| Range limit (D1) | 31622400000 ms = 1 year |
| Chunking logic | **Fixed**: advances from chunk boundary (`chunkEnd`), not last bar timestamp |
