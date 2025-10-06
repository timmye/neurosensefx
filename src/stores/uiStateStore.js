import { writable, derived } from 'svelte/store';

function createUIStateStore() {
  const { subscribe, set, update } = writable({
    selectedCanvas: null,
    canvasPositions: new Map(),
    activeTab: 'canvas',
    workspaceLayout: 'free', // free, grid
    zoom: 1
  });
  
  return {
    subscribe,
    setSelectedCanvas: (canvasId) => update(state => ({ ...state, selectedCanvas: canvasId })),
    updateCanvasPosition: (canvasId, position) => update(state => {
      const newPositions = new Map(state.canvasPositions);
      newPositions.set(canvasId, position);
      return { ...state, canvasPositions: newPositions };
    }),
    setActiveTab: (tab) => update(state => ({ ...state, activeTab: tab })),
    setWorkspaceLayout: (layout) => update(state => ({ ...state, workspaceLayout: layout })),
    setZoom: (zoom) => update(state => ({ ...state, zoom }))
  };
}

export const uiStateStore = createUIStateStore();
