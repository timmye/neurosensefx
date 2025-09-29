/**
 * @typedef {import('../../data/symbolStore').SymbolState} SymbolState
 */

/**
 * Renders the multi-symbol ADR visualization on a canvas.
 *
 * @param {CanvasRenderingContext2D} ctx The canvas rendering context.
 * @param {{width: number, height: number}} dimensions The dimensions of the canvas.
 * @param {SymbolState[]} symbols An array of symbol state objects to render.
 */
export function drawMultiSymbolADR(ctx, dimensions, symbols) {
  const { width, height } = dimensions;

  // --- Clear the canvas for each new frame ---
  ctx.clearRect(0, 0, width, height);

  // --- Define drawing constants and match existing display styles ---
  const paddingTop = 20;
  const paddingBottom = 20;
  const drawingHeight = height - paddingTop - paddingBottom;
  const centerX = 40; // Indent the axis to give labels space
  const labelOffset = 5;

  // --- Style for axis and text, matching configStore.js ---
  ctx.strokeStyle = '#4B5563'; // adrRangeIndicatorLabelBoxOutlineColor
  ctx.fillStyle = '#E5E7EB';   // adrRangeIndicatorLabelColor
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';

  // --- Draw Y-Axis Line (0% mark) with matching thickness ---
  ctx.lineWidth = 1; // adrRangeIndicatorLinesThickness
  ctx.beginPath();
  ctx.moveTo(centerX, paddingTop);
  ctx.lineTo(centerX, height - paddingBottom);
  ctx.stroke();
  
  // --- Draw a thicker, more prominent 0-level line ---
  ctx.strokeStyle = '#9CA3AF'; // adrRangeIndicatorLinesColor
  ctx.lineWidth = 2;
  const zeroY = paddingTop + drawingHeight / 2;
  ctx.beginPath();
  ctx.moveTo(centerX - 10, zeroY);
  ctx.lineTo(centerX + 10, zeroY);
  ctx.stroke();


  // --- Draw Y-Axis Labels ---
  ctx.fillText('+100%', centerX, paddingTop - 5);
  ctx.fillText('0%', centerX + 20, zeroY + 4);
  ctx.fillText('-100%', centerX, height - paddingBottom + 15);

  const getY = (adrPercentage) => {
    const normalized = (adrPercentage + 100) / 200;
    return paddingTop + (1 - normalized) * drawingHeight;
  };

  // --- Plot each symbol ---
  symbols.forEach((symbol) => {
    if (typeof symbol.adrPercentage !== 'number') return;

    const y = getY(symbol.adrPercentage);
    const isPositive = symbol.adrPercentage >= 0;

    // CORRECTED: Use Blue for positive (Up) and Red for negative (Down) to match the design intent
    ctx.strokeStyle = isPositive ? 'rgba(59, 130, 246, 0.9)' : 'rgba(239, 68, 68, 0.9)'; // Blue-500, Red-500
    ctx.fillStyle = isPositive ? 'rgba(59, 130, 246, 0.9)' : 'rgba(239, 68, 68, 0.9)';
    ctx.lineWidth = 2;
    
    const lineLength = 10;
    ctx.beginPath();
    ctx.moveTo(centerX - lineLength / 2, y);
    ctx.lineTo(centerX + lineLength / 2, y);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillText(
      `${symbol.symbolName} (${symbol.adrPercentage.toFixed(2)}%)`,
      centerX + lineLength + 10,
      y + 4
    );
  });
}
