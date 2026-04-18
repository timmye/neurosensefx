<script>
  import { themeStore } from '../../stores/themeStore.js';
  export let symbol, connectionStatus, isMinimized, onClose, onFocus, onRefresh, onMinimize;

  let showHeader = true;
  let hideTimeout = null;

  function handleKeydown(e) {
    (e.key.toLowerCase() === 'enter' || e.key === ' ') && (e.preventDefault(), onFocus());
  }

  function handleTriggerEnter() {
    clearTimeout(hideTimeout);
    showHeader = true;
  }

  function handleTriggerLeave() {
    hideTimeout = setTimeout(() => {
      showHeader = false;
    }, 800);
  }

  function handleHeaderEnter() {
    clearTimeout(hideTimeout);
  }

  function handleHeaderLeave() {
    hideTimeout = setTimeout(() => {
      showHeader = false;
    }, 100);
  }
</script>

<!-- 20px invisible trigger zone -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="trigger-zone" role="presentation" on:mouseenter={handleTriggerEnter} on:mouseleave={handleTriggerLeave}></div>

<!-- Always-visible close button -->
<button class="close-always-visible" class:dark={$themeStore === 'dark'} on:click={onClose} aria-label="Close chart" title="Close chart">×</button>

<!-- 40px visible header display -->
{#if showHeader || isMinimized}
  <div
    class="header"
    class:dark={$themeStore === 'dark'}
    style="pointer-events: none"
    role="button"
    tabindex="0"
    on:click={onFocus}
    on:keydown={handleKeydown}
    on:mouseenter={handleHeaderEnter}
    on:mouseleave={handleHeaderLeave}
  >
    <span class="symbol">{symbol}</span>
    <div class="connection-status"
         class:connected={connectionStatus === 'connected'}
         class:connecting={connectionStatus === 'connecting'}
         class:disconnected={connectionStatus === 'disconnected'}
         class:error={connectionStatus === 'error'}
         title="Connection status: {connectionStatus}"></div>
    <button class="refresh" on:click={onRefresh} aria-label="Refresh chart" title="Refresh chart">↻</button>
    <button class="minimize" on:click={onMinimize} aria-label="Minimize chart" title="Minimize chart">
      {isMinimized ? '⎯' : '⌄'}
    </button>
  </div>
{/if}

<style>
  :root {
    --font-symbol: 16px;
    --font-ui-elements: 12px;
    --font-buttons: 14px;
  }

  .trigger-zone {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 20px;
    z-index: 5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 40px;
    background: rgba(245, 245, 245, 0.97);
    backdrop-filter: blur(4px);
    padding: 0 4px;
    cursor: move;
    outline: none;
    z-index: 10;
    transition: opacity 0.2s ease, transform 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    pointer-events: none;
  }

  .header > * {
    pointer-events: auto;
  }

  .symbol {
    color: #333333;
    font-weight: 600;
    font-size: var(--font-symbol);
    pointer-events: none;
  }

  .connection-status {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 6px;
    flex-shrink: 0;
    transition: background-color 0.3s ease;
  }

  .connection-status.connected {
    background-color: #4CAF50;
    box-shadow: 0 0 4px rgba(76, 175, 80, 0.5);
  }

  .connection-status.connecting {
    background-color: #FF9800;
    box-shadow: 0 0 4px rgba(255, 152, 0, 0.5);
    animation: pulse 1s infinite;
  }

  .connection-status.disconnected {
    background-color: #9E9E9E;
  }

  .connection-status.error {
    background-color: #F44336;
    box-shadow: 0 0 4px rgba(244, 67, 54, 0.5);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .refresh {
    background: none;
    border: none;
    color: #777777;
    font-size: 11px;
    cursor: pointer;
    padding: 2px 3px;
    border-radius: 2px;
    transition: background 0.2s ease, color 0.2s ease;
    line-height: 1;
  }

  .refresh:hover,
  .refresh:focus {
    background: #E0E0E0;
    color: #48752c;
  }

  .refresh:focus {
    outline: 1px solid #48752c;
  }

  .minimize {
    background: none;
    border: none;
    color: #777777;
    font-size: 14px;
    cursor: pointer;
    padding: 2px 3px;
    border-radius: 2px;
    transition: background 0.2s ease, color 0.2s ease;
    line-height: 1;
    margin-right: 2px;
  }

  .minimize:hover,
  .minimize:focus {
    background: #E0E0E0;
    color: #48752c;
  }

  .minimize:focus {
    outline: 1px solid #48752c;
  }

  .close-always-visible {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 15;
    background: rgba(245, 245, 245, 0.8);
    border: none;
    color: #777777;
    font-size: 16px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    transition: background 0.2s ease, color 0.2s ease;
    line-height: 1;
  }

  .close-always-visible:hover,
  .close-always-visible:focus {
    background: #E0E0E0;
    color: #333333;
  }

  .close-always-visible:focus {
    outline: 1px solid #48752c;
  }

  .header.dark { background: rgba(30, 41, 59, 0.2); }
  .header.dark .symbol { color: #e2e8f0; }
  .header.dark .refresh,
  .header.dark .minimize { color: #94a3b8; }
  .header.dark .refresh:hover,
  .header.dark .refresh:focus,
  .header.dark .minimize:hover,
  .header.dark .minimize:focus { background: rgba(51, 65, 85, 0.5); color: #34d399; }
  .header.dark .refresh:focus,
  .header.dark .minimize:focus { outline: 1px solid #34d399; }
  .close-always-visible.dark { background: rgba(30, 41, 59, 0.3); color: #94a3b8; }
  .close-always-visible.dark:hover,
  .close-always-visible.dark:focus { background: rgba(51, 65, 85, 0.5); color: #cbd5e1; }
  .close-always-visible.dark:focus { outline: 1px solid #34d399; }
</style>