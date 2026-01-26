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
     * Load all available symbols from cTrader.
     * Populates symbolMap and reverseSymbolMap for bidirectional lookup.
     */
    async loadAllSymbols() {
        const response = await this.connection.sendCommand('ProtoOASymbolsListReq', {
            ctidTraderAccountId: this.ctidTraderAccountId
        });
        response.symbol.forEach(s => {
            this.symbolMap.set(s.symbolName, Number(s.symbolId));
            this.reverseSymbolMap.set(Number(s.symbolId), s.symbolName);
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
     * Check if symbol exists in map.
     */
    hasSymbol(symbolName) {
        return this.symbolMap.has(symbolName);
    }

    /**
     * Get all loaded symbol names.
     */
    getAllSymbolNames() {
        return Array.from(this.symbolMap.keys());
    }
}

module.exports = { CTraderSymbolLoader };
