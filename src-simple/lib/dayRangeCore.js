// Day Range Meter Core Functions - Crystal Clarity Compliant
// Framework-first: DPR-aware rendering, pixel-perfect lines

export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Sub-pixel alignment for crisp lines
  ctx.translate(0.5 / dpr, 0.5 / dpr);

  return ctx;
}

export function renderPixelPerfectLine(ctx, x1, y1, x2, y2) {
  const dpr = window.devicePixelRatio || 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1 * dpr) / dpr, Math.round(y1 * dpr) / dpr);
  ctx.lineTo(Math.round(x2 * dpr) / dpr, Math.round(y2 * dpr) / dpr);
  ctx.stroke();
}

export function renderAdrAxis(ctx, config, height, padding) {
  const { positioning, colors } = config;
  const dpr = window.devicePixelRatio || 1;

  ctx.save();
  ctx.strokeStyle = colors.axisPrimary;
  ctx.lineWidth = 1 / dpr;

  renderPixelPerfectLine(ctx, positioning.adrAxisX, padding, positioning.adrAxisX, height - padding);
  ctx.restore();
}

export function renderCenterLine(ctx, config, width, y) {
  const { colors } = config;
  const dpr = window.devicePixelRatio || 1;

  ctx.save();
  ctx.strokeStyle = colors.axisReference;
  ctx.lineWidth = 1 / dpr;
  ctx.setLineDash([2 / dpr, 2 / dpr]);

  renderPixelPerfectLine(ctx, 0, y, width, y);
  ctx.setLineDash([]);
  ctx.restore();
}

export function renderBoundaryLines(ctx, config, width, height, padding) {
  const { colors } = config;
  const dpr = window.devicePixelRatio || 1;

  ctx.save();
  ctx.strokeStyle = colors.boundaryLine;
  ctx.lineWidth = 2 / dpr;

  // Top boundary - full width with minimal offset for visibility
  renderPixelPerfectLine(ctx, 0, padding, width, padding);
  // Bottom boundary - full width with minimal offset for visibility
  renderPixelPerfectLine(ctx, 0, height - padding, width, height - padding);

  ctx.restore();
}

// Centralized text rendering setup
export function setupTextRendering(ctx, font, baseline = 'middle', align = 'center') {
  ctx.font = font;
  ctx.textBaseline = baseline;
  ctx.textAlign = align;
}

// Centralized price formatting - uses priceFormat.js utility
export { formatPrice } from './priceFormat.js';

// Enhanced percentage formatting with sign
export function formatPercentage(pct) {
  return `${pct > 0 ? '+' : ''}${pct}%`;
}