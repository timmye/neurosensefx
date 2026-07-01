import { writable } from 'svelte/store';

// Chart-only light/dark color scheme — INDEPENDENT of the workspace (shell) theme.
// The shell theme lives in themeStore (→ <html data-theme>); chart consumers read
// THIS store: ChartDisplay, ChartToolbar, OverlayContextMenu, themeColors,
// fadedStyleDefaults. On first load after the split, migrate from the legacy
// unified key so existing users keep their chart looking the same, then the two
// themes diverge as the user toggles them independently.
const KEY = 'nsfx-chart-color-scheme';
const LEGACY = 'nsfx-chart-theme';
const stored = typeof localStorage !== 'undefined'
  ? (localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY))
  : null;
export const chartThemeStore = writable(stored ?? 'dark');

chartThemeStore.subscribe(value => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, value);
});

export function toggleChartTheme() {
  chartThemeStore.update(v => (v === 'dark' ? 'light' : 'dark'));
}
