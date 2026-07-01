// Canvas Status Renderer - Crystal Clarity Compliant
// Framework-first: Status and error message rendering

import { getCanvasColors } from './canvasTheme.js';

export const SYSTEM_FONT_FAMILY = '"Georgia Pro", Georgia, serif';

export function renderStatusMessage(ctx, message, s) {
  const { width, height } = s;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = getCanvasColors().text.warn;
  ctx.font = `400 12px ${SYSTEM_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height / 2);
  if (import.meta.env.DEV) {
    console.log('[STATUS] Canvas display:', message);
  }
}

export function renderErrorMessage(ctx, message, s) {
  const { width, height } = s;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = getCanvasColors().text.error;
  ctx.font = `400 12px ${SYSTEM_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SYSTEM ERROR: ${message}`, width / 2, height / 2);
  if (import.meta.env.DEV) {
    console.log('[SYSTEM ERROR] Canvas display:', message);
  }
}
