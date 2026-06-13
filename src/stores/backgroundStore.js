import { writable } from 'svelte/store';

const KEY = 'nsfx-background';
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
export const backgroundStore = writable(stored || 'default');

backgroundStore.subscribe(value => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, value);
});

const BACKGROUNDS = ['default', 'warp'];

export function cycleBackground() {
  backgroundStore.update(v => {
    const i = BACKGROUNDS.indexOf(v);
    return BACKGROUNDS[(i + 1) % BACKGROUNDS.length];
  });
}
