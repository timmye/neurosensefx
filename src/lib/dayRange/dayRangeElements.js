// Day Range Meter drawing elements - Crystal Clarity Compliant
// Framework-first: Individual drawing functions, <15 lines each

import { FONT_SIZES, LINE_WIDTHS, SYSTEM_FONT_FAMILY } from '../colors.js';
import { getCanvasColors } from '../canvasTheme.js';

export function drawPriceMarker(ctx, x, y, label, color, showBackground = false, textAlign = 'left', subtitle = null) {
  // Draw marker line
  ctx.strokeStyle = color;
  ctx.lineWidth = LINE_WIDTHS.priceMarker;
  ctx.beginPath();
  ctx.moveTo(x - 12, y);
  ctx.lineTo(x + 12, y);
  ctx.stroke();

  // Set font for text measurements
  ctx.font = `${FONT_SIZES.price}px ${SYSTEM_FONT_FAMILY}`;

  // Calculate text position based on alignment
  const labelOffset = textAlign === 'right' ? -5 : 15;
  const textX = x + labelOffset;

  // Resolve the themed label-background once for this marker draw.
  const labelBackground = getCanvasColors().surfaces.labelBackground;

  // Draw background if enabled
  if (showBackground) {
    const textWidth = ctx.measureText(label).width;
    const subtitleWidth = subtitle ? ctx.measureText(subtitle).width : 0;
    const maxTextWidth = Math.max(textWidth, subtitleWidth);
    const lineHeight = FONT_SIZES.price * 1.0;
    const totalHeight = subtitle ? lineHeight * 2 + 2 : lineHeight * 0.7;
    const padding = 3;

    ctx.fillStyle = labelBackground;

    if (textAlign === 'right') {
      ctx.fillRect(
        textX - padding - maxTextWidth,
        y - totalHeight / 2,
        maxTextWidth + padding * 2,
        totalHeight
      );
    } else {
      ctx.fillRect(
        textX - padding,
        y - totalHeight / 2,
        maxTextWidth + padding * 2,
        totalHeight
      );
    }
  }

  // Draw label
  ctx.fillStyle = color;
  ctx.textAlign = textAlign;
  ctx.font = `${FONT_SIZES.price}px ${SYSTEM_FONT_FAMILY}`;

  if (subtitle) {
    const lineHeight = FONT_SIZES.price * 1.0;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, textX, y - lineHeight / 2);
    ctx.fillText(subtitle, textX, y + lineHeight / 2);
  } else {
    ctx.textBaseline = 'middle';
    ctx.fillText(label, textX, y);
  }
}