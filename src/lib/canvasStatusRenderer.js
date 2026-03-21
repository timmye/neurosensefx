// Canvas Status Renderer - Crystal Clarity Compliant
// Framework-first: Status and error message rendering

const SYSTEM_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function renderStatusMessage(ctx, message, s) {
  const { width, height } = s;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#F59E0B';
  ctx.font = `400 12px ${SYSTEM_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height / 2);
  console.log('[STATUS] Canvas display:', message);
}

export function renderErrorMessage(ctx, message, s) {
  const { width, height } = s;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#EF4444';
  ctx.font = `400 12px ${SYSTEM_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SYSTEM ERROR: ${message}`, width / 2, height / 2);
  console.log('[SYSTEM ERROR] Canvas display:', message);
}