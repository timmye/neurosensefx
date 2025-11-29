const FeatureFlags = {
  defaults: {
    useSimpleWorkspace: false,
    useSimpleDisplays: false,
    useSimpleVisualizations: false
  },

  load() {
    try {
      const saved = localStorage.getItem('neurosense-flags');
      return saved ? { ...this.defaults, ...JSON.parse(saved) } : { ...this.defaults };
    } catch {
      return { ...this.defaults };
    }
  },

  save(flags) {
    try {
      localStorage.setItem('neurosense-flags', JSON.stringify(flags));
    } catch {
      // Silent fail
    }
  },

  isSimpleModeEnabled() {
    const flags = this.load();
    return flags.useSimpleWorkspace && flags.useSimpleDisplays && flags.useSimpleVisualizations;
  }
};

export default FeatureFlags;