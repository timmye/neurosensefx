// Day Range Meter - Framework-First Implementation (Crystal Clarity Compliant)
// Direct Canvas 2D API, DPR-aware rendering, no abstractions

import { formatPrice } from './priceFormat.js';

export function renderDayRange(ctx, data, size, getConfig) {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  if (!isValidMarketData(data)) return;

  const config = getConfig?.('dayRangeMeter') || getDefaultConfig();
  const padding = 20, dpr = window.devicePixelRatio || 1;
  const adrValue = data.adrHigh - data.adrLow;
  const maxAdrPct = calculateMaxAdrPercentage(data);
  const range = { min: data.adrLow - (adrValue * 0.05), max: data.adrHigh + (adrValue * 0.05) };

  // Background and axis
  ctx.fillStyle = config.backgroundColor || '#1a1a1a';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = config.colors?.axis || '#666';
  ctx.lineWidth = 1 / dpr;
  ctx.beginPath();
  ctx.moveTo(20, padding);
  ctx.lineTo(20, height - padding);
  ctx.stroke();

  // Center line
  const midPrice = data.open || data.current;
  const midY = priceToY(midPrice, range, height, padding);
  ctx.strokeStyle = config.colors?.center || '#888';
  ctx.setLineDash([2 / dpr, 2 / dpr]);
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 50% ADR boundary lines
  ctx.strokeStyle = '#f00';
  ctx.lineWidth = 2 / dpr;
  ctx.beginPath();
  ctx.moveTo(0, priceToY(data.adrHigh, range, height, padding));
  ctx.lineTo(width, priceToY(data.adrHigh, range, height, padding));
  ctx.moveTo(0, priceToY(data.adrLow, range, height, padding));
  ctx.lineTo(width, priceToY(data.adrLow, range, height, padding));
  ctx.stroke();

  // Price markers
  ctx.font = config.fonts?.percentageLabels || '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const prices = [
    { price: data.current, label: 'C', color: config.colors?.current || '#0f0' },
    { price: data.open, label: 'O', color: config.colors?.open || '#ff0' },
    { price: data.high, label: 'H', color: config.colors?.high || '#f00' },
    { price: data.low, label: 'L', color: config.colors?.low || '#00f' }
  ];
  prices.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillText(`${p.label} ${formatPrice(p.price, data.pipPosition)}`, 20, priceToY(p.price, range, height, padding));
  });

  // Percentage markers
  if (config.showPercentageMarkers) {
    ctx.fillStyle = '#999';
    ctx.textAlign = 'right';
    [25, 50, 75].forEach(pct => {
      const y = height / 2 + ((pct - 50) / 100) * (height - 2 * padding) * Math.min(maxAdrPct * 2, 1);
      if (y >= padding && y <= height - padding) ctx.fillText(`${pct}%`, 15, y);
    });
  }
}

function isValidMarketData(d) {
  return d && typeof d.current === 'number' && d.adrHigh && d.adrLow;
}

function calculateMaxAdrPercentage(data) {
  const adrValue = data.adrHigh - data.adrLow;
  const midPrice = data.open || data.current;
  if (!midPrice || !adrValue) return 0.5;

  const highMovement = data.high ? Math.abs(data.high - midPrice) / adrValue : 0;
  const lowMovement = data.low ? Math.abs(midPrice - data.low) / adrValue : 0;
  const totalMovement = highMovement + lowMovement;

  let maxPct = 0.5 + totalMovement;
  if (maxPct <= 0.6) return 0.5;
  if (maxPct <= 0.85) return 0.75;
  return Math.ceil(maxPct * 4) / 4;
}

function priceToY(price, range, height, padding) {
  const normalized = (range.max - price) / (range.max - range.min);
  return padding + (normalized * (height - 2 * padding));
}


function getDefaultConfig() {
  return {
    backgroundColor: '#1a1a1a',
    colors: { axis: '#666', center: '#888', current: '#0f0', open: '#ff0', high: '#f00', low: '#00f' },
    showPercentageMarkers: true
  };
}