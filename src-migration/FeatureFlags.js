import { writable } from 'svelte/store';

const defaults = { useSimpleWorkspace: false, useSimpleDisplays: false, useSimpleVisualizations: false };
const { subscribe, set, update } = writable({ ...defaults });

export default {
  subscribe,
  load() {
    try {
      const params = new URLSearchParams(window.location.search);
      const impl = params.get('impl');
      let flags;
      if (impl === 'old') flags = { ...defaults };
      else if (impl === 'new') flags = { useSimpleWorkspace: true, useSimpleDisplays: true, useSimpleVisualizations: true };
      else if (impl === 'both') flags = { useSimpleWorkspace: true, useSimpleDisplays: true, useSimpleVisualizations: false };
      else {
        const saved = localStorage.getItem('neurosense-flags');
        flags = saved ? { ...defaults, ...JSON.parse(saved) } : { ...defaults };
      }
      set(flags); return flags;
    } catch { set(defaults); return defaults; }
  },
  save(flags) { try { localStorage.setItem('neurosense-flags', JSON.stringify(flags)); } catch {} },
  updateFlag(flag, value) { update(c => { const u = { ...c, [flag]: value }; this.save(u); return u; }); },
  isSimpleModeEnabled() { let c = defaults; subscribe(f => c = f)(); return c.useSimpleWorkspace && c.useSimpleDisplays && c.useSimpleVisualizations; }
};