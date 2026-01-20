// Keyboard Handler Utilities - Single Responsibility
// Framework-first: Direct browser keyboard event handling

export function createKeyboardHandler(workspaceActions) {
  let escPressCount = 0;
  let escTimer = null;

  function handleCreateDisplay(source = 'ctrader') {
    const symbol = prompt('Enter symbol:');
    if (symbol) {
      workspaceActions.addDisplay(symbol.replace('/', '').trim().toUpperCase(), null, source);
    }
  }

  function handleCreateTradingViewDisplay() {
    const symbol = prompt('Enter symbol (TradingView):');
    if (symbol) {
      workspaceActions.addDisplay(symbol.replace('/', '').trim().toUpperCase(), null, 'tradingview');
    }
  }

  function handleEscapeSequence() {
    escPressCount++;

    // Reset timer for progressive pattern
    clearTimeout(escTimer);
    escTimer = setTimeout(() => { escPressCount = 0; }, 1000);

    if (escPressCount === 1) {
      // First ESC: Close overlays/modals
      document.querySelectorAll('.modal, .overlay, .dropdown').forEach(el => {
        el.close ? el.close() : el.remove();
      });
    } else if (escPressCount === 2) {
      // Second ESC: Clear display focus
      document.querySelectorAll('.focused').forEach(el =>
        el.classList.remove('focused'));
      escPressCount = 0;
    }
  }

  function handleKeydown(event) {
    // Alt+A: Create cTrader display
    if (event.altKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      handleCreateDisplay('ctrader');
      return;
    }

    // Alt+B: Create FX Basket display
    if (event.altKey && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      workspaceActions.addDisplay('FX_BASKET', null, 'ctrader');
      return;
    }

    // Alt+T: Create TradingView display
    if (event.altKey && event.key.toLowerCase() === 't') {
      event.preventDefault();
      handleCreateTradingViewDisplay();
      return;
    }

    // ESC: Progressive escape pattern
    if (event.key === 'Escape') {
      event.preventDefault();
      handleEscapeSequence();
    }
  }

  function cleanup() {
    clearTimeout(escTimer);
  }

  return {
    handleKeydown,
    cleanup
  };
}