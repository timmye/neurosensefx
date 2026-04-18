import { get } from 'svelte/store';
import { themeStore } from '../../stores/themeStore.js';

export function getThemeColor(light, dark) {
  return get(themeStore) === 'dark' ? dark : light;
}
