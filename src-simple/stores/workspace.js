import { writable } from 'svelte/store';

const initialState = {
  displays: new Map(),
  nextZIndex: 1,
  config: {
    defaultSize: { width: 220, height: 120 },
    defaultPosition: { x: 100, y: 100 }
  }
};

export const workspaceStore = writable(initialState);

const actions = {
  addDisplay: (symbol, position = null) => {
    workspaceStore.update(state => {
      const id = `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const display = {
        id,
        symbol,
        position: position || state.config.defaultPosition,
        size: { ...state.config.defaultSize },
        zIndex: state.nextZIndex,
        created: Date.now()
      };

      const newDisplays = new Map(state.displays);
      newDisplays.set(id, display);

      return {
        ...state,
        displays: newDisplays,
        nextZIndex: state.nextZIndex + 1
      };
    });
  },

  removeDisplay: (id) => {
    workspaceStore.update(state => {
      const newDisplays = new Map(state.displays);
      newDisplays.delete(id);
      return { ...state, displays: newDisplays };
    });
  },

  updatePosition: (id, position) => {
    workspaceStore.update(state => {
      const display = state.displays.get(id);
      if (!display) return state;

      const newDisplays = new Map(state.displays);
      newDisplays.set(id, { ...display, position });

      return { ...state, displays: newDisplays };
    });
  },

  updateSize: (id, size) => {
    workspaceStore.update(state => {
      const display = state.displays.get(id);
      if (!display) return state;

      const newDisplays = new Map(state.displays);
      newDisplays.set(id, { ...display, size });

      return { ...state, displays: newDisplays };
    });
  },

  bringToFront: (id) => {
    workspaceStore.update(state => {
      const display = state.displays.get(id);
      if (!display) return state;

      const newDisplays = new Map(state.displays);
      newDisplays.set(id, { ...display, zIndex: state.nextZIndex });

      return {
        ...state,
        displays: newDisplays,
        nextZIndex: state.nextZIndex + 1
      };
    });
  }
};

const persistence = {
  loadFromStorage: () => {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      const stored = localStorage.getItem('workspace-state');
      if (!stored) {
        return;
      }

      const data = JSON.parse(stored);
      workspaceStore.update(state => ({
        ...state,
        displays: new Map(data.displays || []),
        nextZIndex: data.nextZIndex || 1
      }));
    } catch (error) {
      console.warn('Failed to load workspace from storage:', error);
    }
  },

  saveToStorage: () => {
    try {
      workspaceStore.subscribe(state => {
        const data = {
          displays: Array.from(state.displays.entries()),
          nextZIndex: state.nextZIndex
        };
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('workspace-state', JSON.stringify(data));
        }
      });
    } catch (error) {
      console.warn('Failed to save workspace to storage:', error);
    }
  }
};

export const workspaceActions = actions;
export const workspacePersistence = persistence;