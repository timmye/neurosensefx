/**
 * CTrader Symbol Loader - Symbol loading and mapping functionality.
 * Extracted from CTraderSession for single responsibility.
 */

class CTraderSymbolLoader {
    constructor(connection, ctidTraderAccountId) {
        this.connection = connection;
        this.ctidTraderAccountId = ctidTraderAccountId;
        this.symbolMap = new Map();
        this.reverseSymbolMap = new Map();
        this.symbolInfoCache = new Map();
        // True once loadAllSymbols() has succeeded at least once. Used by the
        // session's Phase-3 defer-queue to distinguish a genuinely-absent symbol
        // (resolved-after-refresh vs. still-absent) so it can be logged once and
        // skipped rather than retried forever.
        this.loadedOnce = false;
    }

    /**
     * Re-bind the underlying connection on a reconnect WITHOUT recreating the
     * loader (Phase 2.1 / Loop-G). The maps + symbolInfoCache survive, so:
     *   - restore can resolve symbolIds against the existing map immediately;
     *   - symbolInfoCache is reused (no ~60 re-fetched SymbolByIdReq across
     *     reconnects — the root amplifier of Loop-E/G).
     * @param {Object} connection
     */
    setConnection(connection) {
        this.connection = connection;
    }

    /**
     * Normalize a cTrader symbol name for lookup.
     * Strips slashes and known broker suffixes (.P, .F, .I, etc.)
     * so the frontend's plain format matches (e.g. "USD/JPY.P" → "USDJPY").
     * Prefers plain variants over suffixed ones when both exist.
     */
    static normalizeName(raw) {
        return raw.replace(/\//g, '').replace(/\.[A-Za-z]+\d*$/g, '');
    }

    /**
     * Load all available symbols from cTrader.
     * Populates symbolMap and reverseSymbolMap for bidirectional lookup.
     * Normalizes symbol names by stripping slashes and broker suffixes
     * so lookups match the format used by the frontend.
     */
    async loadAllSymbols() {
        const response = await this.connection.sendCommand('ProtoOASymbolsListReq', {
            ctidTraderAccountId: this.ctidTraderAccountId
        });
        response.symbol.forEach(s => {
            const normalizedName = CTraderSymbolLoader.normalizeName(s.symbolName);
            // Prefer plain variants: if EURUSD and EURUSD.P both exist,
            // keep the plain one (no dot in raw name).
            if (!this.symbolMap.has(normalizedName) || !s.symbolName.includes('.')) {
                this.symbolMap.set(normalizedName, Number(s.symbolId));
                this.reverseSymbolMap.set(Number(s.symbolId), normalizedName);
            }
        });
        this.loadedOnce = true;
    }

    /**
     * Lazily refresh the symbol map in the BACKGROUND after connect (Phase 2.1 /
     * Loop-G / Phase 3 / Loop-C). Builds a FRESH map from the latest
     * ProtoOASymbolsListReq and swaps it in atomically only on success, so:
     *   - the OLD map stays valid and serving restore while the refresh is in
     *     flight (the map is never empty during restore);
     *   - symbolInfoCache is NEVER cleared (it is keyed by symbolId, which is
     *     stable; a name re-resolution just remaps names → ids);
     *   - a refresh failure leaves the old map intact (logged, not thrown) so
     *     restore proceeds against the persisted map and the Phase-3 defer-queue
     *     can resolve symbols that were absent before.
     *
     * Resolves to the fresh map on success, or null on failure. Never rejects
     * (must be safe to fire-and-forget from connect()).
     * @returns {Promise<Map|null>}
     */
    async refreshAllSymbols() {
        try {
            const response = await this.connection.sendCommand('ProtoOASymbolsListReq', {
                ctidTraderAccountId: this.ctidTraderAccountId
            });
            const freshMap = new Map();
            const freshReverse = new Map();
            response.symbol.forEach(s => {
                const normalizedName = CTraderSymbolLoader.normalizeName(s.symbolName);
                if (!freshMap.has(normalizedName) || !s.symbolName.includes('.')) {
                    freshMap.set(normalizedName, Number(s.symbolId));
                    freshReverse.set(Number(s.symbolId), normalizedName);
                }
            });
            // Atomic swap: the old maps are only replaced once the fresh ones
            // are fully built. symbolInfoCache is intentionally untouched.
            this.symbolMap = freshMap;
            this.reverseSymbolMap = freshReverse;
            this.loadedOnce = true;
            return freshMap;
        } catch (err) {
            // Leave the existing map valid; the refresh is best-effort.
            return null;
        }
    }

    /**
     * Get full symbol info with pip data.
     * Caches results to avoid repeated API calls.
     */
    async getFullSymbolInfo(symbolId) {
        if (this.symbolInfoCache.has(symbolId)) {
            return this.symbolInfoCache.get(symbolId);
        }

        const response = await this.connection.sendCommand('ProtoOASymbolByIdReq', {
            ctidTraderAccountId: this.ctidTraderAccountId,
            symbolId: [symbolId]
        });

        if (!response.symbol || response.symbol.length === 0) {
            throw new Error(`Failed to fetch full details for symbol ID ${symbolId}`);
        }

        const fullInfo = response.symbol[0];
        const processedInfo = {
            symbolName: fullInfo.symbolName,
            digits: Number(fullInfo.digits),
            pipPosition: Number(fullInfo.pipPosition),
            pipSize: Math.pow(10, -fullInfo.pipPosition),
            pipetteSize: Math.pow(10, -(fullInfo.pipPosition + 1))
        };

        this.symbolInfoCache.set(symbolId, processedInfo);
        return processedInfo;
    }

    /**
     * Get symbol ID from symbol name.
     */
    getSymbolId(symbolName) {
        return this.symbolMap.get(symbolName);
    }

    /**
     * Get symbol name from symbol ID.
     */
    getSymbolName(symbolId) {
        return this.reverseSymbolMap.get(symbolId);
    }

    /**
     * Get all loaded symbol names.
     */
    getAllSymbolNames() {
        return Array.from(this.symbolMap.keys());
    }
}

module.exports = { CTraderSymbolLoader };
