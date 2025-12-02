// Workspace Initialization Utilities - Single Responsibility
// Framework-first: Direct workspace setup with default display creation

export function initializeWorkspace(workspaceStore, workspacePersistence) {
  workspacePersistence.loadFromStorage();
  workspacePersistence.saveToStorage();

  createDefaultDisplayIfNeeded(workspaceStore);
}

function createDefaultDisplayIfNeeded(workspaceStore) {
  workspaceStore.update(state => {
    if (state.displays.size === 0) {
      console.log('[SYSTEM] No displays found, creating default EURUSD display for testing');

      const defaultDisplay = createDefaultDisplay(state.nextZIndex);

      const newDisplays = new Map(state.displays);
      newDisplays.set(defaultDisplay.id, defaultDisplay);

      return {
        ...state,
        displays: newDisplays,
        nextZIndex: state.nextZIndex + 1
      };
    }
    return state;
  });
}

function createDefaultDisplay(nextZIndex) {
  const symbol = 'EURUSD';
  const id = `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    symbol,
    position: { x: 150, y: 150 },
    size: { width: 300, height: 180 },
    zIndex: nextZIndex,
    created: Date.now()
  };
}