#!/usr/bin/env python3
"""Post-process backtester master CSV to compute portfolio metrics for each SL/TP combo."""

import sys, glob, os, re
import pandas as pd
import numpy as np


def compute_drawdown(equity_curve):
    """Peak-to-trough max drawdown in pips."""
    running_max = np.maximum.accumulate(equity_curve)
    drawdown = equity_curve - running_max
    return drawdown.min()


def analyze_combo(df, pips_col, result_col):
    """Compute all portfolio metrics for a single combo."""
    results = df[result_col].astype(str)
    pips_series = pd.to_numeric(df[pips_col], errors='coerce')

    # Filter out N/A or no-data trades
    valid_mask = results.str.contains('win|loss', case=False, na=False)
    v_results = results[valid_mask]
    v_pips = pips_series[valid_mask].fillna(0.0)

    if len(v_pips) == 0:
        return None

    wins = v_pips[v_pips > 0]
    losses = v_pips[v_pips < 0]

    total_trades = len(v_pips)
    n_wins = len(wins)
    n_losses = len(losses)
    win_rate = n_wins / total_trades * 100
    total_pips = v_pips.sum()
    expectancy = total_pips / total_trades

    avg_win = wins.mean() if len(wins) > 0 else 0.0
    avg_loss = abs(losses.mean()) if len(losses) > 0 else 1.0

    gross_profit = wins.sum() if len(wins) > 0 else 0.0
    gross_loss = abs(losses.sum()) if len(losses) > 0 else 1.0
    profit_factor = gross_profit / gross_loss

    # Expectancy ratio: expectancy / avg loss magnitude
    expectancy_ratio = expectancy / avg_loss if avg_loss > 0 else 0.0

    # R:R
    rr_ratio = avg_win / avg_loss if avg_loss > 0 else 0.0

    # Drawdown from cumulative equity curve
    eq_curve = v_pips.cumsum()
    max_dd = compute_drawdown(eq_curve)

    # Calmar ratio
    calmar = abs(total_pips / max_dd) if max_dd < -1 else 0.0

    # Annualized Sharpe-like (assuming ~252 trading days worth of data)
    pip_std = v_pips.std()
    sharpe = (expectancy / pip_std) * np.sqrt(252) if pip_std > 0 else 0.0

    # Sortino
    downside = v_pips[v_pips < 0]
    downside_std = downside.std(ddof=1) if len(downside) > 1 else 0.0
    sortino = (expectancy / downside_std) * np.sqrt(252) if downside_std > 0 else 0.0

    # Streaks
    max_win_streak = 0
    max_loss_streak = 0
    cur_ws = 0
    cur_ls = 0
    for pip in v_pips:
        if pip > 0:
            cur_ws += 1
            cur_ls = 0
            max_win_streak = max(max_win_streak, cur_ws)
        else:
            cur_ls += 1
            cur_ws = 0
            max_loss_streak = max(max_loss_streak, cur_ls)

    return {
        'combo': '',
        'total_trades': total_trades,
        'n_wins': n_wins,
        'n_losses': n_losses,
        'win_rate': round(win_rate, 1),
        'total_pips': round(total_pips, 1),
        'expectancy': round(expectancy, 2),
        'profit_factor': round(profit_factor, 2),
        'rr_ratio': round(rr_ratio, 2),
        'expectancy_ratio': round(expectancy_ratio, 2),
        'max_drawdown_pips': round(max_dd, 1),
        'calmar_ratio': round(calmar, 2),
        'sharpe_ratio': round(sharpe, 2),
        'sortino_ratio': round(sortino, 2),
        'max_win_streak': max_win_streak,
        'max_loss_streak': max_loss_streak,
    }


def main():
    results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results')
    master_files = sorted(glob.glob(os.path.join(results_dir, 'master_results_*.csv')))

    if not master_files:
        print("No master CSV found. Run a grid sweep first.")
        sys.exit(1)

    # Use the latest master CSV (by filename which includes timestamp)
    master_file = max(master_files, key=os.path.getmtime)
    basename = os.path.basename(master_file)
    print(f"Analyzing: {basename}")

    df = pd.read_csv(master_file)

    # Discover combos from column names: result_SL{val}_TP{val} and pips_SL{val}_TP{val}
    combo_re = re.compile(r'(result|pips)_SL(\d+(?:\.\d+)?)_TP(\d+(?:\.\d+)?)')
    combos = {}  # key "SL=X TP=Y" -> (pips_col, result_col)

    for col in df.columns:
        if not col.startswith('pips_SL'):
            continue
        # Extract SL and TP from column name like "pips_SL15_TP40"
        m = combo_re.match(col)
        if not m:
            continue
        sl_val = m.group(2)
        tp_val = m.group(3)
        key = f"SL={sl_val} TP={tp_val}"
        result_col = col.replace('pips_', 'result_')
        combos[key] = (col, result_col)

    print(f"Combos to analyze: {len(combos)}\n")

    all_metrics = []
    for combo_key, (pips_col, result_col) in combos.items():
        if result_col not in df.columns:
            continue
        m = analyze_combo(df, pips_col, result_col)
        if m:
            m['combo'] = combo_key
            all_metrics.append(m)

    if len(all_metrics) == 0:
        print(f"Available columns (first 30): {df.columns.tolist()[:30]}")
        sys.exit(1)

    metrics_df = pd.DataFrame(all_metrics)
    metrics_df = metrics_df.sort_values('total_pips', ascending=False).reset_index(drop=True)

    # Print table
    hdr = f"{'COMBO':<20} {'Tr':>4} {'Win%':>6} {'P/L':>8} {'Exp':>7} {'PF':>6} {'RR':>5} {'ExR':>5} {'MaxDD':>8} {'Calmar':>7} {'Sharpe':>7} {'Sortino':>8}"
    print("=" * len(hdr))
    print(hdr)
    print("=" * len(hdr))

    for _, row in metrics_df.iterrows():
        print(f"{row['combo']:<20} {row['total_trades']:>4} {row['win_rate']:>5.1f}% {row['total_pips']:>7.1f} {row['expectancy']:>7.2f} {row['profit_factor']:>6.2f} {row['rr_ratio']:>5.2f} {row['expectancy_ratio']:>5.2f} {row['max_drawdown_pips']:>8.1f} {row['calmar_ratio']:>7.2f} {row['sharpe_ratio']:>7.2f} {row['sortino_ratio']:>8.2f}")

    # Top 3
    print("\n" + "=" * 100)
    print("TOP 3 COMBINATIONS")
    print("=" * 100)

    for i, row in metrics_df.head(3).iterrows():
        r = row.to_dict()
        print(f"\n  #{i+1}: {r['combo']}")
        print(f"     Win Rate:       {r['win_rate']:.1f}% ({r['n_wins']}W / {r['n_losses']}L)")
        print(f"     Total P/L:      {r['total_pips']:.1f} pips over {r['total_trades']} trades")
        print(f"     Expectancy:     {r['expectancy']:.2f} pips/trade")
        print(f"     Profit Factor:  {r['profit_factor']:.2f}")
        print(f"     R:R Ratio:      1:{r['rr_ratio']:.2f}")
        print(f"     Exp. Ratio:     {r['expectancy_ratio']:.2f}  (expectancy / |avg_loss|)")
        print(f"     Max Drawdown:   {r['max_drawdown_pips']:.1f} pips")
        print(f"     Calmar Ratio:   {r['calmar_ratio']:.2f}  (total_pips / max_drawdown)")
        print(f"     Sharpe Ratio:   {r['sharpe_ratio']:.2f}  (annualized)")
        print(f"     Sortino Ratio:  {r['sortino_ratio']:.2f}  (annualized, downside only)")
        print(f"     Max Win Streak:  {r['max_win_streak']}")
        print(f"     Max Loss Streak: {r['max_loss_streak']}")

    # Save full metrics CSV
    out_path = os.path.join(os.path.dirname(master_file), 'sweep_metrics.csv')
    metrics_df.to_csv(out_path, index=False)
    print(f"\nFull metrics saved: {out_path}")


if __name__ == '__main__':
    main()
