// Data processing utilities for display components

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
    adrLow: data.projectedAdrLow || (data.todaysLow || 1.0) * 0.99
  } : data.type === 'tick' && data.symbol === formattedSymbol ? {
    high: Math.max(lastData?.high || 0, data.ask || data.bid || 0),
    low: Math.min(lastData?.low || Infinity, data.bid || data.ask || Infinity),
    current: data.bid || data.ask || lastData?.current || 1.0,
    open: lastData?.open || data.bid || data.ask || 1.0,
    adrHigh: lastData?.adrHigh || (data.bid || data.ask || 1.0) * 1.01,
    adrLow: lastData?.adrLow || (data.bid || data.ask || 1.0) * 0.99,
    // pipPosition integration - preserve pipPosition data from backend
    pipPosition: data.pipPosition,
    pipSize: data.pipSize,
    pipetteSize: data.pipetteSize
  } : null;

  if (displayData) {
    return { type: 'data', data: displayData };
  } else if (data.type !== 'status' && data.type !== 'ready' && data.type !== 'error') {
    return { type: 'unhandled', messageType: data.type };
  }

  return null;
}

export function getWebSocketUrl() {
  // Development environment uses port 8080, production uses port 8081
  const isDev = window.location.port === '5174' || window.location.port === '5175' || window.location.port === '5176'; // Support all dev ports
  const wsPort = isDev ? '8080' : '8081';
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${wsPort}`;
}

export function formatSymbol(symbol) {
  return symbol.replace('/', '').toUpperCase();
}