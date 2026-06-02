# Backtester — SL/TP Walk-Forward Analyzer

Simulates what would have happened to your real historical trades if you used different stop-loss and take-profit settings. Runs walk-forward simulation against actual OHLC candle data from the cTrader backend (not replayed from the trade log).

## Prerequisites

- Python 3.10+ (requires `zoneinfo` module)
- Running tick-backend (`./run.sh start`), PostgreSQL, Redis

```bash
pip install -r backtester/requirements.txt
# pandas, matplotlib, openpyxl, requests
```

## Your Workflow

### 1. Get Your Trade Log

Export your closed trades from cTrader (CSV or XLSX). The file must contain: **Open Time**, **Symbol**, **Type** (Buy/Sell), **Open Price**, **Close Time**, **Close Price**. Optional columns — Lots, Commission, Swap, Profit — are used if present. The parser auto-detects delimiters and skips metadata header rows cTrader includes in its exports.

Save the file somewhere accessible (`backtester/data/` is conventional). This is your input: every row is a real trade that already happened.

### 2. Start the Backend

The script doesn't use canned price data — it fetches real historical OHLC candles from the running tick-backend for each trade. Without the backend, every trade will fail with "no data".

```bash
./run.sh start    # Starts tick-backend + PostgreSQL + Redis
```

### 3. Run a Baseline

Start with one SL/TP pair to verify your data looks correct before sweeping:

```bash
python backtester/sl_tp_analyzer.py backtester/data/20260430_full_history.csv \
    --sl 25 --tp 60 --timeframe 15m --fx-only --n-trades 50
```

`--n-trades 50` limits to your last 50 trades for a quick sanity check. `--fx-only` skips metals, oil, indices, crypto and the Dollar Index (DX). Look at the console output: do the trade dates look right? Are there "NODATA" results (means the backend doesn't have OHLC for those periods)? If everything checks out, run again without `--n-trades`.

### 4. Sweep Parameters

Once baseline looks good, explore what would have happened with different settings:

```bash
# Test 3 SL values × 3 TP values = 9 combinations in one run
python backtester/sl_tp_analyzer.py backtester/data/20260430_full_history.csv \
    --sl 20,25,30 --tp 40,50,60 --timeframe 15m --fx-only

# Wider sweep using range syntax (SL: 20–40 in steps of 5; TP: 40–80 in steps of 10)
python backtester/sl_tp_analyzer.py backtester/data/20260430_full_history.csv \
    --sl-range 20:40:5 --tp-range 40:80:10 --timeframe 15m --fx-only
```

OHLC data is cached across all SL/TP combinations — each symbol's data is fetched once and reused for every combo. A 9-combo sweep takes roughly the same time as a single run plus simulation overhead.

### 5. Read Your Results

**Console output** shows: win rate, expectancy (pips per trade), R:R ratio, profit factor, max win/loss streaks, per-symbol breakdown. The grid summary table ranks the top 10 combos by total pips so you can spot the best settings at a glance. For full details on all combos, check the master CSV.

**Charts** (`backtester/results/`): cumulative P/L curve shows the last simulated combo's path over time — not every strategy's performance. Grid sweeps additionally produce a summary bar chart comparing all combos side-by-side (positive pips = green, negative = red). The master CSV has per-trade results for every combo and is better for comparing individual trades.

**CSV files**: per-trade results (each trade's simulated outcome) and master comparison CSVs (wide format: one row per trade, columns for each SL×TP combo). Open in Excel or import to pandas for further analysis.

### 6. Iterate

Use what you learned — adjust SL/TP ranges, try a different timeframe (1h instead of 15m), add per-pair SL overrides from ADR analysis (`--sl-map data/sl_by_pair.txt`) — and run again until you find parameters that match your risk tolerance.

## CLI Reference

| Argument | Description | Default |
|----------|-------------|---------|
| `trade_log` | Path to trade log file (CSV/XLSX/TSV) | — |
| `--sl` | Stop-loss in pips. Single value or comma-separated (`20,25,30`). Default is `[25.0]` | 25 |
| `--tp` | Take-profit in pips. Single value or comma-separated (`40,50,60`). Default is `[40.0]` | 40 |
| `--sl-range` | SL grid sweep: `min:max:step` (e.g. `20:40:5`). Mutually exclusive with non-default `--sl`. | — |
| `--tp-range` | TP grid sweep: `min:max:step` (e.g. `40:80:10`). Mutually exclusive with non-default `--tp`. | — |
| `--timeframe` | OHLC candle interval for simulation | 1h |
| `--mode` | Ambiguity resolution when SL & TP hit in same bar | conservative |
| `--sl-map` | Per-pair SL override file (`SYMBOL=PIPS` format) | — |
| `--fx-only` | Process FX pairs only (skip metals, oil, indices, crypto) | off |
| `--n-trades` | Analyze only the last N trades | all |
| `--backend` | cTrader backend URL | http://localhost:8080 |
| `--max-bars` | Max OHLC bars to walk per trade | see Timeframe defaults |
| `--output` | Output directory for charts and CSVs | backtester/results/ |
| `--no-chart` | Skip PNG chart generation | off |
| `--no-csv` | Skip CSV export | off |
| `--inspect-trade <N>` | Show per-trade SL×TP outcome matrix across all combos for trade N (1-indexed). Produces output when multiple SL/TP combinations are active. | — |

### Timeframe & Max Bars

**Timeframe** sets candle resolution — SL/TP are checked against bar High/Low (wicks). Finer timeframes (5m, 15m) catch intrabar price spikes that coarser ones miss. Coarser timeframes (1h, 1d) may miss wicks that hit your stops between bar boundaries.

**Max bars** limits how many bars are walked per trade before fallback exit (last bar's close). Default max_bars × interval coverage:

| Timeframe | Max Bars | Simulation Coverage |
|-----------|----------|---------------------|
| 5m | 2000 | ~7 days |
| 15m | 2000 | ~21 days |
| 30m | 2000 | ~42 days |
| 1h | 500 | ~21 days |
| 1d | 60 | ~60 days |

Defaults cover 7–42 days of price action depending on timeframe (6.9 days at 5m, 21 days at 15m/1h, 42 days at 30m, 60 days at 1d). Most swing and intraday positions will have SL/TP hit within this window (fallback exit is rare). For ultra-long trends that don't trigger either, increase `--max-bars` — e.g. `--max-bars 8000` at 5m gives ~28 days. This also controls OHLC fetch window size per trade.

### Mode (Ambiguity Resolution)

When both SL and TP are hit on the same bar (wick hits one, opposite wick hits the other):

| Mode | Behavior |
|------|----------|
| `conservative` | Counts as loss (SL hits first) |
| `optimistic` | Counts as win (TP hits first) |
| `neutral` | EV split: `(TP_pips - SL_pips) / 2` |

### --inspect-trade Output

Prints a matrix showing each trade's outcome under every SL×TP combination:

```
  SL\TP     40      50      60      70      80
  20   +WIN+18  +WIN+20  -LOSS-20  -LOSS-20  -LOSS-20
  25   +WIN+23  +WIN+25  +WIN+25   -LOSS-25  -LOSS-25
  30   +WIN+28  +WIN+30  +WIN+30   +WIN+30   -LOSS-30
  ...
  Legend: +WIN  -LOSS  ~AMBIG  N/A=no data
```

## How the Simulation Works

For each real trade:

1. **Look up candles** from the backend at your chosen timeframe (5m, 15m, 1h etc.)
2. **Set SL/TP prices**: `entry ± pips × pip_size` (pip size varies by instrument)
3. **Walk forward candle-by-candle**, checking if any candle's wick (High/Low) touched SL or TP
4. **If both SL and TP hit in same bar**, ambiguity mode decides which counts; otherwise the first bar where either level is hit closes the trade
5. If neither is hit within `max_bars`, position exits at the last candle's close

**Caveats:** When entry occurs mid-candle, that candle is skipped to prevent look-ahead bias — a stop can't trigger on price action before your trade opened. Bar count is off by 1 for these trades. With defaults covering 7–42 days, most positions will have SL/TP hit within range. Fallback exit (last bar close) is rare — typically affects <1% of trades.

### Price Data Fetching

The script fetches real historical candles from your cTrader backend — it doesn't use built-in or hard-coded data. Trades are grouped by symbol and processed chronologically. For each batch of trades, it fetches 48 hours backfill plus up to `max_bars × interval` forward (~21 days at 15m/1h, ~60 days at 1d). The cTrader API limits each fetch to ~35 weeks — this rarely matters since default max_bars covers far less. Cached data is reused for adjacent trades on the same symbol. Typical full-history run: ~100 API calls across all symbols.

### Pip Size Per Instrument

Pip sizes are instrument-specific (defined in `PIP_SIZES` table):
- Major FX (EURUSD, GBPUSD…): 0.0001
- JPY pairs (EURJPY, USDJPY…): 0.01
- Gold (XAUUSD): 0.1
- Silver (XAGUSD): 0.01
- Oil (WTI, BRENT, USOIL, UKOIL): 0.01
- Indices (SPX500, US500…): 1.0
- Crypto (BTCUSD, ETHUSD): 1.0
- Dollar Index (DX): 0.01
- Unrecognized symbols use heuristic fallbacks: JPY→0.01, crypto→1.0, gold→0.1, oil→0.01, indices→1.0, default→0.0001

## Output

Single runs produce:
- **Console**: Full trade-by-trade table + summary metrics + per-symbol breakdown
- **PNG**: Cumulative pip P/L chart (`cumulative_pips_SL{sl}_TP{tp}_{tf}_{mode}_{ts}.png`)
- **CSV**: Per-trade simulation results (`simulation_results_*.csv`)

Grid sweeps additionally produce:
- **Console**: Top-N combo ranking table (sorted by total pips). Per-trade table shows only the last combo; use `--inspect-trade <N>` to drill into specific trades across all combos.
- **PNG**: Summary bar chart comparing all combos (`summary_chart_*.png`)
- **CSV**: Master comparison CSV — wide format with one row per trade, columns for each SL×TP combo (`master_results_*.csv`)

Filename pattern: single runs use `SL{value}_TP{value}`; grid sweeps use `SL{first}-{last}_TP{first}-{last}` (uses first/last values in order for comma-separated lists, min/max for range syntax). Timestamp is `%Y%m%d_%H%M%S`. All output saved to `backtester/results/` (or custom path via `--output`). Suppressed with `--no-chart` / `--no-csv`.

## Directory Structure

```
backtester/
  README.md                  # This file
  requirements.txt           # Python dependencies
  sl_tp_analyzer.py          # Main analyzer (simulation engine + CLI)
  debug_trade_35.py          # Standalone debug script for trade #35
  debug_trade35_trace.py     # Step-by-step trace of simulate_trades() logic
  data/
    20260430_full_history.csv    # Historical trade log from cTrader
    sl_by_pair.txt               # Per-pair SL pip overrides (FX pairs, ADR-based)
    reference_daily_ADR_fxpairs.txt       # Daily ADR reference table
    reference_daily_ADR_percent_stops.txt # ADR with percentage-based stop references
    sl_tp_analyzer_debug.md      # API endpoint docs, historical debug notes
  docs/
    bugs.md                    # Bug analysis (chunked OHLC gaps, mid-bar skip, fallback exit)
    range-sweep-plan.md        # Grid-sweep feature implementation plan (historical)
  results/                   # Generated output (charts, CSVs) — gitignored
```

## Known Issues

- **CSV timestamps assume UTC**: The trade log parser treats timestamps as naive datetime then applies UTC timezone. If your broker uses local time (e.g. EET), the OHLC lookup window may be offset. No CLI flag exists yet for broker timezone override.
- See "How the Simulation Works" caveats above for mid-bar entry skip and fallback exit behavior.
