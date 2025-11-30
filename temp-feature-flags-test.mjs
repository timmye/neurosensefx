


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

// Mock writable for Node.js testing
function writable(initial) {
  let value = initial;
  let subscribers = [];

  return {
    subscribe(fn) {
      subscribers.push(fn);
      fn(value);
      return () => {
        subscribers = subscribers.filter(sub => sub !== fn);
      };
    },
    set(newValue) {
      value = newValue;
      subscribers.forEach(fn => fn(value));
    },
    update(updater) {
      value = updater(value);
      subscribers.forEach(fn => fn(value));
    }
  };
}

const FeatureFlags = createFeatureFlags();
export default FeatureFlags;
