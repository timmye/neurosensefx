// Color system for Day Range Meter - Crystal Clarity Compliant
// Centralized color palette for professional trading visualization

export const COLORS = {
  axis: '#4B5563',        // ADR Axis (Gray-600)
  center: '#6B7280',      // Center Reference (Gray-500)
  boundary: '#EF4444',    // ADR Boundaries (Red-500)
  highLow: '#F59E0B',     // High/Low Prices (Amber-500)
  current: '#10B981',     // Current Price (Green-500)
  percentMarker: '#374151', // Percentage Markers (Gray-700)
  percentLabel: '#9CA3AF'   // Percentage Labels (Gray-400)
};

// System font family matching mini market profile (ticker)
export const SYSTEM_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

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