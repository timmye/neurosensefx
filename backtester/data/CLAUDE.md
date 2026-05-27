# backtester/data/

Input data for SL/TP walk-forward backtester — historical trade logs, ADR references, and SL overrides.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `20260430_full_history.csv` | Full historical OHLCV data (daily, all pairs) | Running backtester simulations |
| `reference_daily_ADR_fxpairs.txt` | Daily ADR reference values per FX pair | Tuning SL/TP distances against historical ADR |
| `reference_daily_ADR_percent_stops.txt` | Percentage-based stop reference data | Calibrating percentage-based stops |
| `sl_by_pair.txt` | Per-pair SL override configuration | Setting custom SL values per pair |
| `sl_tp_analyzer_debug.md` | Backtester debug notes and findings | Debugging backtester results |
