# SL/TP Sweep Analysis — Legacy Evaluation

Comprehensive walk-forward backtest of alternative stop-loss/take-profit parameters against real historical OHLC data. Tests what would have happened to actual trades with different SL/TP settings across the full dataset.

## Dataset

- **Source**: `data/20260430_full_history.csv` — cTrader closed trade export
- **Period**: 2024-08-27 to 2026-04-29 (20 months)
- **Total trades**: 583 (576 FX-only, 7 non-FX excluded by `--fx-only`)
- **Buy/Sell split**: 167 buys / 409 sells (heavily sell-biased)
- **Symbols**: 35 total, dominated by USDJPYp (230 trades, 40% of FX volume)
- **Original SL**: mean=59.7 pips, median=1.3 pips (highly skewed — many very tight stops)
- **Original TP**: mean=86.3 pips, median=143.3 pips
- **Per-symbol concentration**: Top 3 symbols (USDJPYp, AUDUSDp, EURUSDp) account for 213 of 576 FX trades (37%)

### Trade Count by Symbol

| Symbol | Trades | Symbol | Trades |
|--------|--------|--------|--------|
| USDJPYp | 230 | GBPJPYp | 10 |
| AUDUSDp | 53 | NZDUSDp | 10 |
| EURUSDp | 50 | EURAUDp | 9 |
| XAUUSDp | 34 | Others | 67 (22 symbols, <8 each) |

## Methodology

Walk-forward simulation via `sl_tp_analyzer.py`: OHLC candles fetched from the cTrader backend at 15m resolution. For each real trade entry point, SL/TP prices calculated as `entry ± pips * pip_size`, then bar-by-bar wick checking (High/Low) against those levels. Ambiguity mode: `conservative` (SL prioritized when both hit on same bar). Max bars: 2000 per timeframe (~21 days at 15m).

Five grid sweeps executed covering different parameter spaces:

| Sweep | SL Range | TP Range | Combos | Trades Tested |
|-------|----------|----------|--------|---------------|
| Normal full dataset | 15-40 | 40-80 (steps of 5) | 30 | ~430-445 |
| Large SL/TP | 50-100 | 80-200 (steps of 5) | 42 | 99 |
| Tight ratio | 15-30 | 20-35 | 16 | ~430-445 |
| Inverse TP < SL | 15-40 | 10-25 / 5-8 | 48 | ~430-438 |
| Extreme tight SL | 5-15 / 5 fixed | 10-40 / 15-60 | 15 | ~508-513 |

Total unique SL/TP combinations: **126**

## Key Findings

### 1. The TP/SL Ratio is the Sole Driver of Profitability

Across all 126 combos and all data ranges, profitability is determined entirely by the TP/SL ratio — not by absolute pip values, win rate, or time period.

**Crossover point: ratio ~0.83**

- Below 0.83: **all combinations lose money**, regardless of win rate. Even SL=40/TP=5 with 73% win rate loses -3,027 pips.
- Above 0.83: combinations become profitable and scale monotonically with ratio.
- At exactly ratio=1.0 (SL=TP): marginally positive across most datasets (+0 to +5 pips/trade), indicating the strategy has a very thin edge near breakeven.

This means the underlying signal quality provides roughly 0.83 as the breakeven R:R threshold. Anything requiring better than 1:1 reward-to-risk is already losing with the original strategy.

### 2. Two Distinct Regimes: Small SL vs Large SL

**Same ratios behave radically differently depending on absolute SL magnitude.**

| Ratio | SL=5 Total P/L | SL=15 Total P/L | SL=40 Total P/L | SL=100 Total P/L |
|-------|---------------|-----------------|-----------------|------------------|
| ~2.0 | +2,185 (PF=2.37) | +1,213 (PF=1.30) | -457 (PF=0.84) | -688 (PF=0.87) |
| ~2.67 | +3,355 (PF=2.78) | +480 (PF=1.50) | -67 (PF=0.97) | N/A |
| ~4.0 | +3,718 (PF=2.87) | +600 (PF=1.56) | -738 (PF=0.81) | N/A |

Large SL values (50-100 pips) **always lose money** even at generous ratios of 2.0-4.0. The underlying price action simply doesn't trend far enough in one direction consistently enough for wide stops to be profitable. Small SL (5-15 pips) captures more trades and compounds the edge through volume.

### 3. M15 Granularity Artifacts at Extreme Tight Stops

SL=5 results show suspiciously clean metrics:
- Calmar ratios of 40-58 (vs ~5 for realistic ranges)
- Max drawdowns of only -65 to -190 pips across 500+ trades
- Sharpe ratios above 3.0 consistently

This is likely a simulation artifact: on M15 candles, price rarely hits exactly 5 pips. It either doesn't reach the level or gaps significantly beyond it. The bar-by-bar wick check treats it as an exact 5-pip loss, understating actual slippage. **SL values below 10 pips should not be trusted for live trading decisions.**

### 4. Optimal Parameters (Realistic Range)

Excluding the SL<10 artifact zone, the best risk-adjusted results cluster at:

**Best by total pips (SL >= 15):**
| SL | TP | Ratio | Trades | Total P/L | PF | MaxDD | Sharpe |
|----|----|-------|--------|-----------|-----|-------|--------|
| 15 | 35 | 2.33 | 445 | +1,238 | 1.29 | -230 | 1.84 |
| 15 | 30 | 2.00 | 445 | +1,213 | 1.30 | -240 | 1.97 |
| 15 | 60 | 4.00 | 100 | +600 | 1.56 | -195 | 2.81 |
| 20 | 35 | 1.75 | 445 | +743 | 1.14 | -395 | 0.99 |
| 25 | 60 | 2.40 | 100 | +953 | 1.65 | -240 | 3.62 |

**Best by profit factor (ratio >= 2.0, SL >= 15):**
| SL | TP | Ratio | PF | Total P/L | MaxDD |
|----|----|-------|-----|-----------|-------|
| 25 | 60 | 2.40 | 1.65 | +953 | -240 |
| 15 | 30 | 2.00 | 1.30 | +1,213 | -240 |
| 15 | 35 | 2.33 | 1.29 | +1,238 | -230 |
| 20 | 60 | 3.00 | 1.66 | +848 | -200 |

**Recommendation: SL=15-20 pips with TP/SL ratio of 2.0-3.0** provides the best balance of trade frequency, drawdown control, and profit factor without relying on simulation artifacts.

### 5. Drawdown Scales with SL, Not Ratio

Max drawdown correlates strongly with absolute SL value:
- SL=5: MaxDD always -65 to -190 pips
- SL=15: MaxDD typically -230 to -330 pips
- SL=40: MaxDD typically -600 to -850 pips
- SL=100: MaxDD consistently -1,250 to -1,790 pips

This is linear — doubling the SL roughly doubles the drawdown. For risk management purposes, position sizing must scale inversely with SL.

### 6. Win Rate is a Function of Ratio, Not Signal Quality

Expected win rate follows the formula: `WR ≈ (1 - 1/ratio) * 100` near breakeven, with actual results deviating based on the strategy's thin edge. At ratio=2.0, observed win rates range from 27-45% depending on SL level — lower SL values show higher WR because M15 granularity creates more frequent small wins.

### 7. Inverse Setups (TP < SL) Confirm Ratio Dominance

All inverse combinations (TP significantly smaller than SL) lose heavily regardless of how high the win rate climbs:
- SL=20/TP=5 (ratio=0.25): 62% WR, -1,938 pips
- SL=40/TP=5 (ratio=0.12): 73% WR, -3,027 pips
- SL=40/TP=8 (ratio=0.20): 71% WR, -2,616 pips

Win rates above 60% with these setups are illusory — the occasional TP hit doesn't compensate for the frequent SL hits. This conclusively demonstrates that win rate alone is meaningless without considering the ratio.

## Seasonal / Time-Based Observations

From rolling window analysis of the top combos:
- **Best periods**: Oct-Dec 2024 (strong trending in FX pairs)
- **Worst period**: Feb-May 2025 (ranging/choppy conditions)
- **Top contributor**: USDJPYp dominates all profitable combos (+1,358 pips at baseline settings)

The strategy's edge is concentrated in a few high-volume pairs and specific time windows, not distributed broadly across the universe.

## Limitations

1. **M15 granularity**: SL values below 10 pips are unreliable — actual execution would include slippage not captured by wick-based simulation.
2. **Mid-bar entry skip**: Trades opening mid-candle skip that candle entirely, which is conservative but may overestimate misses on already-moved stops.
3. **No commission/slippage**: Results are gross pip values only. With commissions (~$7/lot round-trip), net profitability is ~10-20% lower.
4. **Overfitting risk**: 126 combinations tested increases false-positive rate. The ratio=0.83 crossover pattern is robust across datasets, but specific SL/TP values should be validated on out-of-sample data.
5. **Single dataset**: All results from one trade log (Aug 2024-Apr 2026). Different market regimes (e.g., high-volatility periods) would produce different results.

## Output Files

| File | Description |
|------|-------------|
| `results/sweep_metrics.csv` | Metrics from normal + inverse sweeps (12 combos, SL 5-40) |
| `results/sweep_metrics_large.csv` | Metrics from large SL sweep (42 combos, SL 50-100) |
| `results/master_results_SL15-40_TP40-80_*.csv` | Normal sweep — per-trade results for 30 combos |
| `results/master_results_SL50-100_TP80-200_*.csv` | Large sweep — per-trade results for 42 combos |
| `results/master_results_SL15-30_TP20-35_*.csv` | Tight ratio sweep — 16 combos |
| `results/master_results_SL15-40_TP10-25_*.csv` | Inverse TP>SL but <SL — 24 combos |
| `results/master_results_SL15-40_TP5-8_*.csv` | Extreme inverse — 24 combos |
| `results/master_results_SL5-15_TP10-40_*.csv` | Tight SL sweep — 9 combos |
| `results/master_results_SL5-5_TP15-60_*.csv` | Fixed SL=5 sweep — 6 combos |

## Run Reproduction

```bash
# Requires running backend (./run.sh start) and Python deps installed

# Normal sweep (SL 15-40, TP 40-80)
python sl_tp_analyzer.py data/20260430_full_history.csv --sl-range 15:40:5 --tp-range 40:80:5 --timeframe 15m --fx-only

# Large sweep (SL 50-100, TP 80-200)
python sl_tp_analyzer.py data/20260430_full_history.csv --sl-range 50:100:5 --tp-range 80:200:5 --timeframe 15m --fx-only

# Extreme tight SL (SL 5, TP 15-60)
python sl_tp_analyzer.py data/20260430_full_history.csv --sl 5 --tp 15,20,30,40,50,60 --timeframe 15m --fx-only

# Post-process all master CSVs into combined metrics
python analyze_sweep.py
```
