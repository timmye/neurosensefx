# Backtester

Walk-forward SL/TP analyzer that tests alternative stop-loss/take-profit parameters against real historical OHLC data from the cTrader backend.

## Overview

Reads a trade log (CSV/XLSX/TSV) of historical trades, fetches OHLC candle data from the running tick-backend, and simulates what would have happened with different SL/TP settings. Supports single-parameter analysis and grid-sweep mode for exploring parameter ranges.

## Prerequisites

- Python 3.10+ (for `zoneinfo` module)
- Running tick-backend (`./run.sh start`)
- PostgreSQL and Redis running

### Python Dependencies

```bash
pip install -r backtester/requirements.txt
```

Packages: pandas, matplotlib, openpyxl, requests

## Usage

Run from the project root with the backend running:

```bash
# Single SL/TP test
python backtester/sl_tp_analyzer.py backtester/data/20260430_full_history.csv \
    --sl 25 --tp 60 --timeframe 15m --backend http://localhost:8080

# Grid sweep (multiple SL and TP values)
python backtester/sl_tp_analyzer.py backtester/data/20260430_full_history.csv \
    --sl-range 20,25,30,40 --tp-range 40,60,90,120 --timeframe 15m

# Per-pair SL overrides (FX pairs use adaptive SL based on ADR)
python backtester/sl_tp_analyzer.py backtester/data/20260430_full_history.csv \
    --sl 25 --tp 60 --sl-map backtester/data/sl_by_pair.txt --timeframe 15m

# FX pairs only (skip metals, oil, indices)
python backtester/sl_tp_analyzer.py backtester/data/20260430_full_history.csv \
    --sl 25 --tp 60 --timeframe 15m --fx-only
```

### CLI Reference

| Argument | Description | Default |
|----------|-------------|---------|
| `trade_log` | Path to trade log (CSV/XLSX/TSV) | — |
| `--sl` | Stop-loss in pips | — |
| `--tp` | Take-profit in pips | — |
| `--sl-range` | Comma-separated SL values for grid sweep | — |
| `--tp-range` | Comma-separated TP values for grid sweep | — |
| `--timeframe` | OHLC timeframe (5m, 15m, 30m, 1h, 1d) | 15m |
| `--mode` | Exit mode: conservative, neutral, aggressive | conservative |
| `--sl-map` | Per-pair SL override file | — |
| `--fx-only` | Process FX pairs only | off |
| `--backend` | cTrader backend URL | http://localhost:8080 |
| `--max-bars` | Max OHLC bars per trade | 2000 (intraday) / 60 (daily) |
| `--n-trades` | Limit number of trades to analyze | all |
| `--output` | Output directory for results | backtester/results/ |
| `--no-chart` | Skip chart generation | off |
| `--no-csv` | Skip CSV export | off |

## Input Format

Trade log must contain columns: Open Time, Symbol, Type/Direction, Open Price, Close Time, Close Price. See `data/20260430_full_history.csv` for reference.

## Output

Results (cumulative P/L chart, per-trade CSV, summary chart) are saved to `backtester/results/`. Grid sweeps produce a master comparison CSV.

## Directory Structure

```
backtester/
  README.md                  # This file
  requirements.txt           # Python dependencies
  sl_tp_analyzer.py          # Main analyzer (walk-forward simulation engine)
  debug_trade_35.py          # Standalone debug script for trade #35 bar-by-bar analysis
  debug_trade35_trace.py     # Step-by-step trace of simulate_trades() logic
  data/
    20260430_full_history.csv    # Historical trade log from cTrader
    sl_by_pair.txt               # Per-pair SL pip overrides (FX pairs)
    reference_daily_ADR_fxpairs.txt       # ADR reference table for FX pairs
    reference_daily_ADR_percent_stops.txt # ADR with percentage-based stop references
    sl_tp_analyzer_debug.md      # Debug usage notes
  docs/
    bugs.md                    # Bug analysis (chunked OHLC gaps, mid-bar skip, fallback exit)
    range-sweep-plan.md        # Grid-sweep feature implementation plan
  results/                   # Generated output (charts, CSVs) — gitignored
```

## Known Issues

Documented in `docs/bugs.md`:
- Mid-bar entry skip: SL/TP checks skipped on entry bar (bar count off by 1)
- Fallback exit at last bar close: unrealistic P/L when SL/TP not hit within max_bars
- Naive CSV timestamps assumed UTC (add `--broker-tz` if your broker uses local time)
