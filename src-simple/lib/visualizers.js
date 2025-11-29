// Simple day range meter canvas visualizers
// DPR-aware crisp rendering for trading displays

export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

export function renderDayRange(ctx, d, s) {
  const { width, height } = s, p = 40;
  ctx.clearRect(0, 0, width, height);
  const min = Math.min(d.adrLow, d.low), max = Math.max(d.adrHigh, d.high), r = max - min || 0.001;
  const y = (price) => p + (height - 20) - ((price - min) / r) * (height - 20);
  const x = width / 2;

  ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, p); ctx.lineTo(x, height - 20); ctx.stroke();

  ctx.fillStyle = '#e0e0e0'; ctx.fillRect(x - 15, y(d.adrLow), 30, y(d.adrHigh) - y(d.adrLow));

  ctx.fillStyle = '#4a90e2'; ctx.fillRect(x - 10, y(d.low), 20, y(d.high) - y(d.low));

  ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 20, y(d.current)); ctx.lineTo(x + 20, y(d.current)); ctx.stroke();

  ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = '#888'; ctx.fillText(`ADR H ${d.adrHigh.toFixed(5)}`, x + 25, y(d.adrHigh) + 3); ctx.fillStyle = '#4a90e2'; ctx.fillText(`H ${d.high.toFixed(5)} L ${d.low.toFixed(5)}`, x + 25, y(d.high) + 3);
  ctx.fillStyle = '#ff6b6b'; ctx.fillText(`${d.current.toFixed(5)}`, x + 25, y(d.current) + 3); ctx.fillStyle = '#888'; ctx.fillText(`ADR L ${d.adrLow.toFixed(5)}`, x + 25, y(d.adrLow) + 3);
}