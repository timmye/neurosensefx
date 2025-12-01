// Enhanced day range meter canvas visualizers - Crystal Clarity Compliant
// Framework-first: Canvas 2D API, professional trading visualization
// Week-2 Phase 1 Session 2: Complete visual replication

import { register } from './visualizationRegistry.js';
import { createPriceScale, formatPrice } from './priceScale.js';
import {
  drawAxis,
  drawCenterLine,
  drawBoundaries,
  drawPriceMarkers
} from './dayRangeElements.js';
import { drawPercentageMarkers } from './percentageMarkers.js';

export function setupCanvas(canvas, width = null, height = null) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Use provided dimensions or fall back to getBoundingClientRect()
  const rect = width && height ? { width, height } : canvas.getBoundingClientRect();

  // Set actual size in memory
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // Scale the drawing context to match device pixel ratio
  ctx.scale(dpr, dpr);

  return ctx;
}

export function renderStatusMessage(ctx, message, s) {
  const { width, height } = s;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#F59E0B';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height / 2);
  console.log('[STATUS] Canvas display:', message);
}

export function renderErrorMessage(ctx, message, s) {
  const { width, height } = s;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#EF4444';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SYSTEM ERROR: ${message}`, width / 2, height / 2);
  console.log('[SYSTEM ERROR] Canvas display:', message);
}

export function renderDayRange(ctx, d, s) {
  const { width, height } = s;
  ctx.clearRect(0, 0, width, height);

  // Early exit for missing data
  if (!d || !d.current || !d.adrLow || !d.adrHigh) {
    renderStatusMessage(ctx, 'Waiting for market data...', s);
    return;
  }

  // Setup positioning and scaling
  const axisX = width * 0.2;
  const priceScale = createPriceScale(d.adrLow, d.adrHigh, height);
  const midPrice = d.adrLow + (d.adrHigh - d.adrLow) / 2;
  const adrValue = d.adrHigh - d.adrLow;

  // Draw structural elements
  drawAxis(ctx, axisX, height);
  drawCenterLine(ctx, width, midPrice, priceScale);
  drawBoundaries(ctx, width, d.adrLow, d.adrHigh, priceScale);

  // Draw data elements - Map processor output to expected dayRangeElements input
  const mappedData = {
    todayHigh: d.high,
    todayLow: d.low,
    current: d.current,
    adrHigh: d.adrHigh,
    adrLow: d.adrLow
  };

  drawPriceMarkers(ctx, axisX, mappedData, midPrice, priceScale, formatPrice);
  drawPercentageMarkers(ctx, axisX, midPrice, adrValue, priceScale);
}

// Register the visualization
register('dayRange', renderDayRange);
console.log('[SYSTEM] Enhanced day range meter visualization registered');