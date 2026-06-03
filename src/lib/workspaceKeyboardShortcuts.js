export function initWorkspaceShortcuts({ keyManager, workspaceActions, setShowKeyboardHelp, showWorkspaceDialog, reinitAll, formatSymbol, toggleChart }) {
  const unsubs = [];

  // Initialize KeyManager document listener
  keyManager.init();

  // ? / / : hold to show keyboard shortcuts help
  unsubs.push(keyManager.register(
    { key: '?' }, () => { setShowKeyboardHelp(true); return true; }, { priority: 0 }
  ));
  unsubs.push(keyManager.register(
    { key: '/' }, () => { setShowKeyboardHelp(true); return true; }, { priority: 0 }
  ));

  // Alt+W: workspace modal
  unsubs.push(keyManager.register(
    { key: 'w', alt: true }, () => { showWorkspaceDialog(); return true; }, { priority: 0 }
  ));

  // Alt+R: reinit all connections
  unsubs.push(keyManager.register(
    { key: 'r', alt: true }, () => { reinitAll(); return true; }, { priority: 0 }
  ));

  // c: toggle chart (only without ctrl/alt)
  unsubs.push(keyManager.register(
    { key: 'c', ctrl: false, alt: false, meta: false }, () => { toggleChart(); return true; }, { priority: 10 }
  ));

  // Alt+A: create cTrader display
  unsubs.push(keyManager.register(
    { key: 'a', alt: true }, () => {
      const symbol = prompt('Enter symbol:');
      if (symbol) workspaceActions.addDisplay(formatSymbol(symbol, 'ctrader'), null, 'ctrader', { width: 220, height: 360 });
      return true;
    }, { priority: 0 }
  ));

  // Alt+B: create FX Basket display
  unsubs.push(keyManager.register(
    { key: 'b', alt: true }, () => {
      workspaceActions.addDisplay('FX_BASKET', null, 'ctrader');
      return true;
    }, { priority: 0 }
  ));

  // Alt+T: create TradingView display
  unsubs.push(keyManager.register(
    { key: 't', alt: true }, () => {
      const symbol = prompt('Enter symbol (TradingView):');
      if (symbol) workspaceActions.addDisplay(formatSymbol(symbol, 'tradingview'), null, 'tradingview', { width: 220, height: 360 });
      return true;
    }, { priority: 0 }
  ));

  // Alt+I: create Price Ticker
  unsubs.push(keyManager.register(
    { key: 'i', alt: true }, () => {
      const symbol = prompt('Enter symbol for Price Ticker:');
      if (symbol) workspaceActions.addPriceTicker(formatSymbol(symbol, 'tradingview'), null, 'tradingview');
      return true;
    }, { priority: 0 }
  ));

  // Arrow keys: navigate between displays
  unsubs.push(keyManager.register(
    { key: 'ArrowUp' }, (e) => { e.preventDefault(); workspaceActions.selectNextDisplay('ArrowUp'); return true; }, { priority: 0 }
  ));
  unsubs.push(keyManager.register(
    { key: 'ArrowDown' }, (e) => { e.preventDefault(); workspaceActions.selectNextDisplay('ArrowDown'); return true; }, { priority: 0 }
  ));
  unsubs.push(keyManager.register(
    { key: 'ArrowLeft' }, (e) => { e.preventDefault(); workspaceActions.selectNextDisplay('ArrowLeft'); return true; }, { priority: 0 }
  ));
  unsubs.push(keyManager.register(
    { key: 'ArrowRight' }, (e) => { e.preventDefault(); workspaceActions.selectNextDisplay('ArrowRight'); return true; }, { priority: 0 }
  ));

  // h: toggle headlines widget (no modifier keys)
  unsubs.push(keyManager.register(
    { key: 'h', ctrl: false, alt: false, meta: false }, () => {
      workspaceActions.toggleHeadlines();
      return true;
    }, { priority: 10 }
  ));

  // Keyup for ? / / to hide help
  const handleHelpKeyup = (e) => {
    if (e.key === '?' || e.key === '/') setShowKeyboardHelp(false);
  };
  document.addEventListener('keyup', handleHelpKeyup);
  unsubs.push(() => document.removeEventListener('keyup', handleHelpKeyup));

  // Return cleanup function
  return () => {
    unsubs.forEach(fn => fn());
    keyManager.destroy();
  };
}
