// Keyboard Handler Utilities - Single Responsibility
// Framework-first: Direct browser keyboard event handling

export function createKeyboardHandler(workspaceActions) {
  let escPressCount = 0;
  let escTimer = null;
  let selectedSymbol = null;

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

  function handleCreatePriceTicker() {
    const symbol = prompt('Enter symbol for Price Ticker:');
    if (symbol) {
      workspaceActions.addPriceTicker(symbol.replace('/', '').trim().toUpperCase(), null, 'tradingview');
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

  function toggleChart() {
    // Find if chart already exists
    const chartState = workspaceActions.getChartState();

    if (chartState && !chartState.isMinimized) {
      // Chart exists and is visible - minimize it
      workspaceActions.updateChartDisplay(chartState.id, { isMinimized: true });
    } else {
      // Chart doesn't exist or is minimized - create or restore it
      if (selectedSymbol) {
        if (chartState) {
          // Update existing chart with new symbol
          workspaceActions.updateChartDisplay(chartState.id, {
            symbol: selectedSymbol,
            isMinimized: false
          });
        } else {
          // Create new chart
          workspaceActions.addChartDisplay(selectedSymbol);
        }
      } else {
        // No symbol selected - try to get from active displays
        const displays = Array.from(workspaceActions.getState().displays.values());
        const firstPriceTicker = displays.find(d => d.type === 'priceTicker');
        if (firstPriceTicker) {
          selectedSymbol = firstPriceTicker.symbol;
          workspaceActions.addChartDisplay(selectedSymbol);
        } else {
          alert('Please select a ticker first to create a chart');
        }
      }
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

    // Alt+I: Create Price Ticker
    if (event.altKey && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      handleCreatePriceTicker();
      return;
    }

    // 'c' key: Toggle chart window
    if (event.key === 'c' && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      toggleChart();
      return;
    }

    // ESC: Progressive escape pattern
    if (event.key === 'Escape') {
      event.preventDefault();
      handleEscapeSequence();
    }

    // Ctrl+Z: Undo drawing (if chart is focused)
    if (event.ctrlKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      // Could be implemented later with chart focus tracking
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z: Redo drawing
    if (event.ctrlKey && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
      event.preventDefault();
      // Could be implemented later with chart focus tracking
      return;
    }
  }

  function cleanup() {
    clearTimeout(escTimer);
  }

  return {
    handleKeydown,
    cleanup,
    // Additional methods for external access
    setSelectedSymbol: (symbol) => { selectedSymbol = symbol; },
    getSelectedSymbol: () => selectedSymbol
  };
}