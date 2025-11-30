import { writable } from 'svelte/store';

const defaults = {
  useSimpleWorkspace: false,
  useSimpleDisplays: false,
  useSimpleVisualizations: false
};

function createFeatureFlags() {
  const { subscribe, set, update } = writable({ ...defaults });

  return {
    subscribe,

    load() {
      try {
        const saved = localStorage.getItem('neurosense-flags');
        const flags = saved ? { ...defaults, ...JSON.parse(saved) } : { ...defaults };
        set(flags);
        return flags;
      } catch {
        set({ ...defaults });
        return { ...defaults };
      }
    },

    save(flags) {
      try {
        localStorage.setItem('neurosense-flags', JSON.stringify(flags));
      } catch {
        // Silent fail
      }
    },

    updateFlag(flag, value) {
      update(current => {
        const updated = { ...current, [flag]: value };
        this.save(updated);
        return updated;
      });
    },

    isSimpleModeEnabled() {
      let current = { ...defaults };
      subscribe(flags => current = flags)();
      return current.useSimpleWorkspace && current.useSimpleDisplays && current.useSimpleVisualizations;
    }
  };
}

const FeatureFlags = createFeatureFlags();
export default FeatureFlags;