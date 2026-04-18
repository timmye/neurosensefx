<script>
  export let show = false;
</script>

{#if show}
<div class="shortcuts-overlay" role="dialog" aria-modal="true" aria-label="Keyboard Shortcuts">
  <div class="shortcuts-content">
    <h2>Keyboard Shortcuts</h2>

    <div class="shortcut-section">
      <h3>Create Displays</h3>
      <div class="shortcut-list">
        <div class="shortcut-item">
          <span class="keys"><kbd>Alt</kbd>+<kbd>A</kbd></span>
          <span>cTrader Display</span>
        </div>
        <div class="shortcut-item">
          <span class="keys"><kbd>Alt</kbd>+<kbd>B</kbd></span>
          <span>FX Basket</span>
        </div>
        <div class="shortcut-item">
          <span class="keys"><kbd>Alt</kbd>+<kbd>T</kbd></span>
          <span>TradingView Display</span>
        </div>
        <div class="shortcut-item">
          <span class="keys"><kbd>Alt</kbd>+<kbd>I</kbd></span>
          <span>Price Ticker</span>
        </div>
      </div>
    </div>

    <div class="shortcut-section">
      <h3>Workspace</h3>
      <div class="shortcut-list">
        <div class="shortcut-item">
          <span class="keys"><kbd>Alt</kbd>+<kbd>W</kbd></span>
          <span>Workspace Controls</span>
        </div>
        <div class="shortcut-item">
          <span class="keys"><kbd>Alt</kbd>+<kbd>R</kbd></span>
          <span>Reinit Connections</span>
        </div>
        <div class="shortcut-item">
          <span class="keys"><kbd>Alt</kbd>+<kbd>M</kbd></span>
          <span>Toggle Market Profile</span>
        </div>
        <div class="shortcut-item">
          <span class="keys"><kbd>H</kbd></span>
          <span>Headlines</span>
        </div>
        <div class="shortcut-item">
          <span class="keys"><kbd>Esc</kbd></span>
          <span>Close / Clear Focus</span>
        </div>
      </div>
    </div>

    <div class="shortcut-section">
      <h3>Help</h3>
      <div class="shortcut-list">
        <div class="shortcut-item">
          <span class="keys"><kbd>Hold</kbd>+<kbd>?</kbd></span>
          <span>Show This Help</span>
        </div>
      </div>
    </div>
  </div>
</div>
{/if}

<style>
  .shortcuts-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    backdrop-filter: blur(8px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .shortcuts-content {
    background: rgb(20, 20, 35);
    border: 1px solid rgb(79, 70, 229);
    border-radius: 8px;
    padding: 16px;
    min-width: 260px;
    max-width: 90vw;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .shortcuts-content h2 {
    margin: 0 0 12px 0;
    color: white;
    font-size: 16px;
    text-align: center;
    font-weight: 600;
  }

  .shortcut-section {
    margin-bottom: 10px;
  }

  .shortcut-section:last-child {
    margin-bottom: 0;
  }

  .shortcut-section h3 {
    margin: 0 0 6px 0;
    color: rgb(167, 139, 250);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
    font-size: 13px;
  }

  .shortcut-item span:last-child {
    color: rgb(199, 210, 254);
  }

  .keys {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    background: linear-gradient(180deg, rgb(60, 60, 80) 0%, rgb(40, 40, 55) 100%);
    border: 1px solid rgb(80, 80, 100);
    border-radius: 4px;
    color: white;
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
    font-size: 11px;
    font-weight: 500;
    box-shadow: 0 1px 0 rgb(30, 30, 40);
  }
</style>
