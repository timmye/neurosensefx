// Simple day range meter canvas visualizers - DPR-aware crisp rendering
// Based on DESIGN_dayRangeMeter specification

import { register } from './visualizationRegistry.js';

export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

export function renderStatusMessage(ctx, message, s) {
  const { width, height } = s;

  // Clear the entire canvas context
  ctx.clearRect(0, 0, width, height);

  // Status message display (no error prefix for normal states)
  ctx.fillStyle = '#F59E0B'; // Amber/orange for status messages
  ctx.font = '12px monospace'; // Monospace for precise formatting
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Show status message without SYSTEM ERROR prefix
  ctx.fillText(message, width / 2, height / 2);

  // Add timestamp for debugging
  ctx.fillStyle = '#6B7280'; // Gray for timestamp
  ctx.font = '10px monospace';
  ctx.fillText(`[${new Date().toISOString()}]`, width / 2, height / 2 + 20);

  console.log('[STATUS] Canvas display:', message, 'with canvas size:', `${width}x${height}`);
}

export function renderErrorMessage(ctx, message, s) {
  const { width, height } = s;

  // Clear the entire canvas context
  ctx.clearRect(0, 0, width, height);

  // System error display for actual errors only
  ctx.fillStyle = '#EF4444'; // Red for errors
  ctx.font = '12px monospace'; // Monospace for precise error formatting
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Show full system error message for debugging
  const displayMessage = `SYSTEM ERROR: ${message}`;
  ctx.fillText(displayMessage, width / 2, height / 2);

  // Add timestamp for debugging
  ctx.fillStyle = '#F59E0B';
  ctx.font = '10px monospace';
  ctx.fillText(`[${new Date().toISOString()}]`, width / 2, height / 2 + 20);

  console.log('[SYSTEM ERROR] Canvas display:', displayMessage, 'with canvas size:', `${width}x${height}`);
}

export function renderDayRange(ctx, d, s) {
  const { width, height } = s;
  const padding = 50;
  const adrAxisX = width / 3; // Configurable ADR axis position

  console.log('[DEBUG] renderDayRange called with:', { width, height, data: d });

  ctx.clearRect(0, 0, width, height);

  // Data validation with full system error transparency
  if (!d) {
    renderErrorMessage(ctx, 'DATA_VALIDATION_ERROR: data object is null or undefined', s);
    return;
  }
  if (!isValidNumber(d.current)) {
    renderErrorMessage(ctx, `DATA_VALIDATION_ERROR: current field invalid (received: ${d.current}, type: ${typeof d.current})`, s);
    return;
  }
  if (!isValidNumber(d.adrHigh)) {
    renderErrorMessage(ctx, `DATA_VALIDATION_ERROR: adrHigh field invalid (received: ${d.adrHigh}, type: ${typeof d.adrHigh})`, s);
    return;
  }
  if (!isValidNumber(d.adrLow)) {
    renderErrorMessage(ctx, `DATA_VALIDATION_ERROR: adrLow field invalid (received: ${d.adrLow}, type: ${typeof d.adrLow})`, s);
    return;
  }

  // Log successful data validation
  console.log('[DATA_VALIDATION] PASSED:', {
    symbol: d.symbol,
    current: d.current,
    adrHigh: d.adrHigh,
    adrLow: d.adrLow,
    hasHigh: !!d.high,
    hasLow: !!d.low,
    hasOpen: !!d.open
  });

  // ADR calculation and coordinate system
  const adrValue = d.adrHigh - d.adrLow || 0.001;
  const midPrice = d.open || d.current; // Daily open as reference
  const min = d.adrLow - (adrValue * 0.1);
  const max = d.adrHigh + (adrValue * 0.1);
  const range = max - min || 0.001;

  // Y-coordinate conversion based on price
  const y = (price) => padding + ((max - price) / range) * (height - padding * 2);

  // === LAYER 1: BACKGROUND ===
  // Canvas cleared above

  // === LAYER 2: STRUCTURE ===

  // ADR axis (primary vertical line)
  ctx.strokeStyle = '#4B5563';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(adrAxisX, padding);
  ctx.lineTo(adrAxisX, height - padding);
  ctx.stroke();

  // Center reference line at daily open price
  ctx.strokeStyle = '#6B7280';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  const openY = y(midPrice);
  ctx.beginPath();
  ctx.moveTo(0, openY);
  ctx.lineTo(width, openY);
  ctx.stroke();
  ctx.setLineDash([]);

  // === LAYER 3: DATA ELEMENTS ===

  // ADR range background
  ctx.fillStyle = 'rgba(224, 224, 224, 0.3)';
  ctx.fillRect(adrAxisX - 20, y(d.adrHigh), 40, y(d.adrLow) - y(d.adrHigh));

  // Today's session range
  if (isValidNumber(d.high) && isValidNumber(d.low)) {
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Blue for session range
    ctx.fillRect(adrAxisX - 15, y(d.high), 30, y(d.low) - y(d.high));
  }

  // === LAYER 4: INFORMATION LAYER ===

  // Typography setup
  ctx.textBaseline = 'middle';

  // Current ADR percentage display
  const currentAdrPct = ((d.current - midPrice) / adrValue * 100).toFixed(1);
  ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
  ctx.fillRect(width/2 - 60, 10, 120, 25);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`ADR: ${currentAdrPct > 0 ? '+' : ''}${currentAdrPct}%`, width/2, 22);

  // === LAYER 5: PRICE MARKERS ===

  // Daily Open Marker (left side, gray)
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('O', adrAxisX - 35, openY);
  ctx.fillText(`${midPrice.toFixed(5)}`, adrAxisX - 25, openY);

  // Session High/Low Markers (left side, amber)
  if (isValidNumber(d.high) && isValidNumber(d.low)) {
    const highPct = ((d.high - midPrice) / adrValue * 100).toFixed(0);
    const lowPct = ((d.low - midPrice) / adrValue * 100).toFixed(0);

    ctx.fillStyle = '#F59E0B'; // Amber

    // High marker
    ctx.font = '10px monospace';
    ctx.fillText('H', adrAxisX - 35, y(d.high));
    ctx.fillText(`${d.high.toFixed(5)}`, adrAxisX - 25, y(d.high));

    // Low marker
    ctx.fillText('L', adrAxisX - 35, y(d.low));
    ctx.fillText(`${d.low.toFixed(5)}`, adrAxisX - 25, y(d.low));
  }

  // Current Price Marker (right side, green, emphasized)
  ctx.strokeStyle = '#10B981'; // Green
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(adrAxisX - 25, y(d.current));
  ctx.lineTo(adrAxisX + 25, y(d.current));
  ctx.stroke();

  ctx.fillStyle = '#10B981';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('C', adrAxisX + 35, y(d.current));
  ctx.fillText(`${d.current.toFixed(5)}`, adrAxisX + 45, y(d.current));

  // Static percentage markers (30%, 50%, 75%, 100%)
  const staticMarkers = [0.3, 0.5, 0.75, 1.0];
  ctx.strokeStyle = '#6B7280';
  ctx.fillStyle = '#6B7280';
  ctx.font = '9px sans-serif';

  staticMarkers.forEach(pct => {
    const markerY = y(midPrice + (adrValue * pct));
    if (markerY > padding && markerY < height - padding) {
      // Marker line
      ctx.beginPath();
      ctx.moveTo(adrAxisX - 4, markerY);
      ctx.lineTo(adrAxisX + 4, markerY);
      ctx.stroke();

      // Percentage label
      ctx.textAlign = 'right';
      ctx.fillText(`${pct > 1 ? '+100' : `${pct * 100}%`}`, adrAxisX - 8, markerY);
    }

    // Negative percentages
    const negMarkerY = y(midPrice - (adrValue * pct));
    if (negMarkerY > padding && negMarkerY < height - padding) {
      ctx.beginPath();
      ctx.moveTo(adrAxisX - 4, negMarkerY);
      ctx.lineTo(adrAxisX + 4, negMarkerY);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillText(`-${pct * 100}%`, adrAxisX - 8, negMarkerY);
    }
  });
}

// Utility function for number validation
function isValidNumber(value) {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}

// Self-register dayRange visualization with the registry
register('dayRange', renderDayRange);