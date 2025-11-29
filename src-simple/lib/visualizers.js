// Simple day range meter canvas visualizers - DPR-aware crisp rendering

export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

export function renderDayRange(ctx, d, s) {
  const { width, height } = s, padding = 50, axisX = width / 3;
  ctx.clearRect(0, 0, width, height);

  const adrValue = d.adrHigh - d.adrLow || 0.001;
  const min = d.adrLow - (adrValue * 0.1), max = d.adrHigh + (adrValue * 0.1), range = max - min || 0.001;
  const y = (price) => padding + ((max - price) / range) * (height - padding * 2);

  // ADR axis
  ctx.strokeStyle = '#4B5563'; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(axisX, padding); ctx.lineTo(axisX, height - padding); ctx.stroke();

  // Center reference line
  ctx.strokeStyle = '#6B7280'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
  const openY = y(d.open || d.current);
  ctx.beginPath(); ctx.moveTo(0, openY); ctx.lineTo(width, openY); ctx.stroke(); ctx.setLineDash([]);

  // ADR range background
  ctx.fillStyle = 'rgba(224, 224, 224, 0.3)';
  ctx.fillRect(axisX - 20, y(d.adrHigh), 40, y(d.adrLow) - y(d.adrHigh));

  // Today's range
  ctx.fillStyle = '#4a90e2';
  ctx.fillRect(axisX - 15, y(d.high), 30, y(d.low) - y(d.high));

  // Current price line
  ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(axisX - 25, y(d.current)); ctx.lineTo(axisX + 25, y(d.current)); ctx.stroke();

  // Text labels
  ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';

  ctx.fillStyle = '#9CA3AF';
  ctx.fillText(`+100% ADR`, axisX + 35, y(d.adrHigh)); ctx.fillText(`${d.adrHigh.toFixed(5)}`, axisX + 90, y(d.adrHigh));

  const highPct = ((d.high - (d.open || d.current)) / adrValue * 100).toFixed(0);
  ctx.fillStyle = '#4a90e2';
  ctx.fillText(`H ${highPct > 0 ? '+' : ''}${highPct}%`, axisX + 35, y(d.high));
  ctx.fillText(`${d.high.toFixed(5)}`, axisX + 90, y(d.high));

  ctx.fillStyle = '#ff6b6b';
  ctx.fillText(`NOW`, axisX + 35, y(d.current)); ctx.fillText(`${d.current.toFixed(5)}`, axisX + 90, y(d.current));

  const lowPct = ((d.low - (d.open || d.current)) / adrValue * 100).toFixed(0);
  ctx.fillStyle = '#4a90e2';
  ctx.fillText(`L ${lowPct > 0 ? '+' : ''}${lowPct}%`, axisX + 35, y(d.low));
  ctx.fillText(`${d.low.toFixed(5)}`, axisX + 90, y(d.low));

  ctx.fillStyle = '#9CA3AF';
  ctx.fillText(`-100% ADR`, axisX + 35, y(d.adrLow)); ctx.fillText(`${d.adrLow.toFixed(5)}`, axisX + 90, y(d.adrLow));
}