// Keyboard Handler Utilities - Single Responsibility
// Framework-first: Direct browser keyboard event handling

export function createKeyboardHandler(workspaceActions) {
  let escPressCount = 0;
  let escTimer = null;

  function handleCreateDisplay() {
    const symbol = prompt('Enter symbol:');
    if (symbol) {
      workspaceActions.addDisplay(symbol.replace('/', '').trim().toUpperCase());
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
    // Alt+A: Create display
    if (event.altKey && event.key === 'a') {
      event.preventDefault();
      handleCreateDisplay();
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