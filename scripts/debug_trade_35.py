#!/usr/bin/env python3
"""
Debug script for Trade #35 from SL25_TP60 simulation.

Trade details:
  Entry: 2025-05-08 09:20 UTC, EURUSD BUY, 0.2 lots, entry price 1.12881
  Actual close: 1.12351
  Simulation says: WIN, +60 pips, exit 1.13481, "TP hit after 2 bars"

SL = 25 pips -> SL price = 1.12881 - 0.0025 = 1.12631
TP = 60 pips -> TP price = 1.12881 + 0.0006 = 1.13481

For a BUY trade:
  SL hits when bar_low <= 1.12631
  TP hits when bar_high >= 1.13481
"""

import requests
import json
from datetime import datetime, timezone

BACKEND = "http://localhost:8080"
SYMBOL = "EURUSD"
RESOLUTION = "15m"

# Trade parameters
ENTRY_TIME = datetime(2025, 5, 8, 9, 20, tzinfo=timezone.utc)
ENTRY_PRICE = 1.12881
DIRECTION = "BUY"
SL_PIPS = 25
TP_PIPS = 60
PIP_SIZE = 0.0001  # EURUSD

# Calculate SL/TP prices
SL_PRICE = ENTRY_PRICE - SL_PIPS * PIP_SIZE  # 1.12631
TP_PRICE = ENTRY_PRICE + TP_PIPS * PIP_SIZE  # 1.13481

print("=" * 70)
print("TRADE #35 DEBUG")
print("=" * 70)
print(f"Entry:  {ENTRY_TIME.strftime('%Y-%m-%d %H:%M')} UTC  {DIRECTION}  @ {ENTRY_PRICE}")
print(f"SL:     {SL_PRICE}  ({SL_PIPS} pips below entry)")
print(f"TP:     {TP_PRICE}  ({TP_PIPS} pips above entry)")
print()

# Fetch OHLC data
from_ts = int(ENTRY_TIME.timestamp() * 1000) - 300000  # 5 min before entry
to_ts = int(ENTRY_TIME.timestamp() * 1000) + 4 * 3600000  # 4 hours after entry

params = {
    "symbol": SYMBOL,
    "resolution": RESOLUTION,
    "from": from_ts,
    "to": to_ts,
}

url = f"{BACKEND}/api/candles"
print(f"Fetching OHLC from {BACKEND}{url}?symbol={SYMBOL}&resolution={RESOLUTION}&from={from_ts}&to={to_ts}")
print()

resp = requests.get(url, params=params, timeout=30)
data = resp.json()

if "error" in data:
    print(f"ERROR: {data['error']}")
    exit(1)

bars = data.get("bars", [])
print(f"Retrieved {len(bars)} bars\n")

# Display bars with SL/TP analysis
print(f"{'Bar #':>6}  {'Time (UTC)':<20}  {'Open':>9}  {'High':>9}  {'Low':>9}  {'Close':>9}  {'SL<=Low?':>9}  {'TP>=High?':>10}  {'Result':>10}")
print("-" * 110)

sl_hit = False
tp_hit = False
entry_bar_skipped = False

for i, bar in enumerate(bars):
    bar_time = datetime.fromtimestamp(bar["timestamp"] / 1000, tz=timezone.utc)
    bar_time_str = bar_time.strftime("%Y-%m-%d %H:%M")
    o, h, l, c = bar["open"], bar["high"], bar["low"], bar["close"]

    # Check if this bar overlaps with entry time
    bar_open_ms = bar["timestamp"]
    entry_ms = int(ENTRY_TIME.timestamp() * 1000)

    # Skip entry bar if entry was mid-bar (not at bar open)
    is_entry_bar = (bar_open_ms == from_ts + 300000) or (i == 0 and bar_open_ms <= entry_ms)

    # For mid-bar entry: the first bar that starts at or before entry_time
    # but we need to check if the entry happened AFTER the bar opened
    # The bar containing the entry time
    if i == 0:
        # First bar starts at from_ts (which is 5 min before entry)
        pass

    # Determine if this is the entry bar
    bar_start = datetime.fromtimestamp(bar["timestamp"] / 1000, tz=timezone.utc)
    bar_end = datetime.fromtimestamp((bar["timestamp"] + 900000) / 1000, tz=timezone.utc)

    is_entry_bar = bar_start <= ENTRY_TIME < bar_end
    skip_check = False

    if is_entry_bar:
        # Entry was mid-bar - the entry happened at 09:20, bar started at 09:15
        # We should NOT check full bar wicks because price action before 09:20
        # cannot trigger our stops
        skip_check = True
        entry_bar_skipped = True

    # SL/TP checks
    sl_check = l <= SL_PRICE
    tp_check = h >= TP_PRICE

    if sl_check and tp_check:
        result = "AMBIGUOUS"
    elif sl_check:
        result = "SL HIT"
        sl_hit = True
    elif tp_check:
        result = "TP HIT"
        tp_hit = True
    else:
        result = "..."

    skip_str = " [SKIPPED]" if skip_check else ""
    print(f"  {i+1:>4}  {bar_time_str:<20}  {o:>9.5f}  {h:>9.5f}  {l:>9.5f}  {c:>9.5f}  {str(sl_check):>9}  {str(tp_check):>10}  {result:>10}{skip_str}")

    if (sl_hit or tp_hit) and not skip_check:
        print()
        print(f"  => Trade exited on bar #{i+1} ({bar_time_str})")
        break

print()
print("=" * 70)
print("SUMMARY")
print("=" * 70)

if entry_bar_skipped:
    print("  Entry bar (09:15) was SKIPPED because entry was mid-bar (09:20)")
    print("  This is CORRECT behavior - prevents look-ahead bias.")

if sl_hit:
    print(f"  => SL was hit at {SL_PRICE} (bar low dropped to or below SL)")
    print(f"  => Simulation should report: LOSS, -{SL_PIPS} pips")
elif tp_hit:
    print(f"  => TP was hit at {TP_PRICE} (bar high rose to or above TP)")
    print(f"  => Simulation should report: WIN, +{TP_PIPS} pips")
else:
    print(f"  => Neither SL nor TP was hit in the available bars")
    print(f"  => Simulation falls back to last bar close as exit price")
    last_bar = bars[-1]
    last_close = last_bar["close"]
    pip_diff = (last_close - ENTRY_PRICE) / PIP_SIZE
    print(f"  => Last bar close: {last_close}, sim pips: {pip_diff:+.1f}")

print()
print("ACTUAL TRADE COMPARISON:")
print(f"  Actual close price: 1.12351")
print(f"  Actual result: Price went DOWN from 1.12881 to 1.12351")
print(f"  1.12351 is BELOW SL ({SL_PRICE}) -> SL should have been hit")
print()

# Check actual close against SL/TP
print("CHECKING: Would the actual close price trigger SL/TP?")
print(f"  1.12351 <= {SL_PRICE} (SL)? {'YES - SL HIT' if 1.12351 <= SL_PRICE else 'NO'}")
print(f"  1.12351 >= {TP_PRICE} (TP)? {'YES - TP HIT' if 1.12351 >= TP_PRICE else 'NO'}")
print()

# Check if the entry bar (09:15-09:30) had SL/TP triggered
entry_bar = bars[0]
print(f"ENTRY BAR (09:15-09:30): O={entry_bar['open']} H={entry_bar['high']} L={entry_bar['low']} C={entry_bar['close']}")
print(f"  Low {entry_bar['low']} <= SL {SL_PRICE}? {entry_bar['low'] <= SL_PRICE}")
print(f"  High {entry_bar['high']} >= TP {TP_PRICE}? {entry_bar['high'] >= TP_PRICE}")
print()

# Check all bars for any SL/TP touch
print("ALL BARS CHECK:")
for i, bar in enumerate(bars):
    bar_time = datetime.fromtimestamp(bar["timestamp"] / 1000, tz=timezone.utc)
    bar_time_str = bar_time.strftime("%H:%M")
    o, h, l, c = bar["open"], bar["high"], bar["low"], bar["close"]
    sl_touch = l <= SL_PRICE
    tp_touch = h >= TP_PRICE
    if sl_touch or tp_touch:
        print(f"  {bar_time_str}: SL={'YES' if sl_touch else 'no'} TP={'YES' if tp_touch else 'no'}  L={l} H={h}")

# The key question: does the simulation correctly skip the entry bar?
print()
print("KEY FINDING:")
print(f"  Entry bar (09:15-09:30) Low={bars[0]['low']} vs SL={SL_PRICE}")
print(f"  If the bar low ({bars[0]['low']}) is BELOW SL ({SL_PRICE}),")
print(f"  the simulation SKIPS this bar (mid-bar entry) and checks from next bar.")
print(f"  The next bar (09:30) would need to have low <= {SL_PRICE} for SL to trigger.")
print()

# Check next bar
if len(bars) > 1:
    next_bar = bars[1]
    next_time = datetime.fromtimestamp(next_bar["timestamp"] / 1000, tz=timezone.utc)
    print(f"  Next bar ({next_time.strftime('%H:%M')}) Low={next_bar['low']} vs SL={SL_PRICE}: {next_bar['low'] <= SL_PRICE}")
    if next_bar["low"] <= SL_PRICE:
        print(f"  => SL WOULD be hit on bar #2 (09:30)")
    else:
        print(f"  => SL would NOT be hit on bar #2")
