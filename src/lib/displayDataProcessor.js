// Data processing utilities for display components
// Week 2: Market Profile integration

export function processSymbolData(data, formattedSymbol, lastData) {
  if (data.type === 'error') {
    return { type: 'error', message: data.message };
  }

  const displayData = data.type === 'symbolDataPackage' ? {
    high: data.todaysHigh || data.projectedAdrHigh || 1.0,
    low: data.todaysLow || data.projectedAdrLow || 1.0,
    current: data.bid || data.ask || data.initialPrice || data.todaysOpen || 1.0,
    open: data.todaysOpen || data.initialPrice || 1.0,
    adrHigh: data.projectedAdrHigh || (data.todaysHigh || 1.0) * 1.01,
    adrLow: data.projectedAdrLow || (data.todaysLow || 1.0) * 0.99,
    // pipPosition integration - preserve pipPosition data from backend
    pipPosition: data.pipPosition,
    pipSize: data.pipSize,
    pipetteSize: data.pipetteSize,
    // Initialize previousPrice and direction for first tick
    previousPrice: data.bid || data.ask || data.initialPrice || data.todaysOpen || 1.0,
    direction: 'neutral'
  } : data.type === 'tick' && data.symbol === formattedSymbol ? {
    high: Math.max(lastData?.high || 0, data.ask || data.bid || 0),
    low: Math.min(lastData?.low || Infinity, data.bid || data.ask || Infinity),
    current: data.bid || data.ask || lastData?.current || 1.0,
    open: lastData?.open || data.bid || data.ask || 1.0,
    adrHigh: lastData?.adrHigh || (data.bid || data.ask || 1.0) * 1.01,
    adrLow: lastData?.adrLow || (data.bid || data.ask || 1.0) * 0.99,
    // pipPosition integration - Crystal Clarity Compliant: No OR operator fallbacks
    pipPosition: data.pipPosition !== undefined ? data.pipPosition : lastData?.pipPosition,
    pipSize: data.pipSize !== undefined ? data.pipSize : lastData?.pipSize,
    pipetteSize: data.pipetteSize !== undefined ? data.pipetteSize : lastData?.pipetteSize,
    // Track previous price and calculate direction
    previousPrice: lastData?.current || lastData?.previousPrice || 1.0,
    direction: (() => {
      const currentPrice = data.bid || data.ask || lastData?.current || 1.0;
      const prevPrice = lastData?.current || lastData?.previousPrice || 1.0;
      if (currentPrice > prevPrice) return 'up';
      if (currentPrice < prevPrice) return 'down';
      return 'neutral';
    })()
  } : null;

  if (displayData) {
    return { type: 'data', data: displayData };
  } else if (data.type !== 'status' && data.type !== 'ready' && data.type !== 'error') {
    return { type: 'unhandled', messageType: data.type };
  }

  return null;
}


export function getBucketSizeForSymbol(symbol, symbolData, bucketMode = 'pip') {
  if (!symbolData?.pipSize) {
    throw new Error(`Symbol data required for ${symbol}`);
  }

  // Return pipSize for 'pip' mode, pipetteSize for 'pipette' mode
  if (bucketMode === 'pipette' && symbolData.pipetteSize) {
    return symbolData.pipetteSize;
  }

  return symbolData.pipSize;
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