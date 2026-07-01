import { writable } from 'svelte/store';

const initialState = {
  displays: new Map(),
  nextZIndex: 1,
  selectedDisplayId: null,
  chartGhost: null,
  config: {
    defaultSize: { width: 2000, height: 680 },
    defaultPosition: { x: 100, y: 100 }
  }
};

export const displayStore = writable(initialState);

// Non-reactive state access
displayStore.getState = () => {
  let currentValue;
  const unsubscribe = displayStore.subscribe(value => {
    currentValue = value;
  });
  unsubscribe();
  return currentValue;
};

// Internal helper to update display properties
const updateDisplay = (id, updates, extra = {}) => {
  displayStore.update(state => {
    const display = state.displays.get(id);
    if (!display) return state;

    const newDisplays = new Map(state.displays);
    newDisplays.set(id, { ...display, ...updates });

    return { ...state, displays: newDisplays, ...extra };
  });
};

const actions = {
  setSelectedDisplay: (id) => {
    displayStore.update(state => ({ ...state, selectedDisplayId: id }));
  },

  clearSelectedDisplay: () => {
    displayStore.update(state => ({ ...state, selectedDisplayId: null }));
  },

  addDisplay: (symbol, position = null, source = 'tradingview', size = null) => {
    displayStore.update(state => {
      const id = `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const display = {
        id, symbol, source, created: Date.now(),
        position: position || state.config.defaultPosition,
        size: size ? { ...size } : { ...state.config.defaultSize },
        zIndex: state.nextZIndex,
        showMarketProfile: true,
        showHeader: false,
        priceMarkers: []
      };

      return {
        ...state,
        displays: new Map(state.displays).set(id, display),
        nextZIndex: state.nextZIndex + 1
      };
    });
  },

  addPriceTicker: (symbol, position = null, source = 'tradingview', size = null) => {
    displayStore.update(state => {
      const id = `ticker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const ticker = {
        id, symbol, source, created: Date.now(), type: 'priceTicker',
        position: position || state.config.defaultPosition,
        size: size ? { ...size } : { width: 240, height: 80 },
        zIndex: state.nextZIndex
      };

      return {
        ...state,
        displays: new Map(state.displays).set(id, ticker),
        nextZIndex: state.nextZIndex + 1
      };
    });
  },

  removeDisplay: (id) => {
    displayStore.update(state => {
      const display = state.displays.get(id);
      const newDisplays = new Map(state.displays);

      // Save chart position/size/resolution/window for restore on reopen
      if (display?.type === 'chart') {
        newDisplays.delete(id);
        return {
          ...state,
          displays: newDisplays,
          chartGhost: {
            position: display.position,
            size: display.size,
            resolution: display.resolution,
            window: display.window,
            windowMode: display.windowMode
          }
        };
      }

      newDisplays.delete(id);
      return { ...state, displays: newDisplays };
    });
  },

  updateDisplay: (id, updates, extra) => updateDisplay(id, updates, extra),
  updatePosition: (id, position) => updateDisplay(id, { position }),
  updateSize: (id, size) => updateDisplay(id, { size }),

  bringToFront: (id) => {
    displayStore.update(state => {
      const display = state.displays.get(id);
      return display ? {
        ...state,
        displays: new Map(state.displays).set(id, { ...display, zIndex: state.nextZIndex }),
        nextZIndex: state.nextZIndex + 1
      } : state;
    });
  },

  selectNextDisplay: (direction) => {
    const state = displayStore.getState();
    const displays = Array.from(state.displays.values()).filter(d => d.type !== 'chart');
    if (displays.length === 0) return;

    const currentId = state.selectedDisplayId;
    const current = currentId ? displays.find(d => d.id === currentId) : null;

    if (!current) {
      const firstTicker = displays.find(d => d.type === 'priceTicker');
      const target = firstTicker || displays[0];
      displayActions.setSelectedDisplay(target.id);
      displayActions.bringToFront(target.id);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-ticker-id="${target.id}"], [data-display-id="${target.id}"]`);
        el?.focus();
      });
      return;
    }

    const dirMap = {
      ArrowUp:    { dx:  0, dy: -1 },
      ArrowDown:  { dx:  0, dy:  1 },
      ArrowLeft:  { dx: -1, dy:  0 },
      ArrowRight: { dx:  1, dy:  0 }
    };
    const dir = dirMap[direction];
    if (!dir) return;

    const PERP_PENALTY = 2;

    const cx = current.position.x + (current.size?.width || 240) / 2;
    const cy = current.position.y + (current.size?.height || 80) / 2;

    let best = null;
    let bestScore = Infinity;

    for (const d of displays) {
      if (d.id === current.id) continue;

      const dx2 = d.position.x + (d.size?.width || 240) / 2;
      const dy2 = d.position.y + (d.size?.height || 80) / 2;

      const vx = dx2 - cx;
      const vy = dy2 - cy;

      const projection = vx * dir.dx + vy * dir.dy;
      if (projection <= 0) continue;

      const perp = Math.abs(vx * (-dir.dy) + vy * dir.dx);

      const score = projection + perp * PERP_PENALTY;

      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }

    if (best) {
      displayActions.setSelectedDisplay(best.id);
      displayActions.bringToFront(best.id);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-ticker-id="${best.id}"], [data-display-id="${best.id}"]`);
        el?.focus();
      });
    }
  },

  toggleMarketProfile: (id) => {
    displayStore.update(state => {
      const display = state.displays.get(id);
      return display ? {
        ...state,
        displays: new Map(state.displays).set(id, {
          ...display,
          showMarketProfile: !display.showMarketProfile
        })
      } : state;
    });
  },

  addChartDisplay: (symbol, position = null, source = 'tradingview') => {
    displayStore.update(state => {
      const id = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const ghost = state.chartGhost;
      const chart = {
        id,
        type: 'chart',
        symbol,
        source,
        created: Date.now(),
        position: position || ghost?.position || { x: 100, y: 100 },
        size: ghost?.size || { ...state.config.defaultSize },
        zIndex: state.nextZIndex,
        resolution: ghost?.resolution || '4h',
        window: ghost?.window || '3M',
        windowMode: ghost?.windowMode || 'developing',
        isMinimized: false,
        showHeader: true
      };

      return {
        ...state,
        displays: new Map(state.displays).set(id, chart),
        nextZIndex: state.nextZIndex + 1,
        chartGhost: null
      };
    });
  },

  updateChartDisplay: (id, updates) => actions.updateDisplay(id, updates),

  getChartDisplay: () => {
    const state = displayStore.getState();
    for (const display of state.displays.values()) {
      if (display.type === 'chart') {
        return display;
      }
    }
    return null;
  },

  getDisplay: (displayId) => displayStore.getState().displays.get(displayId),
};

export const displayActions = actions;
