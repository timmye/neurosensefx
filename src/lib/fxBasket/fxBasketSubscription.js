// FX Basket Subscription Management - Crystal Clarity Compliant
// Batch subscription with rate limit handling for cTrader API

// Subscribe to multiple FX pairs with rate limit delays (2.5 req/sec under 5 req/sec limit)
async function batchSubscribe(connectionManager, pairs, callback) {
  const REQUEST_DELAY_MS = 400;
  const subscriptions = [];

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const unsub = connectionManager.subscribeAndRequest(pair, callback, 14, 'ctrader');
    subscriptions.push(unsub);
    if (i < pairs.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return subscriptions;
}

export { batchSubscribe };

// Promise-based delay for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
