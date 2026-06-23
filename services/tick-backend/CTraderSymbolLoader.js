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
