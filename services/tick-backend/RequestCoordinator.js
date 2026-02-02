/**
 * RequestCoordinator - Handles request coalescing and retry logic
 * Manages pending requests to avoid duplicate API calls
 */
const { calculateBucketSizeForSymbol } = require('./MarketProfileService');

class RequestCoordinator {
    constructor(wsServer, fetchTimeout = 30000) {
        this.wsServer = wsServer;
        this.fetchTimeout = fetchTimeout;
        this.pendingRequests = new Map(); // "symbol:adr" -> {promise, clients[]}
        this.MAX_RETRIES = 3;
        this.INITIAL_RETRY_DELAY_MS = 500;
    }

    /**
     * Handle a subscription request with coalescing
     * @param {string} symbol - Symbol to fetch
     * @param {number} adrLookbackDays - ADR lookback period
     * @param {string} source - Data source ('ctrader' or 'tradingview')
     * @param {WebSocket} client - Client making the request
     */
    async handleRequest(symbol, adrLookbackDays, source, client) {
        if (source === 'tradingview') {
            return this.handleTradingViewRequest(symbol, adrLookbackDays, client);
        }

        return this.handleCTraderRequest(symbol, adrLookbackDays, client);
    }

    /**
     * Handle cTrader subscription request with retry logic
     * @param {string} symbol - Symbol to fetch
     * @param {number} adrLookbackDays - ADR lookback period
     * @param {WebSocket} client - Client making the request
     */
    async handleCTraderRequest(symbol, adrLookbackDays, client) {
        const requestKey = `${symbol}:${adrLookbackDays}`;

        const existingRequest = this.checkCoalescing(requestKey, client);
        if (existingRequest) return existingRequest;

        const clients = [client];
        const fetchPromise = this.fetchWithRetry(symbol, adrLookbackDays, requestKey, clients);
        this.pendingRequests.set(requestKey, { promise: fetchPromise, clients });
        return fetchPromise;
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
            console.log(`[COALESCE] Joining pending request for ${requestKey} (${pending.clients.length} clients)`);
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
     * @returns {Promise<Object>} Symbol data package
     */
    async fetchWithRetry(symbol, adrLookbackDays, requestKey, clients) {
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const attemptFetch = async (retries = 0) => {
            try {
                console.log(`[DEBUGGER:RequestCoordinator:fetchWithRetry:76] Attempting fetch for symbol=${symbol}, adrLookbackDays=${adrLookbackDays}, retry=${retries}`);
                const data = await this.wsServer.cTraderSession.getSymbolDataPackage(symbol, adrLookbackDays);
                console.log(`[DEBUGGER:RequestCoordinator:fetchWithRetry:78] Fetch SUCCESS for ${symbol}, got data with ${data.initialMarketProfile?.length || 0} profile entries`);
                console.log(`[COALESCE] Sending ${requestKey} to ${clients.length} clients${retries > 0 ? ` (after ${retries} retries)` : ''}`);
                console.log(`[E2E_TRACE | RequestCoordinator] Sending package with ${data.initialMarketProfile.length} profile entries.`);

                this.sendDataToClients(data, clients);
                this.pendingRequests.delete(requestKey);
                return data;
            } catch (error) {
                return this.handleFetchError(error, symbol, requestKey, clients, retries, sleep, attemptFetch);
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
        console.log(`[DEBUGGER:RequestCoordinator:sendDataToClients:97] Called with symbol=${data.symbol}, clients=${clients.length}, source=${data.source || 'ctrader'}`);
        // Determine source from data package
        const source = data.source || 'ctrader';

        // After receiving symbolDataPackage, initialize TWAP and Market Profile from history
        if (data.initialMarketProfile) {
            console.log(`[RequestCoordinator] Initializing TWAP for ${data.symbol}:${source} with ${data.initialMarketProfile.length} bars`);
            try {
                this.wsServer.twapService.initializeFromHistory(
                    data.symbol,
                    data.initialMarketProfile,
                    source
                );
                console.log(`[RequestCoordinator] TWAP initialized for ${data.symbol}:${source}`);
            } catch (error) {
                console.error(`[RequestCoordinator] TWAP initialization failed for ${data.symbol}:`, error);
            }

            console.log(`[RequestCoordinator] Initializing Market Profile for ${data.symbol}:${source} with ${data.initialMarketProfile.length} bars`);
            try {
                const bucketSize = calculateBucketSizeForSymbol(data.symbol);
                this.wsServer.marketProfileService.initializeFromHistory(
                    data.symbol,
                    data.initialMarketProfile,
                    bucketSize,
                    source
                );
                console.log(`[RequestCoordinator] Market Profile initialized for ${data.symbol}:${source}`);
            } catch (error) {
                console.error(`[RequestCoordinator] Market Profile initialization failed for ${data.symbol}:`, error);
            }
        }

        clients.forEach((client, index) => {
            console.log(`[DEBUGGER:RequestCoordinator:sendDataToClients:117] Sending symbolDataPackage to client ${index + 1}/${clients.length} for symbol=${data.symbol}`);
            this.wsServer.sendToClient(client, {
                type: 'symbolDataPackage',
                source: 'ctrader',
                symbol: data.symbol,
                digits: data.digits,
                adr: data.adr,
                todaysOpen: data.todaysOpen,
                todaysHigh: data.todaysHigh,
                todaysLow: data.todaysLow,
                projectedAdrHigh: data.projectedAdrHigh,
                projectedAdrLow: data.projectedAdrLow,
                initialPrice: data.initialPrice,
                initialMarketProfile: data.initialMarketProfile || [],
                pipPosition: data.pipPosition,
                pipSize: data.pipSize,
                pipetteSize: data.pipetteSize,
                ...(data.prevDayOpen !== undefined && { prevDayOpen: data.prevDayOpen }),
                ...(data.prevDayHigh !== undefined && { prevDayHigh: data.prevDayHigh }),
                ...(data.prevDayLow !== undefined && { prevDayLow: data.prevDayLow }),
                ...(data.prevDayClose !== undefined && { prevDayClose: data.prevDayClose })
            });
        });
        console.log(`[DEBUGGER:RequestCoordinator:sendDataToClients:139] Completed sending to all ${clients.length} clients`);
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
    async handleFetchError(error, symbol, requestKey, clients, retries, sleep, attemptFetch) {
        const isRateLimit = error.errorCode === 'REQUEST_FREQUENCY_EXCEEDED';
        const isBlocked = error.errorCode === 'BLOCKED_PAYLOAD_TYPE';

        if ((isRateLimit || isBlocked) && retries < this.MAX_RETRIES) {
            const delayMs = this.INITIAL_RETRY_DELAY_MS * Math.pow(2, retries);
            const errorType = isRateLimit ? 'Rate limit' : 'Blocked payload';
            console.log(`[COALESCE] ${errorType} for ${requestKey}, retry ${retries + 1}/${this.MAX_RETRIES} after ${delayMs}ms`);
            await sleep(delayMs);
            return attemptFetch(retries + 1);
        }

        console.error(`[COALESCE] Failed ${requestKey} after ${retries} retries:`, error);
        this.pendingRequests.delete(requestKey);

        if (isRateLimit) {
            this.notifyClientsError(clients, symbol, error);
        }

        throw error;
    }

    /**
     * Notify clients of fetch failure
     * @param {Array} clients - Clients to notify
     * @param {string} symbol - Symbol that failed
     * @param {Error} error - Error details
     */
    notifyClientsError(clients, symbol, error) {
        clients.forEach(client => {
            this.wsServer.sendToClient(client, {
                type: 'error',
                message: `Failed to get data for ${symbol}: ${error.message || error.description}`,
                symbol: symbol
            });
        });
    }

    /**
     * Handle TradingView subscription request
     * @param {string} symbol - Symbol to fetch
     * @param {number} adrLookbackDays - ADR lookback period
     * @param {WebSocket} client - Client making the request
     */
    async handleTradingViewRequest(symbol, adrLookbackDays, client) {
        try {
            await this.wsServer.tradingViewSession.subscribeToSymbol(symbol, adrLookbackDays);
        } catch (error) {
            console.error(`Failed to get TradingView data for ${symbol}:`, error);
            this.wsServer.sendToClient(client, {
                type: 'error',
                message: `Failed to get TradingView data for ${symbol}: ${error.message}`,
                symbol: symbol
            });
            throw error;
        }
    }

    /**
     * Resolve a pending request (call when data is received)
     * @param {string} symbol - Symbol identifier
     * @param {number} adrLookbackDays - ADR lookback period
     */
    resolveRequest(symbol, adrLookbackDays) {
        const requestKey = `${symbol}:${adrLookbackDays}`;
        this.pendingRequests.delete(requestKey);
    }
}

module.exports = { RequestCoordinator };
