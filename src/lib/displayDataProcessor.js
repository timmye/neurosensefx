// Data processing utilities for display components
// Week 2: Market Profile integration
// Phase 2: TradingView client integration

// Helper function for pip estimation (client-side)
function estimatePipPosition(price) {
  if (price > 1000) return 2;  // Crypto/stocks
  if (price > 10) return 3;    // JPY pairs
  return 4;                    // Most forex pairs
}

function estimatePipSize(price) {
  if (price > 1000) return 0.01;
  if (price > 10) return 0.001;
  return 0.0001;
}

function getDirection(currentPrice, prevPrice) {
  if (currentPrice > prevPrice) return 'up';
  if (currentPrice < prevPrice) return 'down';
  return 'neutral';
}

export function processSymbolData(data, formattedSymbol, lastData) {
  if (data.type === 'error') {
    return { type: 'error', message: data.message };
  }

  // Common price reference for pip estimation
  const priceRef = data.current || data.price || data.bid || data.ask || lastData?.current || 1.0;

  const displayData = data.type === 'symbolDataPackage' ? {
    high: data.high || data.todaysHigh || data.projectedAdrHigh || 1.0,
    low: data.low || data.todaysLow || data.projectedAdrLow || 1.0,
    current: data.current || data.price || data.bid || data.ask || data.initialPrice || data.todaysOpen || 1.0,
    open: data.open || data.todaysOpen || data.initialPrice || 1.0,
    adrHigh: data.adrHigh || data.projectedAdrHigh || (data.todaysHigh || 1.0) * 1.01,
    adrLow: data.adrLow || data.projectedAdrLow || (data.todaysLow || 1.0) * 0.99,
    pipPosition: data.pipPosition ?? estimatePipPosition(data.current || priceRef),
    pipSize: data.pipSize ?? estimatePipSize(data.current || priceRef),
    pipetteSize: data.pipetteSize,
    source: data.source || 'ctrader',
    previousPrice: data.current || data.price || data.bid || data.ask || data.initialPrice || data.todaysOpen || 1.0,
    direction: 'neutral',
    initialMarketProfile: data.initialMarketProfile || null
  } : data.type === 'tick' && data.symbol === formattedSymbol ? {
    high: Math.max(lastData?.high || 0, data.high || data.ask || data.bid || 0),
    low: Math.min(lastData?.low || Infinity, data.low || data.bid || data.ask || Infinity),
    current: data.price || data.bid || data.ask || lastData?.current || 1.0,
    open: lastData?.open || data.bid || data.ask || 1.0,
    adrHigh: lastData?.adrHigh || (data.price || data.bid || data.ask || 1.0) * 1.01,
    adrLow: lastData?.adrLow || (data.price || data.bid || data.ask || 1.0) * 0.99,
    pipPosition: data.pipPosition ?? lastData?.pipPosition ?? estimatePipPosition(priceRef),
    pipSize: data.pipSize ?? lastData?.pipSize ?? estimatePipSize(priceRef),
    pipetteSize: data.pipetteSize ?? lastData?.pipetteSize,
    source: data.source || lastData?.source || 'ctrader',
    previousPrice: lastData?.current || lastData?.previousPrice || 1.0,
    direction: getDirection(
      data.price || data.bid || data.ask || lastData?.current || 1.0,
      lastData?.current || lastData?.previousPrice || 1.0
    )
  } : null;

  if (displayData) {
    return { type: 'data', data: displayData };
  } else if (data.type !== 'status' && data.type !== 'ready' && data.type !== 'error') {
    return { type: 'unhandled', messageType: data.type };
  }

  return null;
}


export function getBucketSizeForSymbol(symbol, symbolData, bucketMode = 'pip') {
  // If pipSize is not available, estimate it from current price
  const priceRef = symbolData?.current || symbolData?.price || symbolData?.bid || symbolData?.ask || 1.0;

  // Return pipSize for 'pip' mode, pipetteSize for 'pipette' mode
  if (bucketMode === 'pipette' && symbolData?.pipetteSize) {
    return symbolData.pipetteSize;
  }
  if (symbolData?.pipSize) {
    return symbolData.pipSize;
  }

  // Fallback to estimation if pipSize not available (TradingView data)
  return estimatePipSize(priceRef);
}

export function getWebSocketUrl() {
  // Use environment variable or default to development/production ports
  const wsUrl = import.meta.env.VITE_BACKEND_URL ||
    (window.location.port === '5174' || window.location.port === '4173'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${window.location.port === '5174' ? '8080' : '8081'}`
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8080`);
  return wsUrl;
}

export function formatSymbol(symbol) {
  return symbol.replace('/', '').toUpperCase();
}