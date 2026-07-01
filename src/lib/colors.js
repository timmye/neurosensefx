// Font/line-width constants for Day Range Meter + price markers.
//
// NOTE: the legacy `COLORS` palette that lived here was retired — the shell
// canvases now read every color from the centralized theme resolver
// (canvasTheme.js). Only the non-color constants remain; shell-canvas colors
// must not be re-introduced here.

export { SYSTEM_FONT_FAMILY } from './canvasStatusRenderer.js';

export const FONT_SIZES = {
  price: 16,
  percent: 11,
  status: 11
};

export const LINE_WIDTHS = {
  axis: 1,
  boundary: 1,
  priceMarker: 2,
  percentMarker: 1
};
