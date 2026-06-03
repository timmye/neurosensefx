export function normalizeSymbolDataPackage(data, currentState) {
  // Backend field name fallback chain
  if (!data.high && data.todaysHigh) {
    if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "todaysHigh" used — backend should send "high"');
  }
  if (!data.low && data.todaysLow) {
    if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "todaysLow" used — backend should send "low"');
  }
  if (!data.open && data.todaysOpen) {
    if (import.meta.env.DEV) console.warn('[marketDataStore] Legacy field "todaysOpen" used — backend should send "open"');
  }

  const midPrice = (data.bid != null && data.ask != null && data.bid !== data.ask)
    ? (data.bid + data.ask) / 2
    : null;

  return {
    current: data.current ?? data.price ?? data.initialPrice ?? midPrice ?? data.bid ?? data.ask ?? null,
    high: data.high ?? data.todaysHigh ?? null,
    low: data.low ?? data.todaysLow ?? null,
    open: data.open ?? data.todaysOpen ?? null,
    adrHigh: data.adrHigh ?? data.projectedAdrHigh ?? null,
    adrLow: data.adrLow ?? data.projectedAdrLow ?? null,
    prevDayOHLC: (data.prevDayOpen != null && data.prevDayHigh != null &&
                  data.prevDayLow != null && data.prevDayClose != null)
      ? { open: data.prevDayOpen, high: data.prevDayHigh, low: data.prevDayLow, close: data.prevDayClose }
      : null,
    pipPosition: data.pipPosition ?? currentState.pipPosition,
    pipSize: data.pipSize ?? currentState.pipSize,
    pipetteSize: data.pipetteSize ?? currentState.pipetteSize,
    digits: data.digits ?? currentState.digits,
    source: data.source ?? currentState.source,
    marketProfile: currentState.marketProfile,
    previousPrice: data.current ?? data.price ?? midPrice ?? data.bid ?? data.ask ?? currentState.current ?? null,
    direction: 'neutral',
    receivedAt: data.receivedAt ?? null,
    sentAt: data.sentAt ?? null
  };
}

export function normalizeTick(data, currentState) {
  const midPrice = (data.bid != null && data.ask != null && data.bid !== data.ask)
    ? (data.bid + data.ask) / 2
    : null;
  const newPrice = data.price ?? midPrice ?? data.bid ?? data.ask ?? currentState.current;
  const prevPrice = currentState.current ?? currentState.previousPrice;
  let direction = 'neutral';
  if (newPrice !== null && prevPrice !== null) {
    direction = newPrice > prevPrice ? 'up' : newPrice < prevPrice ? 'down' : 'neutral';
  }
  return {
    current: newPrice,
    high: newPrice !== null
      ? Math.max(currentState.high ?? newPrice, newPrice)
      : currentState.high,
    low: newPrice !== null
      ? Math.min(currentState.low ?? newPrice, newPrice)
      : currentState.low,
    previousPrice: prevPrice,
    direction,
    source: data.source ?? currentState.source,
    pipPosition: data.pipPosition ?? currentState.pipPosition,
    pipSize: data.pipSize ?? currentState.pipSize,
    pipetteSize: data.pipetteSize ?? currentState.pipetteSize,
    digits: data.digits ?? currentState.digits,
    receivedAt: data.receivedAt ?? null,
    sentAt: data.sentAt ?? null
  };
}
