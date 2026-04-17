import { writable, derived } from 'svelte/store';

const STORAGE_KEY = 'neurosensefx-timezone';
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const TIMEZONE_PRESETS = [
  { id: 'UTC',         label: 'UTC',          iana: 'UTC' },
  { id: 'LOCAL',       label: 'Local',        iana: null },
  { id: 'NEW_YORK',    label: 'New York',     iana: 'America/New_York' },
  { id: 'CHICAGO',     label: 'Chicago',      iana: 'America/Chicago' },
  { id: 'DENVER',      label: 'Denver',       iana: 'America/Denver' },
  { id: 'LOS_ANGELES', label: 'Los Angeles',  iana: 'America/Los_Angeles' },
  { id: 'LONDON',      label: 'London',       iana: 'Europe/London' },
  { id: 'FRANKFURT',   label: 'Frankfurt',    iana: 'Europe/Berlin' },
  { id: 'DUBAI',       label: 'Dubai',        iana: 'Asia/Dubai' },
  { id: 'MUMBAI',      label: 'Mumbai',       iana: 'Asia/Kolkata' },
  { id: 'SINGAPORE',   label: 'Singapore',    iana: 'Asia/Singapore' },
  { id: 'HONG_KONG',   label: 'Hong Kong',    iana: 'Asia/Hong_Kong' },
  { id: 'TOKYO',       label: 'Tokyo',        iana: 'Asia/Tokyo' },
  { id: 'SYDNEY',      label: 'Sydney',       iana: 'Australia/Sydney' },
  { id: 'AUCKLAND',    label: 'Auckland',     iana: 'Pacific/Auckland' },
];

function getPresetById(id) {
  return TIMEZONE_PRESETS.find(p => p.id === id) || TIMEZONE_PRESETS[0];
}

function loadSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const preset = getPresetById(saved);
      if (preset) return preset.id;
    }
  } catch { /* ignore */ }
  return 'UTC';
}

export const timezoneStore = writable(loadSaved());

timezoneStore.subscribe(id => {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
});

/** Resolved IANA timezone string (e.g. 'America/New_York'). Never null. */
export const resolvedTimezone = derived(timezoneStore, id => {
  const preset = getPresetById(id);
  return preset.iana || LOCAL_TZ;
});
