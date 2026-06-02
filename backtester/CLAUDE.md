# Backtester

Walk-forward SL/TP analyzer that tests alternative stop-loss/take-profit parameters against real historical OHLC data from the cTrader backend.

See `README.md` for complete usage guide, CLI reference, simulation engine details, and known issues.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `README.md` | Complete usage guide, CLI reference, simulation logic, known issues | Onboarding to backtester, understanding workflow |
| `requirements.txt` | Python dependencies (pandas, matplotlib, openpyxl, requests) | Setting up backtester environment |
| `sl_tp_analyzer.py` | Walk-forward simulation engine, OHLC fetcher, charting, CSV output | Modifying simulation logic, adding features |
| `debug_trade_35.py` | Standalone debug script for trade #35 bar-by-bar analysis | Root-causing trade #35 issues |
| `debug_trade35_trace.py` | Step-by-step trace of simulate_trades() logic for trade #35 | Debugging timezone and OHLC alignment bugs |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `data/` | Input data (historical trade logs, ADR references, SL overrides) | Preparing backtester inputs |
| `docs/` | Backtester bug analysis and implementation plans | Understanding known issues, planning features |
| `results/` | Backtester output files (simulation results, cumulative P/L charts) — gitignored | Reviewing backtester output, comparing simulation runs |

## Key Architecture

- **OHLC fetching**: Per-symbol forward windows (~35 weeks each), cached across combos. Trades sorted chronologically per symbol; `cached_df` reused when next trade's entry falls within already-fetched data.
- **Simulation**: Bar-by-bar wick checking (High/Low) against SL/TP prices. Mid-bar entries skipped to avoid look-ahead bias. Fallback: last bar close if neither hit within max_bars.
- **Grid sweep**: `--sl` and `--tp` accept comma-separated lists. `--sl-range`/`--tp-range` use `min:max:step` syntax. OHLC cache shared across all combinations.
