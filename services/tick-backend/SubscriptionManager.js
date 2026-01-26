/**
 * SubscriptionManager - Tracks client and backend subscriptions
 * Manages client subscriptions per WebSocket and backend symbol subscriptions
 */
class SubscriptionManager {
    constructor() {
        this.clientSubscriptions = new Map(); // ws -> Set<symbol>
        this.backendSubscriptions = new Map(); // "symbol:source" -> Set<ws>
        this.m1BarSubscriptions = new Set(); // "symbol:source" for M1 bars
    }

    /**
     * Add a client subscription for a symbol from a specific source
     * @param {string} symbol - Symbol identifier
     * @param {string} source - Data source ('ctrader' or 'tradingview')
     * @param {WebSocket} client - Client WebSocket connection
     */
    addClientSubscription(symbol, source, client) {
        const clientSubs = this.clientSubscriptions.get(client);
        if (!clientSubs) {
            this.clientSubscriptions.set(client, new Set([symbol]));
        } else if (!clientSubs.has(symbol)) {
            clientSubs.add(symbol);
        }

        const key = `${symbol}:${source}`;
        let symbolSubscribers = this.backendSubscriptions.get(key);
        if (!symbolSubscribers) {
            symbolSubscribers = new Set();
            this.backendSubscriptions.set(key, symbolSubscribers);
        }
        symbolSubscribers.add(client);

        return symbolSubscribers.size === 1; // Returns true if first subscriber
    }

    /**
     * Add a backend subscription for M1 bars
     * @param {string} symbol - Symbol identifier
     * @param {string} source - Data source
     */
    addBackendSubscription(symbol, source) {
        const key = `${symbol}:${source}`;
        if (!this.m1BarSubscriptions.has(key)) {
            this.m1BarSubscriptions.add(key);
            return true; // First subscription
        }
        return false;
    }

    /**
     * Get clients subscribed to a symbol from a specific source
     * @param {string} symbol - Symbol identifier
     * @param {string} source - Data source
     * @returns {Set|undefined} Set of subscribed clients
     */
    getSubscribedClients(symbol, source) {
        const key = `${symbol}:${source}`;
        return this.backendSubscriptions.get(key);
    }

    /**
     * Remove all subscriptions for a client
     * @param {WebSocket} client - Client WebSocket connection
     * @returns {Array} Array of symbols the client was subscribed to
     */
    removeClient(client) {
        const subscriptions = Array.from(this.clientSubscriptions.get(client) || []);

        // Remove client from all backend subscriptions
        for (const [key, subscribers] of this.backendSubscriptions) {
            if (subscribers.has(client)) {
                subscribers.delete(client);
                if (subscribers.size === 0) {
                    this.backendSubscriptions.delete(key);
                }
            }
        }

        this.clientSubscriptions.delete(client);
        return subscriptions;
    }

    /**
     * Remove a specific subscription for a client
     * @param {WebSocket} client - Client WebSocket connection
     * @param {string} symbol - Symbol to unsubscribe from
     * @returns {Array} Array of keys that now have zero subscribers
     */
    removeClientSubscription(client, symbol) {
        const clientSubs = this.clientSubscriptions.get(client);
        if (!clientSubs || !clientSubs.has(symbol)) {
            return [];
        }

        clientSubs.delete(symbol);

        const emptyKeys = [];
        const ctraderKey = `${symbol}:ctrader`;
        const tradingviewKey = `${symbol}:tradingview`;

        for (const key of [ctraderKey, tradingviewKey]) {
            const symbolSubscribers = this.backendSubscriptions.get(key);
            if (symbolSubscribers && symbolSubscribers.has(client)) {
                symbolSubscribers.delete(client);
                if (symbolSubscribers.size === 0) {
                    emptyKeys.push(key);
                    this.backendSubscriptions.delete(key);
                }
            }
        }

        return emptyKeys;
    }

    /**
     * Check if M1 bar subscription exists
     * @param {string} symbol - Symbol identifier
     * @param {string} source - Data source
     * @returns {boolean} True if subscription exists
     */
    hasM1BarSubscription(symbol, source) {
        const key = `${symbol}:${source}`;
        return this.m1BarSubscriptions.has(key);
    }

    /**
     * Get all symbols a client is subscribed to
     * @param {WebSocket} client - Client WebSocket connection
     * @returns {Set} Set of symbols
     */
    getClientSubscriptions(client) {
        return this.clientSubscriptions.get(client) || new Set();
    }
}

module.exports = { SubscriptionManager };
