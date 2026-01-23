// Display event handlers composable for FloatingDisplay
// Consolidates all event handler functions

export function useDisplayHandlers(display, webSocketSub, canvasRef, connectionManager, displayState) {
  function handleClose() {
    const { workspaceActions } = require('../stores/workspace.js');
    workspaceActions.removeDisplay(display.id);
  }

  function handleFocus() {
    const { workspaceActions } = require('../stores/workspace.js');
    workspaceActions.bringToFront(display.id);
  }

  function handleRefresh() {
    const formattedSymbol = display.symbol.replace('/', '').toUpperCase();
    webSocketSub.refreshSubscription(formattedSymbol, display.source || 'ctrader', 14);
    if (canvasRef?.refreshCanvas) canvasRef.refreshCanvas();
  }

  function handleKeydown(e) {
    const { workspaceActions } = require('../stores/workspace.js');
    if (e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      workspaceActions.toggleMarketProfile(display.id);
    }
  }

  return { handleClose, handleFocus, handleRefresh, handleKeydown };
}
