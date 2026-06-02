#!/usr/bin/env python3
"""Deep analysis of backtester sweep results: time-based profitability, per-asset, per-combo."""

import sys, glob, os, re
import pandas as pd
import numpy as np

def load_master(csv_path):
    """Load master CSV and return df with parsed columns."""
    df = pd.read_csv(csv_path)

    # Parse combo names from columns
    combo_re = re.compile(r'(result|pips)_SL(\d+(?:\.\d+)?)_TP(\d+(?:\.\d+)?)')
    combos = {}
    for col in df.columns:
        if not col.startswith('pips_SL'): continue
        m = combo_re.match(col)
        if not m: continue
        sl, tp = m.group(2), m.group(3)
        key = f'SL={sl} TP={tp}'
        combos[key] = (col, col.replace('pips_', 'result_'))

    return df, combos

def compute_combo_metrics(df, pips_col, result_col):
    """Compute standard metrics for one combo."""
    res = df[result_col].astype(str).str.contains('win|loss', case=False, na=False)
    pip_s = pd.to_numeric(df[pips_col], errors='coerce')
    v_p = pip_s[res].fillna(0.0)
    if len(v_p) == 0: return None

    wins = v_p[v_p > 0]; losses = v_p[v_p < 0]
    n = len(v_p)
    eq = v_p.cumsum()
    rm = np.maximum.accumulate(eq)
    dd = (eq - rm).min()

    aw = wins.mean() if len(wins) else 0
    al = abs(losses.mean()) if len(losses) else 1

    return {
        'combo': '', 'trades': n, 'n_wins': len(wins), 'n_losses': len(losses),
        'win_rate': round(len(wins)/n*100, 1),
        'total_pips': round(v_p.sum(), 1),
        'expectancy': round(v_p.sum()/n, 2),
        'profit_factor': round((wins.sum() / abs(losses.sum())) if len(losses) > 0 and abs(losses.sum()) > 0 else 0, 2),
        'rr_ratio': round(aw/al if al > 0 else 0, 2),
        'max_drawdown': round(dd, 1),
        'calmar': round(abs(v_p.sum()/dd) if dd < -1 else 0, 2),
        'sharpe': round((v_p.mean()/v_p.std())*np.sqrt(252) if v_p.std() > 0 else 0, 2),
    }


def analyze_time_windows(df, pips_col):
    """Analyze profitability over rolling time windows (by trade date)."""
    res_col = pips_col.replace('pips_', 'result_')

    # Get dates
    if 'Open Time' in df.columns:
        df['_date'] = pd.to_datetime(df['Open Time'])
    else:
        return {}

    pip_s = pd.to_numeric(df[pips_col], errors='coerce').fillna(0.0)
    res_vals = df[res_col].astype(str).str.contains('win|loss', case=False, na=False)

    # Use all rows (including NODATA as 0 pips)
    v_p = pip_s.copy()
    eq = v_p.cumsum()
    dates = df['_date'].values

    # Rolling 10-trade windows
    window_size = min(10, len(v_p))
    rolling_metrics = []

    for i in range(window_size - 1, len(v_p)):
        start = max(0, i - window_size + 1)
        chunk = v_p.iloc[start:i+1]
        chunk_eq = eq.iloc[i] - (eq.iloc[start-1] if start > 0 else 0)
        wins_in_chunk = (chunk > 0).sum()

        rolling_metrics.append({
            'end_date': pd.Timestamp(dates[i]),
            'cumulative_pips': round(eq.iloc[i], 1),
            'window_pips': round(chunk_eq, 1),
            'window_trades': len(chunk),
            'window_wins': int(wins_in_chunk),
        })

    return pd.DataFrame(rolling_metrics)


def analyze_per_symbol(df, pips_col, result_col):
    """Analyze profitability per symbol for one combo."""
    pip_s = pd.to_numeric(df[pips_col], errors='coerce')
    res_vals = df[result_col].astype(str)

    symbols = df['Symbol'].unique()
    results = []

    for sym in sorted(symbols):
        mask = df['Symbol'] == sym
        v_p = pip_s[mask].fillna(0.0)
        valid = res_vals[mask].str.contains('win|loss', case=False, na=False)
        v_p_v = v_p[valid]

        if len(v_p_v) == 0: continue

        wins = v_p_v[v_p_v > 0]; losses = v_p_v[v_p_v < 0]
        eq = v_p_v.cumsum()
        dd = (eq - np.maximum.accumulate(eq)).min()

        results.append({
            'symbol': sym, 'trades': len(v_p_v), 'win_rate': round(len(wins)/len(v_p_v)*100, 1),
            'total_pips': round(v_p_v.sum(), 1),
            'max_drawdown': round(dd, 1),
        })

    return pd.DataFrame(results)


def find_profitable_periods(df, pips_col, result_col):
    """Find contiguous periods of profitability for a combo."""
    res = df[result_col].astype(str).str.contains('win|loss', case=False, na=False)
    pip_s = pd.to_numeric(df[pips_col], errors='coerce')

    # Use only decisive trades
    dates = pd.to_datetime(df['Open Time'])[res]
    v_p = pip_s[res].fillna(0.0).values

    eq = np.cumsum(v_p)

    # Find rolling 20-trade window metrics
    period_results = []
    win_size = 20

    for i in range(win_size - 1, len(v_p)):
        start = i - win_size + 1
        chunk_eq = eq[i] - (eq[start-1] if start > 0 else 0)
        chunk_pips = v_p[start:i+1]

        period_results.append({
            'end_idx': i,
            'start_date': str(dates.iloc[start])[:10],
            'end_date': str(dates.iloc[i])[:10],
            'window_pips': round(chunk_eq, 1),
            'window_trades': win_size,
            'window_wins': int((chunk_pips > 0).sum()),
        })

    return pd.DataFrame(period_results)


def main():
    results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results')
    master_files = sorted(glob.glob(os.path.join(results_dir, 'master_results_*.csv')))

    if not master_files:
        print("No master CSV found.")
        sys.exit(1)

    # Use the latest sweep (SMALL one has more data to analyze - it was run on full set by now)
    master_file = max(master_files, key=os.path.getmtime)
    basename = os.path.basename(master_file)
    print(f"Analyzing: {basename}")
    print()

    df, combos = load_master(master_file)

    if 'SL15-40' in basename:
        sweep_name = "Small (SL 15-40 / TP 40-80)"
    elif 'SL50-100' in basename:
        sweep_name = "Large (SL 50-100 / TP 80-200)"
    else:
        sweep_name = f"Sweep ({basename})"

    print(f"Sweep: {sweep_name}")
    print(f"Trades in dataset: {len(df)}")
    print(f"Date range: {str(df['Open Time'].iloc[0])[:10]} to {str(df['Open Time'].iloc[-1])[:10]}")
    print()

    # 1. Per-combo metrics sorted by total pips
    print("=" * 80)
    print("ALL COMBOS RANKED BY TOTAL PIPS")
    print("=" * 80)

    all_combo_metrics = []
    for combo_key, (pips_col, result_col) in combos.items():
        if result_col not in df.columns: continue
        m = compute_combo_metrics(df, pips_col, result_col)
        if m:
            m['combo'] = combo_key
            all_combo_metrics.append(m)

    metrics_df = pd.DataFrame(all_combo_metrics).sort_values('total_pips', ascending=False).reset_index(drop=True)

    print(f"{metrics_df[['combo','trades','win_rate','total_pips','expectancy','profit_factor','rr_ratio','max_drawdown','sharpe']].to_string(index=False, float_format='%.1f')}")

    # 2. Time-window analysis for top 5 combos
    print("\n" + "=" * 80)
    print("TOP 5 COMBOS: TIME-BASED PROFITABILITY (rolling 20-trade windows)")
    print("=" * 80)

    top5 = metrics_df.head(5)['combo'].tolist()

    for combo_key in top5:
        pips_col, result_col = combos[combo_key]
        periods = find_profitable_periods(df, pips_col, result_col)

        if len(periods) == 0: continue

        # Find best and worst windows
        best_idx = periods['window_pips'].idxmax()
        worst_idx = periods['window_pips'].idxmin()

        pos_windows = len(periods[periods['window_pips'] > 0])
        neg_windows = len(periods[periods['window_pips'] < 0])

        print(f"\n  {combo_key}:")
        print(f"    Best window:   +{periods.loc[best_idx]['window_pips']} pips ({periods.loc[best_idx]['start_date']} to {periods.loc[best_idx]['end_date']})")
        print(f"    Worst window:  {periods.loc[worst_idx]['window_pips']:+.1f} pips ({periods.loc[worst_idx]['start_date']} to {periods.loc[worst_idx]['end_date']})")
        print(f"    Positive windows: {pos_windows}/{len(periods)} ({pos_windows/len(periods)*100:.0f}%)")

        # Find the longest profitable streak (cumulative going up)
        cum_pips = pd.to_numeric(df[pips_col], errors='coerce').fillna(0.0)
        res_mask = df[result_col].astype(str).str.contains('win|loss', case=False, na=False)
        v_p = cum_pips[res_mask].fillna(0.0).values
        dates = pd.to_datetime(df['Open Time'])[res_mask]
        eq = np.cumsum(v_p)

        # Find max drawdown period (peak to trough)
        running_max = np.maximum.accumulate(eq)
        drawdown = eq - running_max
        dd_ends = np.where(np.abs(drawdown) == np.maximum.accumulate(np.abs(drawdown)))[0]

        if len(dd_ends) > 0:
            worst_dd_end = dd_ends[-1]
            # Find the peak before this trough
            peak_before = np.argmax(eq[:worst_dd_end+1])
            print(f"    Max DD period: {eq[peak_before]:+.1f} -> {eq[worst_dd_end]:+.1f} ({dd_ends[-1]:.0f} pips) from trade {peak_before+1} to {worst_dd_end+1}")

    # 3. Per-symbol analysis for top combo
    print("\n" + "=" * 80)
    print("PER-ASSET ANALYSIS (Top 5 combos)")
    print("=" * 80)

    for combo_key in top5:
        pips_col, result_col = combos[combo_key]
        sym_metrics = analyze_per_symbol(df, pips_col, result_col)

        print(f"\n  {combo_key}:")
        # Sort by pips desc
        sym_sorted = sym_metrics.sort_values('total_pips', ascending=False)
        for _, r in sym_sorted.iterrows():
            bar = "+" if r['total_pips'] > 0 else " " if r['total_pips'] == 0 else "-"
            print(f"    {r['symbol']:12s} {bar}{r['trades']:>3} trades  {r['win_rate']:5.1f}% win  {r['total_pips']:+7.1f} pips  DD:{r['max_drawdown']:+.0f}")

    # 4. Cumulative equity curve for top combo (show key turning points)
    print("\n" + "=" * 80)
    print("TOP COMBO CUMULATIVE P/L: KEY TURNING POINTS")
    print("=" * 80)

    top_combo = metrics_df.iloc[0]['combo']
    pips_col, result_col = combos[top_combo]

    v_p_all = pd.to_numeric(df[pips_col], errors='coerce').fillna(0.0)
    res_mask_all = df[result_col].astype(str).str.contains('win|loss', case=False, na=False)
    v_p = v_p_all[res_mask_all].fillna(0.0).values
    dates_all = np.asarray(pd.to_datetime(df['Open Time'])[res_mask_all])
    symbols_all = df['Symbol'].loc[res_mask_all].values

    eq = np.cumsum(v_p)

    # Find equity curve milestones
    eq_arr = np.asarray(eq)  # ensure numpy array for integer indexing
    print(f"\n  {top_combo} - Cumulative P/L over time:")
    print(f"    Start: {eq_arr[0]:+.1f}")
    for milestone_pct in [25, 50, 75]:
        idx = int(len(eq_arr) * milestone_pct / 100)
        if idx < len(eq_arr):
            d_str = str(dates_all[idx])[:10] if hasattr(dates_all, '__getitem__') else str(dates_all[int(idx)])[:10]
            print(f"    Quarter {milestone_pct}%: {eq_arr[idx]:+.1f} pips (trade #{idx+1}, {d_str})")

    eq_arr = np.asarray(eq)
    peak_idx = int(np.argmax(eq_arr))
    trough_after_peak = int(np.argmin(eq_arr[peak_idx:]) + peak_idx)
    final_val = float(eq_arr[-1])

    peak_date = str(dates_all[peak_idx])[:10] if hasattr(dates_all, '__getitem__') else 'n/a'
    trough_date = str(dates_all[trough_after_peak])[:10] if hasattr(dates_all, '__getitem__') and trough_after_peak < len(dates_all) else 'n/a'

    print(f"    Peak equity:     {eq_arr[peak_idx]:+.1f} pips (trade #{peak_idx+1}, {peak_date})")
    if trough_after_peak > peak_idx:
        print(f"    Post-peak trough:{eq_arr[trough_after_peak]:+.1f} pips (trade #{trough_after_peak+1}, {trough_date})")
    print(f"    Final equity:    {final_val:+.1f} pips ({len(eq_arr)} decisive trades)")

    # 5. What happens at different times of year?
    print("\n" + "=" * 80)
    print("SEASONAL ANALYSIS (Top combo, by month)")
    print("=" * 80)

    top_combo_pips = pd.to_numeric(df[pips_col], errors='coerce').fillna(0.0)
    df['_month'] = pd.to_datetime(df['Open Time']).dt.month

    for combo_key in top5[:3]:
        pips_col, result_col = combos[combo_key]
        tp_s = pd.to_numeric(df[pips_col], errors='coerce').fillna(0.0)
        res_mask = df[result_col].astype(str).str.contains('win|loss', case=False, na=False)

        monthly = pd.DataFrame({
            'month': df['_month'][res_mask],
            'pips': tp_s[res_mask]
        })

        print(f"\n  {combo_key}:")
        for month in range(1, 13):
            sub = monthly[monthly['month'] == month]
            if len(sub) == 0: continue
            m_pips = sub['pips'].sum()
            m_wins = (sub['pips'] > 0).sum()
            m_name = pd.Timestamp(year=2025, month=month, day=1).strftime('%b')
            print(f"    {m_name:>4s}: {len(sub):>2} trades, {m_wins}/{len(sub)} wins, {m_pips:+7.1f} pips")


if __name__ == '__main__':
    main()
