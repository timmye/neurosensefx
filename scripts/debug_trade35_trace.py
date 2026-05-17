#!/usr/bin/env python3
"""
Trace the EXACT simulation logic for trade #35 to find the bug.
Reproduces the simulate_trades() path step by step.
"""

import requests
import pandas as pd
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BACKEND = "http://localhost:8080"
SYMBOL = "EURUSD"
RESOLUTION = "M15"  # cTrader uses M15, not 15m

# Trade #35 parameters
OPEN_TIME = datetime(2025, 5, 8, 9, 20)  # As parsed from CSV - NO timezone
OPEN_PRICE = 1.12881
CLOSE_PRICE = 1.12351
DIRECTION = "buy"
SL_PIPS = 25.0
TP_PIPS = 60.0
PIP_SIZE = 0.0001

# === STEP 1: Fetch OHLC ===
print("=" * 70)
print("STEP 1: Fetch OHLC data")
print("=" * 70)

# The analyzer fetches with 48h padding
start = OPEN_TIME - timedelta(hours=48)
end = OPEN_TIME + timedelta(hours=48)

print(f"Fetch range: {start} to {end}")
print(f"from_ts = {int(start.timestamp() * 1000)}")
print(f"to_ts = {int(end.timestamp() * 1000)}")

# The analyzer uses clean_symbol which strips 'p'
clean_symbol = SYMBOL.rstrip("p").replace(".f", "").replace(".F", "")
print(f"Clean symbol: {clean_symbol}")

params = {
    "symbol": clean_symbol,
    "resolution": "15m",  # analyzer passes "15m"
    "from": int(start.timestamp() * 1000),
    "to": int(end.timestamp() * 1000),
}

url = f"{BACKEND}/api/candles"
print(f"URL: {url}?symbol={clean_symbol}&resolution=15m&from={params['from']}&to={params['to']}")

resp = requests.get(url, params=params, timeout=30)
data = resp.json()
bars = data.get("bars", [])
print(f"Bars returned: {len(bars)}")

# === STEP 2: Build DataFrame (mimicking fetch_ohlc) ===
print()
print("=" * 70)
print("STEP 2: Build DataFrame")
print("=" * 70)

df = pd.DataFrame(bars)
df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
df = df.rename(columns={
    "open": "Open", "high": "High", "low": "Low", "close": "Close",
    "volume": "Volume"
})
df = df[["Open", "High", "Low", "Close", "timestamp"]].dropna()
df.index = df["timestamp"]

print(f"DataFrame index type: {type(df.index)}")
print(f"DataFrame index tz: {df.index.tz}")
print(f"First bar: {df.index[0]}")
print(f"Last bar: {df.index[-1]}")
print()

# === STEP 3: Prepare entry time (mimicking simulate_trades) ===
print("=" * 70)
print("STEP 3: Prepare entry time")
print("=" * 70)

entry_dt = OPEN_TIME
print(f"Original open_time from CSV: {entry_dt} (tzinfo={entry_dt.tzinfo})")

# Make tz-aware to match pandas UTC index
entry_dt = entry_dt.replace(tzinfo=ZoneInfo("UTC"))
print(f"After tz-aware conversion: {entry_dt} (tzinfo={entry_dt.tzinfo})")

entry_dt_normalized = entry_dt.replace(tzinfo=None)
print(f"entry_dt_normalized (no tz): {entry_dt_normalized}")

# === STEP 4: Calculate SL/TP ===
print()
print("=" * 70)
print("STEP 4: Calculate SL/TP")
print("=" * 70)

is_buy = DIRECTION == "buy"
sl_price = (OPEN_PRICE - SL_PIPS * PIP_SIZE) if is_buy else (OPEN_PRICE + SL_PIPS * PIP_SIZE)
tp_price = (OPEN_PRICE + TP_PIPS * PIP_SIZE) if is_buy else (OPEN_PRICE - TP_PIPS * PIP_SIZE)
print(f"SL price: {sl_price}")
print(f"TP price: {tp_price}")

# === STEP 5: Filter bars (mimicking simulate_trades) ===
print()
print("=" * 70)
print("STEP 5: Filter bars from entry time onward")
print("=" * 70)

print(f"Mask condition: df.index >= {entry_dt}")
mask = df.index >= entry_dt
future = df[mask].head(2000)

print(f"Bars after mask: {len(future)}")
print()
print("First 5 bars after mask:")
for i, (ts, row) in enumerate(future.head(5).iterrows()):
    print(f"  [{i}] ts={ts} Open={row['Open']:.5f} High={row['High']:.5f} Low={row['Low']:.5f} Close={row['Close']:.5f}")

# === STEP 6: Walk forward (mimicking simulate_trades loop) ===
print()
print("=" * 70)
print("STEP 6: Walk forward - SL/TP check per bar")
print("=" * 70)

for idx, (ts, row) in enumerate(future.iterrows()):
    bar_high = row["High"]
    bar_low = row["Low"]

    # Entry bar check
    if idx == 0:
        bar_open_ts = ts.to_pydatetime().replace(tzinfo=None)
        print(f"  idx=0: bar_open_ts={bar_open_ts}, entry_dt_normalized={entry_dt_normalized}")
        print(f"  bar_open_ts == entry_dt_normalized? {bar_open_ts == entry_dt_normalized}")
        if bar_open_ts != entry_dt_normalized:
            print(f"  => SKIPPING entry bar (mid-bar entry)")
            continue

    sl_hit = bar_low <= sl_price
    tp_hit = bar_high >= tp_price

    print(f"  idx={idx}: bar_ts={ts} High={bar_high:.5f} Low={bar_low:.5f}")
    print(f"    sl_hit (Low <= {sl_price:.5f})? {sl_hit}")
    print(f"    tp_hit (High >= {tp_price:.5f})? {tp_hit}")

    if sl_hit and tp_hit:
        print(f"    => AMBIGUOUS")
        break
    if sl_hit:
        print(f"    => SL HIT!")
        break
    if tp_hit:
        print(f"    => TP HIT!")
        break

    if idx >= 5:
        print(f"  ... (showing first 6 bars only)")
        break

# === STEP 7: Check what the actual simulation would produce ===
print()
print("=" * 70)
print("STEP 7: Full simulation result")
print("=" * 70)

sim_result = None
for idx, (ts, row) in enumerate(future.iterrows()):
    bar_high = row["High"]
    bar_low = row["Low"]

    if idx == 0:
        bar_open_ts = ts.to_pydatetime().replace(tzinfo=None)
        if entry_dt_normalized != bar_open_ts:
            continue

    sl_hit = bar_low <= sl_price
    tp_hit = bar_high >= tp_price

    if sl_hit and tp_hit:
        sim_result = {"result": "loss", "pips": -SL_PIPS, "exit": sl_price, "bars": idx + 1, "notes": f"Ambiguous bar {idx+1}"}
        break
    if sl_hit:
        sim_result = {"result": "loss", "pips": -SL_PIPS, "exit": sl_price, "bars": idx + 1, "notes": f"SL hit after {idx+1} bars"}
        break
    if tp_hit:
        sim_result = {"result": "win", "pips": TP_PIPS, "exit": tp_price, "bars": idx + 1, "notes": f"TP hit after {idx+1} bars"}
        break

if not sim_result:
    if len(future) > 0:
        last_bar = future.iloc[-1]
        exit_price = last_bar["Close"]
        sim_pips = ((exit_price - OPEN_PRICE) / PIP_SIZE)
        sim_result = {
            "result": "win" if sim_pips >= 0 else "loss",
            "pips": sim_pips,
            "exit": exit_price,
            "bars": len(future),
            "notes": f"Neither SL/TP in {len(future)} bars",
        }
    else:
        sim_result = {"result": "no_data", "pips": 0, "exit": CLOSE_PRICE, "bars": 0, "notes": "No data"}

print(f"Simulation result: {sim_result}")
print()
print(f"CSV says: WIN, +60.0 pips, exit 1.13481, TP hit after 2 bars")
print(f"Actual data says: {sim_result['result']}, {sim_result['pips']:+.1f} pips, exit {sim_result['exit']:.5f}, {sim_result['notes']}")

# === CRITICAL: Check the bar index matching ===
print()
print("=" * 70)
print("STEP 8: CRITICAL - Check bar index alignment")
print("=" * 70)

# The entry time is 09:20. The 15m bars are at 09:00, 09:15, 09:30, 09:45...
# df.index >= entry_dt (09:20) will include bars at 09:30, 09:45, ...
# But it will EXCLUDE bars at 09:00 and 09:15 (which are < 09:20)
# So the first bar in `future` is 09:30, not 09:15!

print("Bar index alignment analysis:")
print(f"  Entry time: {entry_dt} (09:20)")
print(f"  Mask: df.index >= entry_dt means bars at 09:30, 09:45, 09:50, ...")
print(f"  Bar at 09:15 is EXCLUDED because 09:15 < 09:20")
print()

# Show what the first few bars look like
print("First bars in 'future' (after mask):")
for i, (ts, row) in enumerate(future.head(4).iterrows()):
    bar_open_ts = ts.to_pydatetime().replace(tzinfo=None)
    print(f"  [{i}] ts={ts} bar_open={bar_open_ts} Open={row['Open']:.5f} High={row['High']:.5f} Low={row['Low']:.5f} Close={row['Close']:.5f}")
    if i == 0:
        print(f"      This is idx=0, bar_open={bar_open_ts}, entry_normalized={entry_dt_normalized}")
        print(f"      Are they equal? {bar_open_ts == entry_dt_normalized}")
        if bar_open_ts != entry_dt_normalized:
            print(f"      => Bar at {bar_open_ts.strftime('%H:%M')} != entry at {entry_dt_normalized.strftime('%H:%M')}")
            print(f"      => SKIPPED (correct - mid-bar entry)")

print()
print("=" * 70)
print("STEP 9: THE BUG - What if the entry bar IS included?")
print("=" * 70)

# The bug might be: if entry_dt is parsed as a naive datetime (no tz),
# then comparing tz-aware df.index >= naive datetime might behave unexpectedly.

print("Testing: what if entry_dt is naive (no tz)?")
naive_entry = datetime(2025, 5, 8, 9, 20)
print(f"  Naive entry: {naive_entry}")
print(f"  df.index type: {type(df.index)} (tz={df.index.tz})")

# In pandas, comparing tz-aware index with naive datetime can give unexpected results
# Let's test
try:
    naive_mask = df.index >= naive_entry
    naive_future = df[naive_mask]
    print(f"  Bars with naive mask: {len(naive_future)}")
    if len(naive_future) > 0:
        print(f"  First bar (naive): {naive_future.index[0]}")
except Exception as e:
    print(f"  ERROR comparing naive vs tz-aware: {e}")

# The key insight: when entry_dt is naive and df.index is tz-aware UTC,
# pandas might convert the naive datetime to UTC or might raise an error
# OR it might silently treat it as UTC, which could include/exclude bars differently

# Let's also check: what if the CSV entry time is actually parsed differently?
print()
print("=" * 70)
print("STEP 10: What if the CSV date was parsed with a different timezone?")
print("=" * 70)

# The CSV says "2025-05-08 09:20"
# The parse_datetime function tries multiple formats, none include timezone
# So it returns a naive datetime
# Then entry_dt.replace(tzinfo=ZoneInfo("UTC")) makes it UTC
# This should be correct...

# BUT: what if the cTrader backend returns bars in a different timezone?
# The cTrader API returns timestamps in UTC (ms since epoch)
# pd.to_datetime(..., unit="ms", utc=True) converts to UTC
# So df.index is in UTC
# entry_dt is also UTC
# This should match.

# Let's check the actual bar timestamps more carefully
print("All bar timestamps in the fetch range:")
for i, (ts, row) in enumerate(df.head(20).iterrows()):
    ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
    ts_ms = ts.value // 10**6  # nanoseconds to ms
    print(f"  [{i:>2}] {ts_str} (ms={ts_ms}) O={row['Open']:.5f} H={row['High']:.5f} L={row['Low']:.5f} C={row['Close']:.5f}")
