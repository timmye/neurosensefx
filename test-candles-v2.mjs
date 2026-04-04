import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8080';
const TIMEOUT = 60000; // 1 min as requested
const SYMBOL = 'EURUSD';

const results = {
  ticks: 0,
  m1Updates: 0,
  h4Updates: 0,
  d1Updates: 0,
  h4History: null,
  d1History: null,
  m1History: null,
  errors: [],
  priceChecks: [],
};

const ws = new WebSocket(WS_URL);
const startTime = Date.now();

ws.on('open', () => {
  console.log(`[${elapsed()}s] Connected. Running ${TIMEOUT/1000}s test...`);

  // Subscribe to ticks
  send({ type: 'subscribe', symbol: SYMBOL });

  // Fetch historical candles for all 3 timeframes
  const now = Date.now();
  send({ type: 'getHistoricalCandles', symbol: SYMBOL, resolution: '1m', from: now - 86400000, to: now });
  send({ type: 'getHistoricalCandles', symbol: SYMBOL, resolution: '4h', from: now - 7776000000, to: now });
  send({ type: 'getHistoricalCandles', symbol: SYMBOL, resolution: 'D', from: now - 31536000000, to: now });

  // Subscribe to candle updates
  send({ type: 'subscribeCandles', symbol: SYMBOL, resolution: '1m' });
  send({ type: 'subscribeCandles', symbol: SYMBOL, resolution: '4h' });
});

function send(msg) {
  ws.send(JSON.stringify(msg));
}

function elapsed() {
  return ((Date.now() - startTime) / 1000).toFixed(1);
}

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  const t = elapsed();

  if (msg.type === 'tick') {
    results.ticks++;
    if (results.ticks <= 3) console.log(`[${t}s] TICK: ${msg.symbol} bid=${msg.bid} ask=${msg.ask}`);
  }
  else if (msg.type === 'candleUpdate') {
    const bar = msg.bar;
    if (msg.timeframe === 'M1') {
      results.m1Updates++;
      if (results.m1Updates <= 3) console.log(`[${t}s] M1 UPDATE: ts=${bar.timestamp} close=${bar.close}`);
    } else if (msg.timeframe === 'H4') {
      results.h4Updates++;
      if (results.h4Updates <= 3) console.log(`[${t}s] H4 UPDATE: ts=${bar.timestamp} close=${bar.close}`);
    } else if (msg.timeframe === 'D1') {
      results.d1Updates++;
      if (results.d1Updates <= 3) console.log(`[${t}s] D1 UPDATE: ts=${bar.timestamp} close=${bar.close}`);
    }
    // Cross-check price against latest tick
    if (results.ticks > 0 && results.m1Updates > 0) {
      results.priceChecks.push({ tick: msg.bar?.close, m1: msg.bar?.close });
    }
  }
  else if (msg.type === 'candleHistory') {
    const bars = msg.bars || [];
    const firstTs = bars.length > 0 ? new Date(bars[0].timestamp).toISOString() : 'N/A';
    const lastTs = bars.length > 0 ? new Date(bars[bars.length - 1].timestamp).toISOString() : 'N/A';
    const lastClose = bars.length > 0 ? bars[bars.length - 1].close : 'N/A';
    console.log(`[${t}s] HISTORY ${msg.resolution}: ${bars.length} bars, ${firstTs} → ${lastTs}, lastClose=${lastClose}`);

    if (msg.resolution === '4h') results.h4History = { count: bars.length, lastTs, lastClose, firstTs };
    if (msg.resolution === 'D') results.d1History = { count: bars.length, lastTs, lastClose, firstTs };
    if (msg.resolution === '1m') results.m1History = { count: bars.length, lastTs, lastClose, firstTs };

    // CRITICAL CHECK: Is the last bar recent?
    if (bars.length > 0) {
      const lastBarTime = bars[bars.length - 1].timestamp;
      const ageMs = Date.now() - lastBarTime;
      const ageHours = (ageMs / 3600000).toFixed(1);
      const isRecent = ageMs < 86400000; // within 24h
      console.log(`[${t}s]   → Last bar age: ${ageHours}h (${isRecent ? 'RECENT ✅' : 'STALE ❌'})`);
      if (!isRecent) results.errors.push(`${msg.resolution} history is ${ageHours}h old`);
    }
  }
  else if (msg.type === 'error') {
    results.errors.push(msg.message || msg.error || JSON.stringify(msg));
    console.log(`[${t}s] ERROR: ${JSON.stringify(msg)}`);
  }
  else if (msg.type === 'ready') {
    console.log(`[${t}s] Backend ready`);
  }
});

ws.on('error', (err) => {
  console.error(`[${elapsed()}s] WS ERROR: ${err.message}`);
});

ws.on('close', () => {
  console.log(`[${elapsed()}s] Connection closed`);
});

// Print summary at timeout
setTimeout(() => {
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Duration: ${elapsed()}s`);
  console.log(`Ticks: ${results.ticks}`);
  console.log(`M1 candle updates: ${results.m1Updates}`);
  console.log(`H4 candle updates: ${results.h4Updates}`);
  console.log(`D1 candle updates: ${results.d1Updates}`);
  console.log(`H4 history: ${results.h4History?.count || 'NONE'} bars, last=${results.h4History?.lastTs || 'N/A'}`);
  console.log(`D1 history: ${results.d1History?.count || 'NONE'} bars, last=${results.d1History?.lastTs || 'N/A'}`);
  console.log(`M1 history: ${results.m1History?.count || 'NONE'} bars, last=${results.m1History?.lastTs || 'N/A'}`);
  console.log(`Errors: ${results.errors.length > 0 ? results.errors.join(', ') : 'NONE ✅'}`);

  // Pass/fail
  let pass = true;
  if (results.ticks === 0) { console.log('FAIL: No ticks received'); pass = false; }
  if (results.m1Updates === 0) { console.log('FAIL: No M1 candle updates'); pass = false; }
  if (results.h4History?.count === 0 || !results.h4History) { console.log('FAIL: No H4 history'); pass = false; }
  if (results.d1History?.count === 0 || !results.d1History) { console.log('FAIL: No D1 history'); pass = false; }
  if (results.errors.length > 0) { console.log('WARN: Errors detected'); }

  console.log(`\nResult: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  ws.close();
  process.exit(pass ? 0 : 1);
}, TIMEOUT);
