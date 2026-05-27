# Multi-SL/TP Range Analysis

## Scope

Extend `scripts/sl_tp_analyzer.py` to accept SL/TP ranges and run a grid sweep, producing a wide-format master CSV, a summary bar chart, and a console summary of top combos.

## Files Changed

- `scripts/sl_tp_analyzer.py` — all changes in one file

## Implementation Steps

### 1. Add `parse_value_list` helper (insert after line 104)

```python
def parse_value_list(val):
    """Parse '25' into [25.0] or '20,30,40' into [20.0, 30.0, 40.0]."""
    return [float(p.strip()) for p in str(val).split(",")]
```

### 2. Update CLI args (replace lines 826-844)

- Change `--sl` and `--tp` to use `type=parse_value_list`, default `[25.0]` and `[40.0]`
- Add `--sl-range` (min:max:step), `--tp-range`, `--inspect-trade`

### 3. Add validation after `args = parser.parse_args()` (after line 846)

- Check for conflicting `--sl-range` / `--sl` usage
- Parse range strings into explicit lists
- Print grid size info

### 4. Update info print block (lines 848-856)

- Show SL/TP lists for range mode, single values for backward compat

### 5. Replace single simulation with double loop (lines 906-908)

```python
all_combination_results = {}
ohlc_cache.clear()
for sl_val in sl_values:
    for tp_val in tp_values:
        results, metrics = simulate_trades(trades, sl_val, tp_val, args.timeframe, args.mode, args.backend, sl_map)
        all_combination_results[(sl_val, tp_val)] = (results, metrics)
```

### 6. Add `save_master_csv()` function (after line 793)

Wide-format DataFrame: rows = trades, columns = result_SLx_TP and pips_SLx_TP per combo.

### 7. Add `plot_summary_chart()` function (after line 771)

Bar chart of total net pips per (SL, TP) combination.

### 8. Add `print_grid_summary()` function (after line 735)

Console table: top N combos by total pips.

### 9. Add `inspect_trade_grid()` function (after new function)

Per-trade SL x TP grid showing outcome per combo.

### 10. Wire outputs in main() (lines 911-924)

- Call `print_grid_summary()` for range mode
- Save master CSV for range mode
- Save summary chart for range mode
- Call `inspect_trade_grid()` if `--inspect-trade` given

## Backward Compatibility

- `--sl 25 --tp 40` → single combo, identical output
- `--sl 20,30,40 --tp 30,50,70` → 3x3 grid (new)
- `--sl-range 20:40:5 --tp-range 30:80:10` → 5x6 grid (new)
