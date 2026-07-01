// Centralized shell-canvas theme resolver.
//
// The DOM skins via CSS custom properties (src/styles/tokens.css, themed by
// <html data-theme> driven by themeStore). Canvas renderers can't consume CSS
// vars, so this module is the canvas analog: the single source of truth for
// every color drawn onto a shell <canvas> 2D context (mini market profile,
// day-range meter, FX basket, price markers, status text). It mirrors the
// chart-canvas idiom (src/lib/chart/themeColors.js + fadedStyleDefaults.js)
// but is centralized + grouped + reads the SHELL store (themeStore), not
// chartThemeStore. Chart canvases (src/lib/chart/**) stay on their own resolver.
//
// PERFORMANCE (hard constraints):
//  - DARK/LIGHT are pre-built module constants (alpha variants precomputed via
//    withAlpha at load). getCanvasColors() returns a reference — no per-frame
//    allocation.
//  - Theme is read via ONE app-lifetime subscription; getCanvasColors() is a
//    plain variable read, not a per-call get()/subscribe/unsubscribe.
//  - Hot per-marker render paths must call getCanvasColors() ONCE at the render
//    entry and thread the object down — never per marker/label.
//
// Color kinds (distinguished by comment so nobody later "fixes" an invariant):
//  - theme-aware:    has a dark + light variant (surfaces, text, label bgs, hover)
//  - theme-invariant: hue IS the information (warn/error/zone/intensity/marker
//    oranges) — identical in both palettes by design.

import { themeStore } from '../stores/themeStore.js';

/**
 * Convert a #RGB / #RRGGBB hex to an `rgba(r, g, b, a)` string.
 * Used at module load to precompute alpha variants into the constants below —
 * NOT intended for the per-frame render path.
 */
export function withAlpha(hex, a) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Dark palette = today's literals (zero visual change in dark mode).
const DARK = {
  surfaces: {
    canvasBackground: '#0a0a0a',        // day-range + combined view bg (theme-aware)
    miniProfileBackground: '#111111',   // ticker mini-profile bg (theme-aware)
    miniProfileBorder: '#333333',       // ticker mini-profile border (theme-aware)
    fxBasketBackground: '#1a1a1a',      // FX basket waiting/error bg (theme-aware)
    labelBackground: withAlpha('#0a0a0a', 0.7),  // dark block behind price labels (theme-aware) — THE light-theme bug
    percentageBackground: withAlpha('#000000', 0.6) // dark block behind "DR %" text (theme-aware)
  },
  text: {
    warn: '#F59E0B',   // theme-invariant — status/waiting/failed encoding (amber)
    error: '#EF4444'   // theme-invariant — error encoding (red)
  },
  marketProfile: {
    valueArea: withAlpha('#4a9eff', 0.1),       // theme-aware (slightly stronger on light)
    pocLine: '#ff8c4a',                          // theme-invariant — POC encoding
    miniCurrentPrice: '#FF6600',                 // theme-invariant — current-price encoding
    miniOpenPrice: '#FF8800',                    // theme-invariant — open-price encoding
    miniTwap: '#00FF66',                         // theme-aware — TWAP marker (grey on light)
    miniBar: (intensity) => withAlpha('#4a9eff', 0.2 + intensity * 0.4),  // theme-aware alpha
    intensityLow: '#0891b2',                     // theme-invariant cyan ramp (darkened on light)
    intensityMedium: '#22d3ee',
    intensityHigh: '#67e8f9'
  },
  dayRange: {
    axisPrimary: '#4B5563',          // theme-aware gray
    axisReference: '#f66a51',      // theme-invariant — coral reference line
    currentPrice: '#6B7280',         // theme-aware gray
    priceUp: '#4a9eff',              // theme-aware (darkened on light for contrast)
    priceDown: '#8f6ce0',          // theme-aware
    sessionPrices: '#f69051',      // theme-aware
    openPrice: '#6B7280',            // theme-aware gray
    adrRange: 'rgba(224, 224, 224, 0.3)',  // theme-aware band
    sessionRange: 'rgba(59, 130, 246, 0.3)', // theme-aware band
    boundaryLine: '#854be8',         // theme-aware
    percentageLabels: '#9CA3AF',     // theme-aware gray
    markers: '#374151',              // theme-aware gray
    previousDay: '#414141',          // theme-aware gray (config value; compute fallback stays #414141)
    twapMarker: '#10b981'            // theme-aware emerald
  },
  fxBasket: {
    baseline: '#6B7280',             // theme-aware gray
    positive: '#10b981',             // theme-invariant encoding
    negative: '#ef4444',             // theme-invariant encoding
    background: 'transparent',
    text: '#ffffff',                 // theme-aware (dark text on light)
    textSecondary: '#9CA3AF'         // theme-aware gray
  },
  fxBasketZones: {
    quiet: '#6B7280',                // theme-invariant volatility encoding ramp
    normal: '#F59E0B',
    active: '#F97316',
    extreme: '#EF4444'
  },
  overlays: {
    delta: '#FFD700',                // theme-invariant — gold delta encoding
    selectedMarker: '#ff6b35',       // theme-invariant — selection-orange encoding
    hoverLine: withAlpha('#ffffff', 0.5),   // theme-aware (dark guide on light)
    hoverText: withAlpha('#ffffff', 0.8)    // theme-aware
  }
};

// Light palette: surfaces/text/label-backgrounds flip; semantic encodings stay.
const LIGHT = {
  surfaces: {
    canvasBackground: '#e8e8e8',
    miniProfileBackground: '#e8e8e8',
    miniProfileBorder: '#cccccc',
    fxBasketBackground: '#e8e8e8',
    labelBackground: withAlpha('#ffffff', 0.75),
    percentageBackground: withAlpha('#ffffff', 0.7)
  },
  text: {
    warn: '#F59E0B',
    error: '#EF4444'
  },
  marketProfile: {
    valueArea: withAlpha('#4a9eff', 0.12),
    pocLine: '#ff8c4a',
    miniCurrentPrice: '#FF6600',
    miniOpenPrice: '#FF8800',
    miniTwap: '#555555',
    miniBar: (intensity) => withAlpha('#4a9eff', 0.55 + intensity * 0.4),
    intensityLow: '#0e7490',
    intensityMedium: '#0891b2',
    intensityHigh: '#22d3ee'
  },
  dayRange: {
    axisPrimary: '#9CA3AF',
    axisReference: '#f66a51',
    currentPrice: '#4B5563',
    priceUp: '#1d6fd6',
    priceDown: '#6d3fb8',
    sessionPrices: '#d9661f',
    openPrice: '#4B5563',
    adrRange: 'rgba(75, 85, 99, 0.18)',
    sessionRange: 'rgba(29, 111, 214, 0.25)',
    boundaryLine: '#6d3fb8',
    percentageLabels: '#6B7280',
    markers: '#9CA3AF',
    previousDay: '#6B7280',
    twapMarker: '#059669'
  },
  fxBasket: {
    baseline: '#9CA3AF',
    positive: '#10b981',
    negative: '#ef4444',
    background: 'transparent',
    text: '#1a1a1a',
    textSecondary: '#6B7280'
  },
  fxBasketZones: {
    quiet: '#6B7280',
    normal: '#F59E0B',
    active: '#F97316',
    extreme: '#EF4444'
  },
  overlays: {
    delta: '#FFD700',
    selectedMarker: '#ff6b35',
    hoverLine: withAlpha('#000000', 0.4),
    hoverText: withAlpha('#000000', 0.65)
  }
};

// ONE subscription for the app lifetime keeps `current` in sync. themeStore
// default is 'dark', and writable stores call the subscriber immediately on
// subscribe, so `current` is initialized correctly.
let current = DARK;
themeStore.subscribe((theme) => { current = theme === 'light' ? LIGHT : DARK; });

/**
 * Returns the resolved shell-canvas color set for the current workspace theme.
 * Cheap: a variable read returning a module constant. Call once per render
 * entry; thread the result down to per-element draw calls.
 */
export function getCanvasColors() {
  return current;
}
