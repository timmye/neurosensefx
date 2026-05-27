#!/usr/bin/env python3
"""
SL/TP Walk-Forward Analyzer
============================
Tests alternative SL/TP parameters against REAL historical OHLC data from cTrader.

Usage (from project root):
    python backtester/sl_tp_analyzer.py backtester/data/20260430_full_history.csv --sl 25 --tp 40 --timeframe 15m --backend http://localhost:8080

Output: Metrics + per-trade results table + cumulative P/L chart saved to backtester/results/

Requirements:
    pip install pandas matplotlib openpyxl requests
"""

import argparse
import csv
import sys
import os
import time
from datetime import datetime, timedelta
from urllib.parse import urlencode

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Run: pip install pandas")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

try:
    matplotlib_installed = True
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
except ImportError:
    matplotlib_installed = False
    print("WARNING: matplotlib not installed. Charts will be skipped. Run: pip install matplotlib")

try:
    openpyxl_installed = True
    import openpyxl
except ImportError:
    openpyxl_installed = False
    print("WARNING: openpyxl not installed. XLSX support disabled. Run: pip install openpyxl")


# ============================================================
# Pip size definitions by instrument
# ============================================================

PIP_SIZES = {
    # JPY pairs
    "AUDJPY": 0.01, "EURJPY": 0.01, "NZDJPY": 0.01, "GBPJPY": 0.01,
    "CADJPY": 0.01, "USDJPY": 0.01, "CHFJPY": 0.01,
    # Major FX
    "AUDUSD": 0.0001, "EURUSD": 0.0001, "GBPUSD": 0.0001, "AUDCHF": 0.0001,
    "GBPAUD": 0.0001, "EURGBP": 0.0001, "EURCHF": 0.0001, "USDCHF": 0.0001,
    "NZDUSD": 0.0001, "USDCAD": 0.0001, "USDSGD": 0.0001, "AUDCAD": 0.0001,
    "GBPCAD": 0.0001, "EURCAD": 0.0001, "NZDCHF": 0.0001, "AUDNZD": 0.0001,
    "USDCNH": 0.0001,
    # Metals
    "XAUUSD": 0.1, "XAGUSD": 0.01,
    # Oil
    "WTI": 0.01, "BRENT": 0.01, "USOIL": 0.01, "UKOIL": 0.01,
    # Indices (1 point = 1 pip)
    "SPX500": 1.0, "US500": 1.0, "HK50": 1.0, "HSI": 1.0,
    "GER40": 1.0, "DAX": 1.0,
    # Crypto ($1 = 1 pip)
    "BTCUSD": 1.0, "ETHUSD": 1.0,
    # Dollar Index
    "DX": 0.01,
}


def get_pip_size(symbol: str) -> float:
    """Get pip size for a given symbol, stripping suffixes like 'p' or '.f'"""
    clean = symbol.rstrip("p").replace(".f", "").replace(".F", "")
    if clean in PIP_SIZES:
        return PIP_SIZES[clean]
    if symbol in PIP_SIZES:
        return PIP_SIZES[symbol]
    # Heuristic fallbacks
    if "JPY" in symbol:
        return 0.01
    if "BTC" in symbol or "ETH" in symbol:
        return 1.0
    if "XAU" in symbol:
        return 0.1
    if any(x in clean for x in ["WTI", "BRENT", "USOIL", "UKOIL"]):
        return 0.01
    if any(x in clean for x in ["SPX", "HK50", "GER40", "DAX", "HSI", "US500"]):
        return 1.0
    if "DX" in clean:
        return 0.01
    return 0.0001  # default for FX


def parse_value_list(val):
    """Parse '25' into [25.0] or '20,30,40' into [20.0, 30.0, 40.0]."""
    return [float(p.strip()) for p in str(val).split(",")]


# ============================================================
# cTrader OHLC fetcher
# ============================================================

ohlc_cache: dict = {}


def clean_symbol(symbol: str) -> str:
    """Strip cTrader suffixes (p, .f, .F) from symbol names."""
    return symbol.rstrip("p").replace(".f", "").replace(".F", "")


def fetch_ohlc(backend_url: str, symbol: str, resolution: str,
               start: datetime, end: datetime) -> pd.DataFrame:
    """Fetch real OHLC data from cTrader backend API with caching."""
    cache_key = f"{symbol}_{resolution}_{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}"
    if cache_key in ohlc_cache:
        return ohlc_cache[cache_key]

    clean = clean_symbol(symbol)
    # cTrader API: GET /api/candles?symbol=EURUSD&resolution=15m&from=...&to=...
    # from/to are Unix timestamps in milliseconds
    params = urlencode({
        "symbol": clean,
        "resolution": resolution,
        "from": int(start.timestamp() * 1000),
        "to": int(end.timestamp() * 1000),
    })
    url = f"{backend_url}/api/candles?{params}"

    print(f"  Fetching {clean} ({resolution}) from {start.date()} to {end.date()}...")

    max_retries = 3
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code == 429:
                delay = 2000 * (attempt + 1)
                print(f"  Rate limited, retrying in {delay}ms...")
                time.sleep(delay / 1000)
                continue
            if resp.status_code == 401:
                print(f"  ERROR: cTrader backend is not authenticated.")
                print(f"         Set CTRADER_API_KEY in .env and restart the backend.")
                ohlc_cache[cache_key] = pd.DataFrame()
                return pd.DataFrame()
            if resp.status_code == 500:
                data = resp.json()
                print(f"  ERROR from backend: {data.get('error', 'Unknown')}")
                ohlc_cache[cache_key] = pd.DataFrame()
                return pd.DataFrame()
            resp.raise_for_status()
            break
        except requests.exceptions.ConnectionError as e:
            print(f"  ERROR: Cannot connect to cTrader backend at {backend_url}")
            print(f"         Make sure the backend is running: ./run.sh start")
            sys.exit(1)
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
            raise

    data = resp.json()
    if "error" in data and data.get("bars", []) == []:
        print(f"  ERROR from backend: {data['error']}")
        ohlc_cache[cache_key] = pd.DataFrame()
        return pd.DataFrame()

    bars = data.get("bars", [])
    if not bars:
        print(f"  WARNING: No data returned for {symbol}")
        ohlc_cache[cache_key] = pd.DataFrame()
        return pd.DataFrame()

    # Convert cTrader bars to pandas DataFrame
    # cTrader format: { open, high, low, close, volume, timestamp } (timestamp in ms)
    df = pd.DataFrame(bars)
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.rename(columns={
        "open": "Open", "high": "High", "low": "Low", "close": "Close",
        "volume": "Volume"
    })
    df = df[["Open", "High", "Low", "Close", "timestamp"]].dropna()
    df.index = df["timestamp"]
    ohlc_cache[cache_key] = df
    print(f"  Got {len(df)} bars for {symbol}")
    return df


# ============================================================
# Trade log parser
# ============================================================

def detect_delimiter(text: str) -> str:
    first_line = text.split("\n")[0]
    tabs = first_line.count("\t")
    semis = first_line.count(";")
    commas = first_line.count(",")
    if tabs >= semis and tabs >= commas and tabs > 0:
        return "\t"
    if semis >= commas and semis > 0:
        return ";"
    return ","


def parse_datetime(s: str) -> datetime:
    s = s.strip()
    # yyyy.mm.dd hh:mm:ss
    for fmt in ("%Y.%m.%d %H:%M:%S", "%Y.%m.%d %H:%M", "%d/%m/%Y %H:%M:%S",
                "%d/%m/%Y %H:%M", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M",
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    # Try pandas
    try:
        return pd.to_datetime(s)
    except:
        return datetime(2000, 1, 1)


def find_col(headers: list, keywords: list) -> int:
    import re
    h_lower = [re.sub(r"[^a-z0-9]", "", h.lower().strip()) for h in headers]
    for kw in keywords:
        for i, h in enumerate(h_lower):
            if kw == h or kw in h:
                return i
    return -1


def parse_trade_log(text: str) -> list:
    """Parse trade log text into list of trade dicts.

    Handles files with metadata header rows (e.g. cTrader exports with
    Company:/Date:/Positions rows before the actual column headers).
    """
    delim = detect_delimiter(text)
    lines = text.strip().split("\n")
    if len(lines) < 2:
        print("ERROR: Need at least a header row and one data row.")
        sys.exit(1)

    # Find the actual header row by scanning the first 10 lines for
    # recognizable column names.  This handles cTrader-style files that
    # have 3+ metadata rows (Company:, Date:, Positions) before headers.
    header_keywords = ["time", "symbol", "type", "volume", "price", "profit",
                       "position", "commission", "swap", "open", "close", "sl", "tp"]
    header_line_idx = 0
    for i in range(min(len(lines), 10)):
        parts = lines[i].split(delim)
        parts_lower = [p.lower().strip() for p in parts]
        matches = sum(1 for kw in header_keywords if any(kw in p for p in parts_lower))
        if matches >= 4:  # at least 4 keyword matches => header row
            header_line_idx = i
            break

    headers = lines[header_line_idx].split(delim)
    # Fix: re-implementation without regex for simplicity
    h_clean = [h.lower().strip().replace(" ", "").replace("_", "") for h in headers]

    def find_first(keywords):
        for kw in keywords:
            for i, h in enumerate(h_clean):
                if kw in h:
                    return i
        return -1

    def find_last(keywords):
        best = -1
        for kw in keywords:
            for i, h in enumerate(h_clean):
                if kw in h:
                    best = i
        return best

    # For columns that may appear twice (Time/Price for open vs close),
    # use find_last to grab the second occurrence.
    def find_close(col_keywords, fallback_keywords):
        idx = find_first(col_keywords)
        if idx >= 0:
            return idx
        return find_last(fallback_keywords)

    cols = {
        "open_time": find_first(["opentime", "opendate", "datetime", "time", "open"]),
        "order": find_first(["order", "orderid", "ticket", "order#"]),
        "symbol": find_first(["symbol", "instrument", "pair", "ticker"]),
        "direction": find_first(["direction", "type", "action", "side", "buysell"]),
        "lots": find_first(["lots", "volume", "size", "units", "amount"]),
        "open_price": find_first(["openprice", "open", "entry", "price"]),
        "sl": find_first(["sl", "stoploss", "stop"]),
        "tp": find_first(["tp", "takeprofit", "target"]),
        "close_time": find_close(["closetime", "closedate", "close"], ["time"]),
        "close_price": find_close(["closeprice", "exit", "close"], ["price"]),
        "commission": find_first(["commission", "com", "comm"]),
        "swap": find_first(["swap", "financing", "rollover"]),
        "pl": find_first(["profit", "pnl", "pl", "pl$", "result", "net"]),
    }

    critical = ["open_time", "symbol", "direction", "open_price", "close_time", "close_price"]
    for c in critical:
        if cols[c] < 0:
            print(f"ERROR: Could not find column for '{c}'. Available headers: {headers}")
            print("Required: Open Time, Symbol, Direction, Open Price, Close Time, Close Price")
            sys.exit(1)

    def pnum(val):
        try:
            return float(val.replace(",", "").replace('"', "").strip())
        except:
            return 0.0

    trades = []
    for i, line in enumerate(lines[1:], 1):
        line = line.strip()
        if not line:
            continue
        parts = line.split(delim)
        if len(parts) < max(cols[c] for c in critical) + 1:
            continue

        op = pnum(parts[cols["open_price"]])
        cp = pnum(parts[cols["close_price"]])
        if op <= 0 or cp <= 0:
            continue

        trades.append({
            "open_time": parse_datetime(parts[cols["open_time"]]),
            "close_time": parse_datetime(parts[cols["close_time"]]),
            "symbol": parts[cols["symbol"]].strip(),
            "direction": parts[cols["direction"]].strip().lower(),
            "lots": pnum(parts[cols["lots"]]) if cols["lots"] >= 0 else 0,
            "open_price": op,
            "close_price": cp,
            "commission": pnum(parts[cols["commission"]]) if cols["commission"] >= 0 else 0,
            "swap": pnum(parts[cols["swap"]]) if cols["swap"] >= 0 else 0,
            "pl_dollars": pnum(parts[cols["pl"]]) if cols["pl"] >= 0 else 0,
        })

    trades.sort(key=lambda t: t["open_time"])
    return trades


# ============================================================
# Simulation Engine
# ============================================================

def load_sl_map(path: str) -> dict:
    """Load SYMBOL=PIP_SIZE map from file. Returns {clean_symbol: pips}.

    Map keys are expected to be clean pair names (e.g. EURUSD, USDJPY).
    _resolve_sl() strips trailing p/P from trade symbols to match these keys.
    """
    sl_map = {}
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("=")
            if len(parts) == 2:
                sym = parts[0].strip().upper()
                try:
                    sl_map[sym] = float(parts[1].strip())
                except ValueError:
                    pass
    return sl_map


def _resolve_sl(t_sl: float, symbol: str, sl_map: dict, default: float) -> float:
    """Return SL pips for a trade, checking per-symbol map first."""
    clean = symbol.rstrip("p").replace(".f", "").replace(".F", "")
    return sl_map.get(clean, sl_map.get(symbol, default))


def simulate_trades(trades: list, sl_pips: float, tp_pips: float,
                    interval: str, mode: str = "conservative",
                    backend_url: str = "http://localhost:8080",
                    sl_map: dict = None) -> tuple:
    """
    Walk-forward simulation: for each real trade entry, step through
    historical OHLC bars from cTrader and check if SL/TP would
    have been hit on the bar wicks.

    Per-trade logic:
      1. Use trade's open_time to locate the matching OHLC bar.
      2. Calculate SL/TP prices from entry + pip parameters.
      3. Walk forward bar-by-bar, checking bar High/Low (wicks).
      4. First trigger wins — trade closes on that bar.
      5. If both SL & TP in same bar: mode decides (conservative=SL,
         optimistic=TP, neutral=EV split).
      6. If neither hit in max_bars bars: fall back to actual close price.

    Per-symbol forward windows: trades are sorted chronologically and
    fetched in forward windows from the unfetched point, reusing cached
    data when possible to minimize API calls.

    Returns (results_list, metrics_dict).
    """
    interval_map = {"5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "1d": "D"}
    resolution = interval_map.get(interval, "1h")
    max_bars_map = {"5m": 2000, "15m": 2000, "30m": 2000, "1h": 500, "1d": 60}
    max_bars = max_bars_map.get(interval, 500)
    if sl_map is None:
        sl_map = {}

    # Group by symbol for batch fetching
    symbols = {}
    for t in trades:
        sym = t["symbol"]
        if sym not in symbols:
            symbols[sym] = []
        symbols[sym].append(t)

    results = []
    fetch_count = 0

    for sym, sym_trades in symbols.items():
        pip_size = get_pip_size(sym)

        # Parse valid trade times and sort chronologically
        valid_trades = []
        invalid_trades = []
        for t in sym_trades:
            if not isinstance(t["open_time"], datetime):
                invalid_trades.append(t)
                continue
            entry_dt = t["open_time"]
            try:
                from zoneinfo import ZoneInfo
                if entry_dt.tzinfo is None:
                    entry_dt = entry_dt.replace(tzinfo=ZoneInfo("UTC"))
            except ImportError:
                import datetime as dt_mod
                import pytz
                if entry_dt.tzinfo is None:
                    entry_dt = entry_dt.replace(tzinfo=pytz.UTC)
            valid_trades.append((entry_dt, t))

        # Report invalid trades
        for _, t in invalid_trades:
            results.append({**t, "sim_result": "no_data", "sim_pips": 0,
                            "sim_exit": t["close_price"], "sim_bars": 0,
                            "sim_notes": "Could not parse date"})

        if not valid_trades:
            continue

        valid_trades.sort(key=lambda x: x[0])  # Sort by entry time

        # Interval to ms conversion
        interval_ms_map = {"5m": 5*60*1000, "15m": 15*60*1000, "30m": 30*60*1000,
                           "1h": 60*60*1000, "1d": 24*60*60*1000}
        interval_ms = interval_ms_map.get(interval, 15*60*1000)
        thirty_five_weeks_ms = 21168000000
        window_size = min(thirty_five_weeks_ms, max_bars * interval_ms)

        cached_df = None      # Most recently fetched DataFrame

        for entry_dt, t in valid_trades:
            entry_ts = int(entry_dt.timestamp() * 1000)

            # Check if this trade's entry is already covered by cached data
            if cached_df is not None and not cached_df.empty:
                cached_min = cached_df.index.min()
                cached_max = cached_df.index.max()
                if cached_min <= entry_dt <= cached_max:
                    # Data already fetched — simulate from cached df
                    pass
                else:
                    # Need to fetch a new window
                    fetch_start = entry_dt - timedelta(hours=48)
                    fetch_end_ms = entry_ts + window_size
                    fetch_end = datetime.fromtimestamp(fetch_end_ms / 1000, tz=ZoneInfo("UTC"))
                    cached_df = fetch_ohlc(backend_url, sym, resolution, fetch_start, fetch_end)
                    fetch_count += 1
            else:
                # First fetch for this symbol
                fetch_start = entry_dt - timedelta(hours=48)
                fetch_end_ms = entry_ts + window_size
                fetch_end = datetime.fromtimestamp(fetch_end_ms / 1000, tz=ZoneInfo("UTC"))
                cached_df = fetch_ohlc(backend_url, sym, resolution, fetch_start, fetch_end)
                fetch_count += 1

            if cached_df.empty:
                results.append({**t, "sim_result": "no_data", "sim_pips": 0,
                                "sim_exit": t["close_price"], "sim_bars": 0,
                                "sim_notes": f"No cTrader data for {sym} ({resolution})"})
                continue

            # --- Trade simulation ---
            is_buy = t["direction"] == "buy"

            trade_sl = _resolve_sl(sl_pips, t["symbol"], sl_map, sl_pips)
            sl_price = (t["open_price"] - trade_sl * pip_size) if is_buy else (t["open_price"] + trade_sl * pip_size)
            tp_price = (t["open_price"] + tp_pips * pip_size) if is_buy else (t["open_price"] - tp_pips * pip_size)

            # Get bars from entry time onward
            mask = cached_df.index >= entry_dt
            future = cached_df[mask].head(max_bars)

            sim_result = None
            entry_dt_normalized = entry_dt.replace(tzinfo=None)

            for idx, (ts, row) in enumerate(future.iterrows()):
                # Skip SL/TP check on entry bar if entry was mid-bar.
                # Checking the full bar's High/Low when entry occurred after
                # the bar open would be look-ahead bias: price action before
                # the entry cannot trigger our stops.
                if idx == 0:
                    bar_open_ts = ts.to_pydatetime().replace(tzinfo=None)
                    if entry_dt_normalized != bar_open_ts:
                        continue  # Entry was mid-bar; start checking from next bar

                bar_high = row["High"]
                bar_low = row["Low"]

                sl_hit = bar_low <= sl_price if is_buy else bar_high >= sl_price
                tp_hit = bar_high >= tp_price if is_buy else bar_low <= tp_price

                if sl_hit and tp_hit:
                    exit_time = ts.strftime("%Y-%m-%d %H:%M")
                    if mode == "conservative":
                        sim_result = {"sim_result": "loss", "sim_pips": -trade_sl,
                                      "sim_exit": sl_price, "sim_bars": idx + 1,
                                      "sim_notes": f"Ambiguous bar {idx+1} — conservative: SL first"}
                    elif mode == "optimistic":
                        sim_result = {"sim_result": "win", "sim_pips": tp_pips,
                                      "sim_exit": tp_price, "sim_bars": idx + 1,
                                      "sim_notes": f"Ambiguous bar {idx+1} — optimistic: TP first"}
                    else:  # neutral
                        ev = (tp_pips - trade_sl) / 2
                        sim_result = {"sim_result": "ambiguous", "sim_pips": ev,
                                      "sim_exit": (sl_price + tp_price) / 2, "sim_bars": idx + 1,
                                      "sim_notes": f"Ambiguous bar {idx+1} — neutral: {ev:+.1f}pips EV"}
                    break

                if sl_hit:
                    sim_result = {"sim_result": "loss", "sim_pips": -trade_sl,
                                  "sim_exit": sl_price, "sim_bars": idx + 1,
                                  "sim_notes": f"SL hit after {idx+1} bars"}
                    break

                if tp_hit:
                    sim_result = {"sim_result": "win", "sim_pips": tp_pips,
                                  "sim_exit": tp_price, "sim_bars": idx + 1,
                                  "sim_notes": f"TP hit after {idx+1} bars"}
                    break

            if not sim_result:
                # Neither SL/TP hit within max_bars: use last available bar's close as simulated exit
                if len(future) > 0:
                    last_bar = future.iloc[-1]
                    exit_price = last_bar["Close"]
                    sim_pips = ((exit_price - t["open_price"]) / pip_size) if is_buy \
                               else ((t["open_price"] - exit_price) / pip_size)
                    sim_result = {
                        "sim_result": "win" if sim_pips >= 0 else "loss",
                        "sim_pips": sim_pips,
                        "sim_exit": exit_price,
                        "sim_bars": len(future),
                        "sim_notes": f"Neither SL/TP in {len(future)} bars — exited at last bar close",
                    }
                else:
                    # No future bars available at all
                    sim_result = {
                        "sim_result": "no_data",
                        "sim_pips": 0,
                        "sim_exit": t["close_price"],
                        "sim_bars": 0,
                        "sim_notes": "No OHLC data after entry time",
                    }

            results.append({**t, **sim_result})

    # Calculate metrics
    wins = [r for r in results if r["sim_result"] == "win"]
    losses = [r for r in results if r["sim_result"] == "loss"]
    ambiguous = [r for r in results if r["sim_result"] == "ambiguous"]
    no_data = [r for r in results if r["sim_result"] == "no_data"]

    decisive = wins + losses
    total_wins = len(wins)
    total_losses = len(losses)
    total_decisive = total_wins + total_losses
    win_rate = total_wins / total_decisive if total_decisive > 0 else 0

    gross_win = sum(r["sim_pips"] for r in wins)
    gross_loss = abs(sum(r["sim_pips"] for r in losses))
    avg_win = gross_win / total_wins if total_wins > 0 else 0
    avg_loss = gross_loss / total_losses if total_losses > 0 else 0
    rr_ratio = avg_win / avg_loss if avg_loss > 0 else 0
    expectancy = (win_rate * avg_win) - ((1 - win_rate) * avg_loss)
    profit_factor = gross_win / gross_loss if gross_loss > 0 else 0

    # Streaks
    max_cw, max_cl, cw, cl = 0, 0, 0, 0
    for r in results:
        if r["sim_result"] == "win":
            cw += 1; cl = 0; max_cw = max(max_cw, cw)
        elif r["sim_result"] == "loss":
            cl += 1; cw = 0; max_cl = max(max_cl, cl)
        else:
            cw = 0; cl = 0

    valid_bars = [r["sim_bars"] for r in results if r["sim_result"] != "no_data"]
    avg_bars = sum(valid_bars) / len(valid_bars) if valid_bars else 0

    metrics = {
        "total_trades": len(results),
        "wins": total_wins,
        "losses": total_losses,
        "ambiguous": len(ambiguous),
        "no_data": len(no_data),
        "win_rate": win_rate,
        "expectancy": expectancy,
        "rr_ratio": rr_ratio,
        "profit_factor": profit_factor,
        "total_pips": sum(r["sim_pips"] for r in results),
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "max_win": max((r["sim_pips"] for r in wins), default=0),
        "max_loss": min((r["sim_pips"] for r in losses), default=0),
        "max_win_streak": max_cw,
        "max_loss_streak": max_cl,
        "avg_bars": avg_bars,
        "sl_pips": sl_pips,
        "sl_map": sl_map,
        "tp_pips": tp_pips,
        "mode": mode,
        "timeframe": interval,
        "symbols_processed": len(symbols),
        "fetch_count": fetch_count,
    }

    return results, metrics


# ============================================================
# Output
# ============================================================

def print_results(results: list, metrics: dict):
    """Print formatted results to console."""

    hline = "=" * 100

    print(f"\n{hline}")
    print(f"  SL/TP WALK-FORWARD ANALYSIS RESULTS")
    sl_display = metrics['sl_pips']
    if metrics.get('sl_map'):
        sl_display = f"{metrics['sl_pips']} (per-pair map)"
    print(f"  SL: {sl_display} | TP: {metrics['tp_pips']} pips | "
          f"Mode: {metrics['mode']} | Timeframe: {metrics['timeframe']}")
    print(f"  Data source: cTrader (real historical OHLC)")
    print(f"{hline}")

    # --- KEY METRICS ---
    print(f"\n{'─' * 60}")
    print(f"  KEY METRICS")
    print(f"{'─' * 60}")

    def fmt_pips(v):
        return f"{v:+.1f}" if v != 0 else "0.0"

    total = metrics["total_trades"]
    decisive = metrics["wins"] + metrics["losses"]
    wr = metrics["win_rate"] * 100
    exp = metrics["expectancy"]
    rr = metrics["rr_ratio"]
    pf = metrics["profit_factor"]

    print(f"  Total Trades:        {total}")
    print(f"  Wins / Losses:       {metrics['wins']} / {metrics['losses']} "
          f"(decisive: {decisive})")
    if metrics["ambiguous"] > 0:
        print(f"  Ambiguous:           {metrics['ambiguous']} (both SL & TP in same bar)")
    if metrics["no_data"] > 0:
        print(f"  No Data:             {metrics['no_data']} (cTrader fetch failed)")
    print(f"  Win Rate:            {wr:.1f}%")
    print(f"  Expectancy:          {fmt_pips(exp)} pips per trade")
    print(f"  R:R Ratio:           1:{rr:.2f}")
    print(f"  Profit Factor:       {pf:.2f}")
    print(f"  Total Sim P/L:       {fmt_pips(metrics['total_pips'])} pips")
    print(f"  Avg Win:             +{metrics['avg_win']:.1f} pips")
    print(f"  Avg Loss:            -{metrics['avg_loss']:.1f} pips")
    print(f"  Max Win:             +{metrics['max_win']:.1f} pips")
    print(f"  Max Loss:            {metrics['max_loss']:.1f} pips")
    print(f"  Win Streak:          {metrics['max_win_streak']}")
    print(f"  Loss Streak:         {metrics['max_loss_streak']}")
    print(f"  Avg Bars to Exit:    {metrics['avg_bars']:.0f}")

    # --- PER-TRADE RESULTS ---
    print(f"\n{'─' * 100}")
    print(f"  TRADE RESULTS")
    print(f"{'─' * 100}")

    header = f"{'#':>4}  {'Date':<20}  {'Symbol':<10}  {'Dir':<5}  {'Entry':<12}  {'Result':<12}  {'Sim P/L':>10}  {'Bars':>5}  Notes"
    print(f"  {header}")
    print(f"  {'─' * len(header)}")

    for i, r in enumerate(results, 1):
        date_str = r["open_time"].strftime("%Y-%m-%d %H:%M") if isinstance(r["open_time"], datetime) else str(r["open_time"])
        sym = r["symbol"]
        direction = r["direction"].upper()
        entry = f"{r['open_price']:.5f}" if r["open_price"] < 100 else f"{r['open_price']:.2f}"
        result = r["sim_result"]
        pips = r["sim_pips"]
        bars = r["sim_bars"]
        notes = r["sim_notes"][:35]

        # Color indicators
        if result == "win":
            result_str = "WIN"
        elif result == "loss":
            result_str = "LOSS"
        elif result == "ambiguous":
            result_str = "AMBIG"
        else:
            result_str = "NODATA"

        pips_str = f"{pips:+.1f}"

        print(f"  {i:>4}  {date_str:<20}  {sym:<10}  {direction:<5}  {entry:<12}  {result_str:<12}  {pips_str:>10}  {bars:>5}  {notes}")

    # --- SYMBOL BREAKDOWN ---
    print(f"\n{'─' * 80}")
    print(f"  SYMBOL BREAKDOWN")
    print(f"{'─' * 80}")

    sym_data: dict = {}
    for r in results:
        s = r["symbol"]
        if s not in sym_data:
            sym_data[s] = {"wins": 0, "losses": 0, "ambig": 0, "nodata": 0, "pips": 0}
        if r["sim_result"] == "win":
            sym_data[s]["wins"] += 1
        elif r["sim_result"] == "loss":
            sym_data[s]["losses"] += 1
        elif r["sim_result"] == "ambiguous":
            sym_data[s]["ambig"] += 1
        else:
            sym_data[s]["nodata"] += 1
        sym_data[s]["pips"] += r["sim_pips"]

    print(f"  {'Symbol':<12}  {'Trades':>6}  {'Wins':>5}  {'Losses':>6}  {'Win%':>6}  {'Pip P/L':>10}")
    print(f"  {'─' * 50}")

    for sym, d in sorted(sym_data.items(), key=lambda x: x[1]["pips"], reverse=True):
        total_s = d["wins"] + d["losses"]
        wr_s = (d["wins"] / total_s * 100) if total_s > 0 else 0
        pips_s = d["pips"]
        print(f"  {sym:<12}  {total_s:>6}  {d['wins']:>5}  {d['losses']:>6}  {wr_s:>5.0f}%  {pips_s:>+10.1f}")

    print(f"\n{hline}\n")


def print_grid_summary(all_combination_results: dict, top_n: int = 10):
    """Print top SL/TP combos by total pips to console."""
    if not all_combination_results:
        return

    sorted_combos = sorted(
        all_combination_results.items(),
        key=lambda x: x[1][1]["total_pips"],
        reverse=True
    )

    print(f"\n{'=' * 100}")
    print(f"  SL/TP GRID SUMMARY (top {top_n} by total pips)")
    print(f"{'=' * 100}")
    print(f"  {'SL':>5}  {'TP':>5}  {'Wins':>5}  {'Losses':>6}  {'Win%':>6}  {'Total Pips':>12}  {'Expectancy':>12}  {'Profit Factor':>14}")
    print(f"  {'─' * 90}")

    for (sl, tp), (results, metrics) in sorted_combos[:top_n]:
        wr_pct = metrics["win_rate"] * 100
        print(f"  {sl:>5.0f}  {tp:>5.0f}  {metrics['wins']:>5}  {metrics['losses']:>6}  "
              f"{wr_pct:>5.1f}%  {metrics['total_pips']:>+11.0f}  "
              f"{metrics['expectancy']:>+11.1f}  {metrics['profit_factor']:>13.2f}")

    print(f"\n  (all {len(sorted_combos)} combos shown above)")
    print(f"{'=' * 100}\n")


def inspect_trade_grid(all_combination_results: dict, trades: list, trade_id: int):
    """Print per-trade SLxTP grid for a specific trade."""
    if trade_id < 1 or trade_id > len(trades):
        print(f"ERROR: Trade ID {trade_id} out of range (1-{len(trades)})")
        return

    trade = trades[trade_id - 1]
    combos = sorted(all_combination_results.keys())
    sl_values = sorted(set(round(sl) for sl, _ in combos))
    tp_values = sorted(set(round(tp) for _, tp in combos))

    print(f"\n{'=' * 100}")
    print(f"  INSPECT TRADE #{trade_id}")
    print(f"{'=' * 100}")
    date_str = trade["open_time"].strftime("%Y-%m-%d %H:%M") if isinstance(trade["open_time"], datetime) else str(trade["open_time"])
    print(f"  Date: {date_str}  Symbol: {trade['symbol']}  Direction: {trade['direction'].upper()}  "
          f"Entry: {trade['open_price']:.5f}  Actual P/L: ${trade['pl_dollars']:.2f}")
    print()

    header = f"{'SL' + chr(92) + 'TP':>8}"
    for tp in tp_values:
        header += f"  {tp:>8}"
    print(header)
    print(f"{'─' * len(header)}")

    for sl in sl_values:
        row = f"  {sl:>7}"
        for tp in tp_values:
            results = all_combination_results[(sl, tp)][0]
            if trade_id - 1 < len(results):
                r = results[trade_id - 1]
                result_str = r["sim_result"].upper()[:3]
                pips = f"{r['sim_pips']:+.0f}"
                if r["sim_result"] == "win":
                    marker = "+"
                elif r["sim_result"] == "loss":
                    marker = "-"
                else:
                    marker = "~"
                row += f"  {marker}{result_str}{pips:>5}"
            else:
                row += f"  {'N/A':>8}"
        print(row)

    print(f"\n  Legend: +WIN  -LOSS  ~AMBIG  N/A=no data")
    print(f"{'=' * 100}\n")


def plot_cumulative(results: list, metrics: dict, output_path: str = "cumulative_pips.png"):
    """Generate cumulative pip P/L chart."""
    if not matplotlib_installed:
        print("  Chart skipped: matplotlib not installed")
        return

    cumulative = []
    running = 0
    for r in results:
        running += r["sim_pips"]
        cumulative.append(running)

    fig, ax = plt.subplots(figsize=(14, 5))
    x = range(1, len(cumulative) + 1)
    colors = ["#10b981" if v >= 0 else "#ef4444" for v in cumulative]

    ax.fill_between(x, cumulative, 0, where=[v >= 0 for v in cumulative],
                    alpha=0.15, color="#10b981")
    ax.fill_between(x, cumulative, 0, where=[v < 0 for v in cumulative],
                    alpha=0.15, color="#ef4444")
    ax.plot(x, cumulative, color="#10b981" if cumulative[-1] >= 0 else "#ef4444",
            linewidth=1.2)
    ax.axhline(y=0, color="#9ca3af", linewidth=0.5, linestyle="--")

    ax.set_title(f"Cumulative Pip P/L  |  SL:{metrics['sl_pips']} TP:{metrics['tp_pips']}  "
                 f"TF:{metrics['timeframe']} Mode:{metrics['mode']}  |  Total: {cumulative[-1]:+.1f} pips",
                 fontsize=12, fontweight="bold")
    ax.set_xlabel("Trade #")
    ax.set_ylabel("Cumulative Pips")
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"  Chart saved: {output_path}")
    plt.close(fig)


def plot_summary_chart(all_combination_results: dict, output_path: str = "summary_chart.png"):
    """Bar chart of total net pips per (SL, TP) combination."""
    if not matplotlib_installed or not all_combination_results:
        return

    combos = sorted(all_combination_results.keys())
    labels = [f"SL{round(sl)}\nTP{round(tp)}" for sl, tp in combos]
    total_pips = [metrics["total_pips"] for _, metrics in all_combination_results.values()]

    colors = ["#10b981" if v >= 0 else "#ef4444" for v in total_pips]

    fig, ax = plt.subplots(figsize=(max(8, len(combos) * 1.2), 5))
    bars = ax.bar(range(len(combos)), total_pips, color=colors, edgecolor="white", linewidth=0.5)

    for bar, val in zip(bars, total_pips):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(),
                f"{val:+.0f}", ha="center", va="bottom" if val >= 0 else "top",
                fontsize=8, fontweight="bold")

    ax.set_xticks(range(len(combos)))
    ax.set_xticklabels(labels, fontsize=8)
    ax.axhline(y=0, color="#9ca3af", linewidth=0.5, linestyle="--")
    ax.set_title("Total Net Pips by (SL, TP) Combination", fontsize=12, fontweight="bold")
    ax.set_xlabel("SL / TP")
    ax.set_ylabel("Total Net Pips")
    ax.grid(True, alpha=0.3, axis="y")
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"  Summary chart saved: {output_path}")
    plt.close(fig)


def save_csv(results: list, metrics: dict, output_path: str = "simulation_results.csv"):
    """Save sim-only results to CSV with config header.

    Excludes non-sim columns (Lots, actual Close Price, Actual P/L $)
    so the file contains only entry data + simulation outcomes.
    """
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["# Sim Config"])
        writer.writerow([f"SL={metrics['sl_pips']} pips, TP={metrics['tp_pips']} pips, "
                         f"Timeframe={metrics['timeframe']}, Mode={metrics['mode']}, Source=cTrader"])
        writer.writerow([])
        writer.writerow(["#", "Open Time", "Symbol", "Direction", "Entry Price",
                         "Sim Result", "Sim Pip P/L", "Sim Exit Price", "Bars", "Notes"])
        for i, r in enumerate(results, 1):
            ot = r["open_time"].strftime("%Y-%m-%d %H:%M") if isinstance(r["open_time"], datetime) else r["open_time"]
            writer.writerow([
                i, ot, r["symbol"], r["direction"],
                r["open_price"],
                r["sim_result"], f"{r['sim_pips']:.1f}",
                f"{r['sim_exit']:.5f}", r["sim_bars"], r["sim_notes"]
            ])
    print(f"  CSV saved: {output_path}")


def save_master_csv(all_combination_results: dict, trades: list, output_path: str):
    """Save wide-format master CSV with per-(SL,TP) outcome columns."""
    if not all_combination_results:
        return

    combos = sorted(all_combination_results.keys())

    cols = ["#", "Open Time", "Symbol", "Direction", "Entry Price"]
    for sl_val, tp_val in combos:
        cols.append(f"result_SL{round(sl_val)}_TP{round(tp_val)}")
        cols.append(f"pips_SL{round(sl_val)}_TP{round(tp_val)}")

    rows = []
    for trade_idx in range(len(trades)):
        row = []
        t = trades[trade_idx]
        ot = t["open_time"].strftime("%Y-%m-%d %H:%M") if isinstance(t["open_time"], datetime) else str(t["open_time"])
        row.extend([
            trade_idx + 1, ot, t["symbol"], t["direction"],
            t["open_price"],
        ])
        for sl_val, tp_val in combos:
            res_list, _ = all_combination_results[(sl_val, tp_val)]
            if trade_idx < len(res_list):
                r = res_list[trade_idx]
                row.append(r["sim_result"])
                row.append(f"{r['sim_pips']:.1f}")
            else:
                row.append("N/A")
                row.append("N/A")
        rows.append(row)

    df = pd.DataFrame(rows, columns=cols)
    df.to_csv(output_path, index=False)
    print(f"  Master CSV saved: {output_path}")


# ============================================================
# Main
# ============================================================

def read_xlsx(filepath: str) -> str:
    """Read first sheet of an XLSX file and convert to TSV text."""
    if not openpyxl_installed:
        print("ERROR: openpyxl not installed. Cannot read XLSX. Run: pip install openpyxl")
        sys.exit(1)
    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb.active
    lines = []
    for row in ws.iter_rows(values_only=True):
        line = "\t".join(str(v) if v is not None else "" for v in row)
        lines.append(line)
    wb.close()
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="SL/TP Walk-Forward Analyzer — Test trade parameters against real OHLC data from cTrader",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python sl_tp_analyzer.py Trade_Log_Pips_Full.xlsx --sl 30 --tp 50
  python sl_tp_analyzer.py Trade_Log_Pips_Full.xlsx --sl 25 --tp 40 --mode neutral --backend http://localhost:8080
  python sl_tp_analyzer.py trades.csv --timeframe 15m --mode neutral --no-chart
        """)
    parser.add_argument("file", help="Trade log file (XLSX / CSV / TSV)")
    parser.add_argument("--sl", type=parse_value_list, default=[25.0],
                        help="Stop loss in pips, comma-separated list (default: [25.0])")
    parser.add_argument("--tp", type=parse_value_list, default=[40.0],
                        help="Take profit in pips, comma-separated list (default: [40.0])")
    parser.add_argument("--timeframe", choices=["15m", "1h", "1d"], default="1h",
                        help="OHLC candle interval (default: 1h)")
    parser.add_argument("--mode", choices=["conservative", "optimistic", "neutral"],
                        default="conservative",
                        help="Ambiguity handling when both SL & TP in same bar (default: conservative)")
    parser.add_argument("--no-chart", action="store_true", help="Skip generating chart PNG")
    parser.add_argument("--no-csv", action="store_true", help="Skip saving results CSV")
    parser.add_argument("--output", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "results"),
                        help="Output directory for chart/CSV (default: backtester/results/)")
    parser.add_argument("--fx-only", action="store_true", help="Only process FX pairs (skip metals, oil, indices, crypto)")
    parser.add_argument("--backend", default="http://localhost:8080",
                        help="cTrader backend URL (default: http://localhost:8080)")
    parser.add_argument("--max-bars", type=int, default=None,
                        help="Max OHLC bars per trade (default: 2000 for 5m/15m/30m, 500 for 1h, 60 for 1d)")
    parser.add_argument("--n-trades", type=int, default=None,
                        help="Process only the last N trades (default: all)")
    parser.add_argument("--sl-map", default=None,
                        help="Per-symbol SL override file (SYMBOL=PIP format, e.g. data/sl_by_pair.txt)")
    parser.add_argument("--sl-range", default=None,
                        help="SL range sweep as min:max:step (e.g. 20:40:5)")
    parser.add_argument("--tp-range", default=None,
                        help="TP range sweep as min:max:step (e.g. 30:80:10)")
    parser.add_argument("--inspect-trade", type=int, default=None,
                        help="Inspect a specific trade by ID")

    args = parser.parse_args()

    # Validate: --sl-range and --sl are mutually exclusive
    if args.sl_range and (len(args.sl) > 1 or args.sl[0] != 25.0):
        parser.error("Cannot use --sl-range together with a non-default --sl list")
    if args.tp_range and (len(args.tp) > 1 or args.tp[0] != 40.0):
        parser.error("Cannot use --tp-range together with a non-default --tp list")

    # Parse range strings into explicit lists
    def parse_range(range_str):
        parts = range_str.split(":")
        if len(parts) != 3:
            parser.error(f"Range must be in min:max:step format, got: {range_str}")
        rmin, rmax, rstep = float(parts[0]), float(parts[1]), float(parts[2])
        if rstep <= 0:
            parser.error(f"Step must be positive, got: {rstep}")
        if rmin > rmax:
            parser.error(f"Min ({rmin}) must not exceed max ({rmax})")
        count = int((rmax - rmin) / rstep) + 1
        return [rmin + i * rstep for i in range(count)]

    sl_values = parse_range(args.sl_range) if args.sl_range else args.sl
    tp_values = parse_range(args.tp_range) if args.tp_range else args.tp

    mode_label = "range-sweep" if (args.sl_range or args.tp_range) else "single"

    print(f"\n{'=' * 60}")
    print(f"  SL/TP WALK-FORWARD ANALYZER")
    print(f"{'=' * 60}")
    print(f"  Trade log:  {args.file}")
    print(f"  SL:         {sl_values} pips")
    print(f"  TP:         {tp_values} pips")
    print(f"  Timeframe:  {args.timeframe}")
    print(f"  Mode:       {args.mode} ({mode_label})")
    print(f"  Backend:    {args.backend}")

    sl_map = {}
    if args.sl_map:
        sl_map = load_sl_map(args.sl_map)
        print(f"  SL map:     {len(sl_map)} pairs loaded from {args.sl_map}")

    # Read file
    print(f"\nReading trade log...")
    try:
        if args.file.lower().endswith(".xlsx"):
            text = read_xlsx(args.file)
        else:
            with open(args.file, "r", encoding="utf-8", errors="replace") as f:
                text = f.read()
    except FileNotFoundError:
        print(f"ERROR: File not found: {args.file}")
        sys.exit(1)

    # Parse trades
    print(f"Parsing trades...")
    trades = parse_trade_log(text)
    if not trades:
        print("ERROR: No valid trades parsed from file.")
        sys.exit(1)

    # FX-only filter
    NON_FX = {"XAUUSD", "XAGUSD", "WTI", "BRENT", "USOIL", "UKOIL",
              "SPX500", "US500", "HK50", "HSI", "GER40", "DAX",
              "BTCUSD", "ETHUSD", "DX"}

    def _is_fx(sym: str) -> bool:
        clean = sym.rstrip("p").replace(".f", "").replace(".F", "")
        return clean in PIP_SIZES and clean not in NON_FX

    if args.fx_only:
        filtered = [t for t in trades if _is_fx(t["symbol"])]
        removed = [t for t in trades if not _is_fx(t["symbol"])]
        print(f"FX-only filter: {len(trades)} trades -> {len(filtered)} trades "
              f"(removed {len(removed)} non-FX)")
        trades = filtered

    if args.n_trades is not None:
        print(f"Limiting to last {args.n_trades} trades ({len(trades)} total)")
        trades = trades[-args.n_trades:]

    symbols = sorted(set(t["symbol"] for t in trades))
    print(f"Instruments: {', '.join(symbols)}")
    print(f"Date range: {trades[0]['open_time'].strftime('%Y-%m-%d')} to {trades[-1]['open_time'].strftime('%Y-%m-%d')}")

    # Run simulation for each (SL, TP) combination
    print(f"\nRunning simulation with cTrader historical OHLC data...")
    all_combination_results = {}  # (sl, tp) -> (results_list, metrics_dict)
    ohlc_cache.clear()  # reuse cache across all combos

    total_combos = len(sl_values) * len(tp_values)
    combo_count = 0
    for sl_val in sl_values:
        for tp_val in tp_values:
            combo_count += 1
            print(f"  [{combo_count}/{total_combos}] SL={sl_val} TP={tp_val}...", end=" ", flush=True)
            results, metrics = simulate_trades(trades, sl_val, tp_val, args.timeframe, args.mode, args.backend, sl_map)
            all_combination_results[(sl_val, tp_val)] = (results, metrics)
            print("done")

    # Output
    print_results(results, metrics)

    is_range = args.sl_range or args.tp_range or len(sl_values) > 1 or len(tp_values) > 1
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    if is_range:
        print_grid_summary(all_combination_results)
    if args.inspect_trade is not None:
        inspect_trade_grid(all_combination_results, trades, args.inspect_trade)

    cfg = f"SL{round(sl_values[0])}_TP{round(tp_values[0])}_{args.timeframe}_{args.mode}"
    if is_range:
        sl_label = f"SL{round(sl_values[0])}-{round(sl_values[-1])}"
        tp_label = f"TP{round(tp_values[0])}-{round(tp_values[-1])}"
        cfg = f"{sl_label}_{tp_label}_{args.timeframe}_{args.mode}"

    if not args.no_chart:
        os.makedirs(args.output, exist_ok=True)
        chart_path = os.path.join(args.output, f"cumulative_pips_{cfg}_{ts}.png")
        plot_cumulative(results, metrics, chart_path)

        if is_range:
            summary_chart_path = os.path.join(args.output, f"summary_chart_{cfg}_{ts}.png")
            plot_summary_chart(all_combination_results, summary_chart_path)

    if not args.no_csv:
        os.makedirs(args.output, exist_ok=True)
        csv_path = os.path.join(args.output, f"simulation_results_{cfg}_{ts}.csv")
        save_csv(results, metrics, csv_path)

        if is_range:
            master_path = os.path.join(args.output, f"master_results_{cfg}_{ts}.csv")
            save_master_csv(all_combination_results, trades, master_path)


if __name__ == "__main__":
    main()
