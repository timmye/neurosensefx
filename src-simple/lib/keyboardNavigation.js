import { workspaceStore, workspaceActions } from '../stores/workspace.js';

class KeyboardManager {
  constructor() {
    this.shortcuts = new Map([['alt+a', () => this.promptSymbol()], ['ctrl+k', () => this.promptSymbol()],
      ['ctrl+tab', () => this.navigate(1)], ['ctrl+shift+tab', () => this.navigate(-1)],
      ['delete', () => this.removeFocused()], ['ctrl+w', () => this.removeCurrent()],
      ['escape', () => this.handleEscape()]]);
    this.focusedId = null;
    this.escLevel = 0;
    this.displays = [];
    this.init();
  }

  init() {
    workspaceStore.subscribe(state => {
      this.displays = Array.from(state.displays.values()).sort((a, b) => a.zIndex - b.zIndex);
    });
    document.addEventListener('keydown', e => this.handleKeydown(e));
    console.log('[KEYBOARD] System ready');
  }

  handleKeydown(event) {
    const key = [event.ctrlKey && 'ctrl', event.altKey && 'alt', event.shiftKey && 'shift', event.key.toLowerCase()]
      .filter(Boolean).join('+');
    const handler = this.shortcuts.get(key);
    if (handler) {
      event.preventDefault();
      console.log('[KEYBOARD]', key);
      handler();
    }
  }

  promptSymbol() {
    const symbol = prompt('Enter symbol:');
    if (symbol) workspaceActions.addDisplay(symbol.replace('/', '').trim().toUpperCase());
  }

  navigate(direction) {
    if (!this.displays.length) return;
    const current = this.focusedId ? this.displays.findIndex(d => d.id === this.focusedId) : -1;
    const next = direction === 1 ? (current + 1) % this.displays.length :
      (current <= 0 ? this.displays.length - 1 : current - 1);
    this.focus(this.displays[next].id);
  }

  focus(displayId) {
    this.focusedId = displayId;
    workspaceActions.bringToFront(displayId);
    document.querySelectorAll('.floating-display').forEach(el =>
      el.classList.toggle('focused', el.dataset.displayId === displayId));
  }

  removeFocused() {
    if (this.focusedId) {
      workspaceActions.removeDisplay(this.focusedId);
      this.focusedId = null;
    }
  }

  removeCurrent() {
    this.focusedId ? this.removeFocused() :
      this.displays.length && workspaceActions.removeDisplay(this.displays[this.displays.length - 1].id);
  }

  handleEscape() {
    this.escLevel++;
    if (this.escLevel === 1) {
      document.querySelectorAll('.modal, .overlay, .dropdown').forEach(el => el.remove());
    } else if (this.escLevel === 2) {
      this.focusedId = null;
      document.querySelectorAll('.floating-display').forEach(el => el.classList.remove('focused'));
    } else {
      this.escLevel = 0;
    }
  }
}

export const keyboardManager = new KeyboardManager();
export default keyboardManager;