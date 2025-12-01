// Day Range Meter Core Functions - Crystal Clarity Compliant
// Framework-first: DPR-aware rendering, pixel-perfect lines

export function setupCanvas(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;

  // Use provided dimensions or get from bounding rect
  const rect = width && height ? { width, height } : canvas.getBoundingClientRect();

  // Set canvas CSS dimensions
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  // Set canvas actual dimensions for DPR scaling
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');

  // Scale the context to match DPR
  ctx.scale(dpr, dpr);

  return ctx;
}

export function renderPixelPerfectLine(ctx, x1, y1, x2, y2) {
  // Context is already DPR-scaled, so just round to half pixels for crisp lines
  ctx.beginPath();
  ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
  ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
  ctx.stroke();
}

export function renderAdrAxis(ctx, config, height, padding, width) {
  const { positioning, colors } = config;
  let axisX = positioning.adrAxisX;

  // Handle percentage (0-1) as fraction of width
  if (typeof axisX === 'number' && axisX > 0 && axisX <= 1 && width) {
    axisX = width * axisX;
  }

  ctx.save();
  ctx.strokeStyle = colors.axisPrimary;
  ctx.lineWidth = 1;

  renderPixelPerfectLine(ctx, axisX, padding, axisX, height - padding);
  ctx.restore();
}

export function renderCenterLine(ctx, config, width, y) {
  const { colors } = config;

  ctx.save();
  ctx.strokeStyle = colors.axisReference;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);

  renderPixelPerfectLine(ctx, 0, y, width, y);
  ctx.setLineDash([]);
  ctx.restore();
}

export function renderBoundaryLines(ctx, config, width, height, padding) {
  const { colors } = config;

  ctx.save();
  ctx.strokeStyle = colors.boundaryLine;
  ctx.lineWidth = 2;

  renderPixelPerfectLine(ctx, 0, padding, width, padding);
  renderPixelPerfectLine(ctx, 0, height - padding, width, height - padding);

  ctx.restore();
}

// Render ASYMMETRIC ADR percentage boundary lines
export function renderAdrBoundaryLines(ctx, config, width, height, priceScale, adrData, adaptiveScale) {
  const { colors } = config;
  const labelPadding = 5; // Minimal padding for labels

  if (!adrData || !adrData.midPrice || !adrData.adrValue) return;

  ctx.save();

  // Use ASYMMETRIC expansion values from adaptiveScale
  const { upperExpansion, lowerExpansion } = adaptiveScale;

  // Calculate actual price boundaries for EACH SIDE
  const upperPrice = adrData.midPrice + (adrData.adrValue * upperExpansion);
  const lowerPrice = adrData.midPrice - (adrData.adrValue * lowerExpansion);

  // Convert to Y coordinates
  const upperY = priceScale(upperPrice);
  const lowerY = priceScale(lowerPrice);

  // Draw boundary lines at the ASYMMETRIC ADR boundaries
  ctx.strokeStyle = colors.boundaryLine;
  ctx.lineWidth = 2;
  renderPixelPerfectLine(ctx, 0, upperY, width, upperY);
  renderPixelPerfectLine(ctx, 0, lowerY, width, lowerY);

  // Add labels showing DIFFERENT expansions for each side
  ctx.fillStyle = colors.percentageLabels;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const upperPctStr = `${Math.round(upperExpansion * 100)}%`;
  const lowerPctStr = `${Math.round(lowerExpansion * 100)}%`;

  ctx.fillText(`+${upperPctStr} ADR`, width - 5, Math.max(labelPadding + 10, upperY + 10));
  ctx.fillText(`-${lowerPctStr} ADR`, width - 5, Math.min(height - labelPadding - 10, lowerY - 10));

  // Show 50% reference lines IF they're different from current boundaries
  if (upperExpansion > 0.5 || lowerExpansion > 0.5) {
    ctx.strokeStyle = `${colors.boundaryLine}66`; // Add transparency
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // 50% reference line
    const fiftyPercentPrice = adrData.adrValue * 0.5;
    const fiftyUpperY = priceScale(adrData.midPrice + fiftyPercentPrice);
    const fiftyLowerY = priceScale(adrData.midPrice - fiftyPercentPrice);

    // Only show if different from current boundaries
    if (upperExpansion > 0.5 && Math.abs(fiftyUpperY - upperY) > 5) {
      renderPixelPerfectLine(ctx, 0, fiftyUpperY, width, fiftyUpperY);
      ctx.fillStyle = `${colors.percentageLabels}99`;
      ctx.fillText('+50% ADR', width - 70, fiftyUpperY);
    }

    if (lowerExpansion > 0.5 && Math.abs(fiftyLowerY - lowerY) > 5) {
      renderPixelPerfectLine(ctx, 0, fiftyLowerY, width, fiftyLowerY);
      ctx.fillStyle = `${colors.percentageLabels}99`;
      ctx.fillText('-50% ADR', width - 70, fiftyLowerY);
    }
  }

  ctx.setLineDash([]);
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