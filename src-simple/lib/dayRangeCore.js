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
  ctx.setLineDash([4, 1]);

  renderPixelPerfectLine(ctx, 0, y, width, y);
  ctx.setLineDash([]);
  ctx.restore();
}


// Render ASYMMETRIC ADR percentage boundary lines - Refactored for testability
import { calculateAdrBoundaries, calculateBoundaryCoordinates, calculateReferenceLines } from './adrBoundaryCalculations.js';
import { renderBoundaryLines, renderBoundaryLabels, renderReferenceLines as renderRefLines } from './adrBoundaryRenderer.js';

export function renderAdrBoundaryLines(ctx, config, width, height, priceScale, adrData, adaptiveScale) {
  const { colors } = config;

  // Calculate boundaries and coordinates
  const boundaries = calculateAdrBoundaries(adrData, adaptiveScale);
  if (!boundaries) return;

  const coordinates = calculateBoundaryCoordinates(boundaries, priceScale);
  const referenceLines = calculateReferenceLines(boundaries, priceScale, adrData.adrValue);

  // Render all components
  renderBoundaryLines(ctx, width, coordinates, colors);
  renderBoundaryLabels(ctx, width, height, boundaries, coordinates, colors); // Now a no-op function
  renderRefLines(ctx, width, boundaries, coordinates, referenceLines, colors);
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