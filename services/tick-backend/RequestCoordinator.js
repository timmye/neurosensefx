/**
 * RequestCoordinator - Handles request coalescing and retry logic
 * Manages pending requests to avoid duplicate API calls
 */
const { calculateBucketSizeForSymbol } = require('./MarketProfileService');
const { buildPrevDayFields } = require('./utils/MessageBuilder');
const { createLogger, describeError } = require('./utils/Logger');
const log = createLogger('RequestCoordinator');

class RequestCoordinator {
    constructor(wsServer, fetchTimeout = 30000) {
        this.wsServer = wsServer;
        this.fetchTimeout = fetchTimeout;
        this.pendingRequests = new Map(); // "symbol:adr" -> {promise, clients[]}
        // symbol -> { clients: Set<ws>, onCompletes: Map<ws, Function|null> }
        // One entry per in-flight symbol. A single 'candle' listener + timeout +
        // subscribeToSymbol call serves ALL waiting clients for that symbol, so
        // concurrent requests for the same symbol never stack duplicate listeners
        // (which would trip MaxListenersExceededWarning). onCompletes preserves
        // each client's completion callback (kept non-null across callers even
        // though the TV branch of onDataReceived is currently a no-op).
        this.pendingTradingViewRequests = new Map();
        this.MAX_RETRIES = 3;
        this.INITIAL_RETRY_DELAY_MS = 500;
        this._queue = [];
        this._processing = false;
        this._MIN_REQUEST_INTERVAL_MS = 300;
        // TradingView subscription queue -- prevents IP ban from burst subscriptions
        this._tvQueue = [];
        this._tvProcessing = false;
        this._TV_MIN_INTERVAL_MS = 500; // 500ms between TradingView subscriptions (safe per community evidence)
    }

    /**
     * Handle a subscription request with coalescing
     * @param {string} symbol - Symbol to fetch
     * @param {number} adrLookbackDays - ADR lookback period
     * @param {string} source - Data source ('ctrader' or 'tradingview')
     * @param {WebSocket} client - Client making the request
     * @param {Function} onComplete - Optional callback called after data is sent to clients
     */
    async handleRequest(symbol, adrLookbackDays, source, client, onComplete = null) {
        if (source === 'tradingview') {
            return this.handleTradingViewRequest(symbol, adrLookbackDays, client, onComplete);
        }

        return this.handleCTraderRequest(symbol, adrLookbackDays, client, source, onComplete);
    }

    /**
     * Handle cTrader subscription request with retry logic
     * @param {string} symbol - Symbol to fetch
     * @param {number} adrLookbackDays - ADR lookback period
     * @param {WebSocket} client - Client making the request
     * @param {Function} onComplete - Optional callback called after data is sent to clients
     */
    async handleCTraderRequest(symbol, adrLookbackDays, client, source = 'ctrader', onComplete = null) {
        const requestKey = `${symbol}:${adrLookbackDays}`;

        const existingRequest = this.checkCoalescing(requestKey, client);
        if (existingRequest) return existingRequest;

        const clients = [client];
        const fetchPromise = this._enqueue(() =>
            this.fetchWithRetry(symbol, adrLookbackDays, requestKey, clients, source, onComplete)
        );
        this.pendingRequests.set(requestKey, { promise: fetchPromise, clients });
        return fetchPromise;
    }

    /**
     * Enqueue an arbitrary async function through the rate-limited queue.
     * Uses the same _enqueue/_processQueue mechanism as handleCTraderRequest
     * to ensure minimum interval between cTrader API calls.
     * @param {Function} fn - Async function to execute
     * @param {number} [timeout] - Optional custom timeout in ms (default: this.fetchTimeout)
     * @returns {Promise} Result of fn()
     */
    async enqueueDirect(fn, timeout) {
        if (timeout && timeout !== this.fetchTimeout) {
            return new Promise((resolve, reject) => {
                this._queue.push({
                    fn: async () => Promise.race([
                        fn(),
                        new Promise((_, rj) => setTimeout(() => rj(new Error('Request timed out')), timeout))
                    ]),
                    resolve,
                    reject,
                    skipTimeout: true
                });
                this._processQueue();
            });
        }
        return this._enqueue(fn);
    }

    /**
     * Queue a request for rate-limited execution
     * Ensures minimum interval between cTrader API calls
     */
    _enqueue(fn) {
        return new Promise((resolve, reject) => {
            this._queue.push({ fn, resolve, reject });
            this._processQueue();
        });
    }

    /**
     * Process queued requests with minimum interval between starts.
     * Each request has a per-request timeout to prevent hung API calls from stalling the queue.
     */
    async _processQueue() {
        if (this._processing) return;
        this._processing = true;
        while (this._queue.length > 0) {
            const { fn, resolve, reject, skipTimeout } = this._queue.shift();
            try {
                let result;
                if (skipTimeout) {
                    result = await fn();
                } else {
                    result = await Promise.race([
                        fn(),
                        new Promise((_, rj) => setTimeout(() => rj(new Error('Request timed out')), this.fetchTimeout))
                    ]);
                }
                resolve(result);
            } catch (error) {
                reject(error);
            }
            if (this._queue.length > 0) {
                await new Promise(r => setTimeout(r, this._MIN_REQUEST_INTERVAL_MS));
            }
        }
        this._processing = false;
    }

    /**
     * Check for existing pending request to coalesce
     * @param {string} requestKey - Unique request identifier
     * @param {WebSocket} client - Client making the request
     * @returns {Promise|undefined} Existing promise if coalescing
     */
    checkCoalescing(requestKey, client) {
        if (this.pendingRequests.has(requestKey)) {
            const pending = this.pendingRequests.get(requestKey);
            pending.clients.push(client);
            return pending.promise;
        }
        return null;
    }

    /**
     * Fetch symbol data with exponential backoff retry
     * @param {string} symbol - Symbol to fetch
     * @param {number} adrLookbackDays - ADR lookback period
     * @param {string} requestKey - Request identifier for logging
     * @param {Array} clients - Clients awaiting this data
     * @param {Function} onComplete - Optional callback called after data is sent to clients
     * @returns {Promise<Object>} Symbol data package
     */
    async fetchWithRetry(symbol, adrLookbackDays, requestKey, clients, source = 'ctrader', onComplete = null) {
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const attemptFetch = async (retries = 0) => {
            try {
                const data = await this.wsServer.cTraderSession.getSymbolDataPackage(symbol, adrLookbackDays);

                this.sendDataToClients(data, clients);
                this.pendingRequests.delete(requestKey);

                // Call completion callback after data is sent
                if (onComplete) {
                    try {
                        onComplete();
                    } catch (error) {
                        log.error(`Completion callback error for ${symbol}:`, error);
                    }
                }

                return data;
            } catch (error) {
                return this.handleFetchError(error, symbol, requestKey, clients, source, retries, sleep, attemptFetch);
            }
        };

        return attemptFetch();
    }

    /**
     * Send symbol data package to multiple clients
     * @param {Object} data - Symbol data package
     * @param {Array} clients - Clients to send to
     */
    sendDataToClients(data, clients) {
        // Determine source from data package
        const source = data.source || 'ctrader';

        // IMPORTANT: Send symbolDataPackage FIRST, before initializing services that emit profileUpdate
        // This prevents a race condition where profileUpdate arrives before price data, causing
        // the frontend mini market profile to render with null currentPrice/openPrice values
        clients.forEach((client, index) => {
            this.wsServer.sendToClient(client, {
                type: 'symbolDataPackage',
                source: source,
                symbol: data.symbol,
                digits: data.digits,
                adr: data.adr,
                todaysOpen: data.todaysOpen,
                todaysHigh: data.todaysHigh,
                todaysLow: data.todaysLow,
                projectedAdrHigh: data.projectedAdrHigh,
                projectedAdrLow: data.projectedAdrLow,
                initialPrice: data.initialPrice,
                pipPosition: data.pipPosition,
                pipSize: data.pipSize,
                pipetteSize: data.pipetteSize,
                ...buildPrevDayFields({ open: data.prevDayOpen, high: data.prevDayHigh, low: data.prevDayLow, close: data.prevDayClose })
            });
        });

        // After sending symbolDataPackage, initialize TWAP and Market Profile from history
        // This ensures profileUpdate events are emitted AFTER clients have price data
        if (data.initialMarketProfile) {
            try {
                this.wsServer.twapService.initializeFromHistory(
                    data.symbol,
                    data.initialMarketProfile,
                    source
                );
            } catch (error) {
                log.error(`TWAP initialization failed for ${data.symbol}:`, error);
            }

            try {
                const bucketSize = calculateBucketSizeForSymbol(data.symbol, data.initialPrice);
                this.wsServer.marketProfileService.initializeFromHistory(
                    data.symbol,
                    data.initialMarketProfile,
                    bucketSize,
                    source
                );
            } catch (error) {
                log.error(`Market Profile initialization failed for ${data.symbol}:`, error);
            }
        }
    }

    /**
     * Handle fetch errors with retry logic or client notification
     * @param {Error} error - Fetch error
     * @param {string} symbol - Symbol being fetched
     * @param {string} requestKey - Request identifier
     * @param {Array} clients - Clients awaiting data
     * @param {number} retries - Current retry count
     * @param {Function} sleep - Sleep utility
     * @param {Function} attemptFetch - Retry function
     */
    async handleFetchError(error, symbol, requestKey, clients, source, retries, sleep, attemptFetch) {
        const isRateLimit = error.errorCode === 'REQUEST_FREQUENCY_EXCEEDED';
        const isBlocked = error.errorCode === 'BLOCKED_PAYLOAD_TYPE';

        if ((isRateLimit || isBlocked) && retries < this.MAX_RETRIES) {
            const delayMs = this.INITIAL_RETRY_DELAY_MS * Math.pow(2, retries);
            await sleep(delayMs);
            return attemptFetch(retries + 1);
        }

        log.error(`Failed ${requestKey} after ${retries} retries:`, describeError(error));
        this.pendingRequests.delete(requestKey);

        // Notify clients of all errors (not just rate limits) so frontend can track failed pairs
        this.notifyClientsError(clients, symbol, error, source);

        throw error;
    }

    /**
     * Notify clients of fetch failure
     * @param {Array} clients - Clients to notify
     * @param {string} symbol - Symbol that failed
     * @param {Error} error - Error details
     */
    notifyClientsError(clients, symbol, error, source = 'ctrader') {
        const detail = describeError(error);
        clients.forEach(client => {
            this.wsServer.sendToClient(client, {
                type: 'error',
                message: `Failed to get data for ${symbol}: ${detail}`,
                symbol: symbol,
                source: source
            });
        });
    }

    /**
     * Handle TradingView subscription request
     * Queues the subscription to avoid IP ban from TradingView burst subscriptions.
     * @param {string} symbol - Symbol to fetch
     * @param {number} adrLookbackDays - ADR lookback period
     * @param {WebSocket} client - Client making the request
     * @param {Function} onComplete - Optional callback called after data is sent to clients
     */
    async handleTradingViewRequest(symbol, adrLookbackDays, client, onComplete = null) {
        const tvSession = this.wsServer.tradingViewSession;

        // Track this client (and its completion callback) as waiting for this
        // symbol. The pending entry is created on the first request for a symbol
        // and reused by subsequent requests so only ONE listener / timeout /
        // subscribeToSymbol call is active per symbol at a time.
        let pending = this.pendingTradingViewRequests.get(symbol);
        if (!pending) {
            pending = { clients: new Set(), onCompletes: new Map() };
            this.pendingTradingViewRequests.set(symbol, pending);
        }
        pending.clients.add(client);
        pending.onCompletes.set(client, onComplete);

        // Already a request in flight for this symbol: the existing listener and
        // timeout will deliver data to this client too (via pending.clients) and
        // invoke its onComplete. Do NOT add another listener/timeout/subscribe.
        if (pending.clients.size > 1) {
            return;
        }

        // Use `on` (not `once`) so the listener stays active until the correct symbol's data arrives.
        // `once` would be consumed by a wrong symbol's event, leaving this request stuck forever.
        const onDataPackage = (data) => {
            if (data.symbol === symbol && data.type === 'symbolDataPackage') {
                clearTimeout(timeoutId);
                const entry = this.pendingTradingViewRequests.get(symbol);
                if (entry) {
                    entry.clients.forEach(c => {
                        this.wsServer.sendToClient(c, data);
                    });
                    // Invoke each client's completion callback after its data is sent.
                    entry.onCompletes.forEach((cb, c) => {
                        if (cb) {
                            try {
                                cb();
                            } catch (error) {
                                log.error(`Completion callback error for ${symbol}:`, error);
                            }
                        }
                    });
                    this.pendingTradingViewRequests.delete(symbol);
                }
                tvSession.removeListener('candle', onDataPackage);
            }
        };

        tvSession.on('candle', onDataPackage);

        // Timeout fallback: if no matching candle arrives within fetchTimeout, clean up
        const timeoutId = setTimeout(() => {
            tvSession.removeListener('candle', onDataPackage);
            this.pendingTradingViewRequests.delete(symbol);
            log.error(`TradingView data timeout for ${symbol}`);
            this.wsServer.sendToClient(client, {
                type: 'error',
                message: `Timeout waiting for TradingView data for ${symbol}`,
                symbol: symbol,
                source: 'tradingview'
            });
        }, this.fetchTimeout);

        // Queue the TradingView subscription to avoid IP ban
        return this._enqueueTradingView(async () => {
            // D4: if TV is in a disconnect/reconnect window, skip the subscribe
            // call entirely rather than throw 'Not connected' once per queued
            // request (an 882-line error storm in the incident). The listener +
            // fetchTimeout are already armed; the timeout will clean up the
            // listener and notify this client. No re-attempt is needed because
            // the current model does not re-drain on reconnect.
            if (!tvSession.isConnected()) {
                log.warn(`TradingView not connected; deferring ${symbol} to fetch timeout`);
                return;
            }
            try {
                await tvSession.subscribeToSymbol(symbol, adrLookbackDays);
            } catch (error) {
                clearTimeout(timeoutId);
                log.error(`Failed to get TradingView data for ${symbol}:`, error);
                const entry = this.pendingTradingViewRequests.get(symbol);
                if (entry) {
                    entry.clients.delete(client);
                    entry.onCompletes.delete(client);
                    if (entry.clients.size === 0) {
                        this.pendingTradingViewRequests.delete(symbol);
                    }
                }
                tvSession.removeListener('candle', onDataPackage);
                this.wsServer.sendToClient(client, {
                    type: 'error',
                    message: `Failed to get TradingView data for ${symbol}: ${error.message}`,
                    symbol: symbol,
                    source: 'tradingview'
                });
                throw error;
            }
        });
    }

    /**
     * Enqueue a TradingView subscription with rate limiting.
     * TradingView bans IPs that send too many subscriptions in rapid succession,
     * so we serialize them with a 2s interval between each.
     */
    _enqueueTradingView(fn) {
        return new Promise((resolve, reject) => {
            this._tvQueue.push({ fn, resolve, reject });
            this._processTradingViewQueue();
        });
    }

    /**
     * Process TradingView subscription queue with minimum interval between starts.
     */
    async _processTradingViewQueue() {
        if (this._tvProcessing) return;
        this._tvProcessing = true;
        while (this._tvQueue.length > 0) {
            const { fn, resolve, reject } = this._tvQueue.shift();
            try {
                resolve(await fn());
            } catch (error) {
                reject(error);
            }
            if (this._tvQueue.length > 0) {
                await new Promise(r => setTimeout(r, this._TV_MIN_INTERVAL_MS));
            }
        }
        this._tvProcessing = false;
    }

}

module.exports = { RequestCoordinator };
