import { writable } from 'svelte/store';

const KEY = 'nsfx-chart-theme';
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
export const themeStore = writable(stored === 'dark' ? 'dark' : 'light');

themeStore.subscribe(value => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, value);
});

export function toggleTheme() {
  themeStore.update(v => v === 'dark' ? 'light' : 'dark');
}
