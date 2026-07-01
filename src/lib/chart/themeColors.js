import { get } from 'svelte/store';
import { chartThemeStore } from '../../stores/chartThemeStore.js';

export function getThemeColor(light, dark) {
  return get(chartThemeStore) === 'dark' ? dark : light;
}
