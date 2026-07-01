<script>
  import { displayStore } from '../stores/displayStore.js';
  import { workspaceActions, headlinesStore } from '../stores/workspace.js';
  import { logout } from '../stores/authStore.js';
  import { formatSymbol } from '../lib/displayDataProcessor.js';
  import { keyManager } from '../lib/keyManager.js';

  // AddMenu — the `+` floating button (top-right) + expand menu. Replaces browser prompt()
  // for adding displays with a native symbol field; surfaces Chart/News toggles, shortcuts, logout.
  export let open = false;
  export let preselect = null;          // bind — keyboard opens with a type pre-selected
  export let onToggleChart = () => {};  // Chart toggle (Workspace-local fn)
  export let onOpenShortcuts = () => {};

  let activeType = null;   // null = list; 'ctrader' | 'tradingview' | 'ticker' = symbol entry
  let symbol = '';

  // Per-type compact spawn sizes (Task 7 — addDisplay/addPriceTicker now honor a size arg).
  const SIZES = { panel: { width: 220, height: 360 }, basket: { width: 360, height: 360 } };
  const TYPE_LABEL = { ticker: 'Price Ticker', ctrader: 'cTrader', tradingview: 'TradingView' };
  // AddMenu type → data source (single-sourced; ticker is backed by TradingView).
  const SOURCE = { ticker: 'tradingview', ctrader: 'ctrader', tradingview: 'tradingview' };

  // Singleton toggle states.
  $: chartOpen = Array.from($displayStore.displays.values()).some(d => d.type === 'chart');
  $: newsOpen = $headlinesStore.headlinesVisible;

  // Consume a keyboard preselect (jump straight to symbol entry); reset on close.
  // Inlined so Svelte tracks open/preselect as dependencies (reads inside a called fn are not tracked).
  $: {
    if (open && preselect) {
      activeType = preselect;
      preselect = null; // consume so the next `+` open shows the list
    } else if (!open) {
      activeType = null;
      symbol = '';
    }
  }

  // Escape-to-close via the keyManager escape stack (absolute priority).
  let escapePop = null;
  $: {
    if (open && !escapePop) {
      escapePop = keyManager.pushEscape(() => { open = false; });
    } else if (!open && escapePop) {
      escapePop();
      escapePop = null;
    }
  }

  function toggle() { open ? close() : openMenu(); }
  function openMenu() { open = true; preselect = null; activeType = null; }
  function close() { open = false; }
  function pick(type) { activeType = type; symbol = ''; }

  function focusInput(node) { node.focus(); }

  function addSymbol() {
    const sym = symbol.trim();
    if (!sym) return;
    const source = SOURCE[activeType];
    if (activeType === 'ticker') {
      workspaceActions.addPriceTicker(formatSymbol(sym, source), null, source);
    } else {
      workspaceActions.addDisplay(formatSymbol(sym, source), null, source, SIZES.panel);
    }
    close();
  }
  function addBasket() {
    workspaceActions.addDisplay('FX_BASKET', null, 'ctrader', SIZES.basket);
    close();
  }
  function onSymbolKeydown(e) {
    if (e.key === 'Enter') { e.preventDefault(); addSymbol(); }
    else if (e.key === 'Backspace' && symbol === '') { activeType = null; }
  }
</script>

<div class="add-menu-root">
  <button type="button" class="fab" class:active={open} on:click={toggle}
    aria-label={open ? 'Close add menu' : 'Add display'} aria-expanded={open} title="Add display">
    <span class="fab-glyph">+</span>
  </button>

  {#if open}
    <div class="backdrop" on:click={close} role="presentation"></div>

    <div class="panel" role="menu" aria-label="Add display">
      {#if activeType}
        <div class="symbol-entry">
          <label class="entry-label" for="add-symbol">{TYPE_LABEL[activeType]} symbol</label>
          <input id="add-symbol" class="symbol-input" bind:value={symbol} use:focusInput
            placeholder="e.g. EURUSD" autocomplete="off" spellcheck="false"
            on:keydown={onSymbolKeydown} />
          <div class="row">
            <button type="button" class="btn ghost" on:click={() => (activeType = null)}>‹ Back</button>
            <button type="button" class="btn primary" on:click={addSymbol}>Add</button>
          </div>
        </div>
      {:else}
        <div class="section-label">Add</div>
        <button type="button" class="item" role="menuitem" on:click={() => pick('ticker')}>Price Ticker<span class="kbd">Alt+I</span></button>
        <button type="button" class="item" role="menuitem" on:click={() => pick('ctrader')}>cTrader Display<span class="kbd">Alt+A</span></button>
        <button type="button" class="item" role="menuitem" on:click={() => pick('tradingview')}>TradingView Display<span class="kbd">Alt+T</span></button>
        <button type="button" class="item" role="menuitem" on:click={addBasket}>FX Basket<span class="kbd">Alt+B</span></button>

        <div class="section-label">Toggle</div>
        <button type="button" class="item" role="menuitem" on:click={() => { onToggleChart(); close(); }}>Chart<span class="kbd">c · {chartOpen ? 'Open' : 'Closed'}</span></button>
        <button type="button" class="item" role="menuitem" on:click={() => { workspaceActions.toggleHeadlines(); close(); }}>News<span class="kbd">H · {newsOpen ? 'Open' : 'Closed'}</span></button>

        <div class="section-label"></div>
        <button type="button" class="item" role="menuitem" on:click={() => { onOpenShortcuts(); close(); }}>Shortcuts<span class="kbd">?</span></button>
        <button type="button" class="item danger" role="menuitem" on:click={logout}>Logout</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .add-menu-root { position: fixed; top: var(--sp-4); right: var(--sp-4); z-index: var(--z-overlay); }

  .fab {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--bg-frame); border: 1px solid var(--accent); color: var(--accent);
    font-size: var(--fs-20); line-height: 1; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .2s ease, color .2s ease, box-shadow .2s ease;
    box-shadow: var(--glow-focus);
  }
  .fab:hover, .fab:focus { background: var(--accent); color: var(--text-primary); outline: none; }
  .fab.active { background: var(--accent); color: var(--text-primary); }
  .fab-glyph { transform: translateY(-1px); }

  .backdrop { position: fixed; inset: 0; z-index: 9999; }

  .panel {
    position: fixed; top: calc(var(--sp-4) + 32px + var(--sp-2)); right: var(--sp-4);
    width: 224px; padding: var(--sp-2) 0;
    background: var(--bg-frame); border: 1px solid var(--border); border-radius: var(--r-md);
    box-shadow: var(--glow-focus); z-index: var(--z-overlay);
    font-family: var(--font-ui);
  }

  .section-label {
    padding: var(--sp-2) var(--sp-4); font-size: var(--fs-10); color: var(--text-muted);
    text-transform: uppercase; letter-spacing: .04em;
  }

  .item {
    width: 100%; display: flex; justify-content: space-between; align-items: center;
    padding: var(--sp-2) var(--sp-4); background: none; border: none;
    color: var(--text-secondary); font-size: var(--fs-12); font-family: var(--font-ui);
    cursor: pointer; text-align: left; transition: background .15s ease, color .15s ease;
  }
  .item:hover, .item:focus { background: var(--border); color: var(--text-primary); outline: none; }
  .item.danger:hover, .item.danger:focus { color: var(--status-bad); }
  .kbd { color: var(--text-muted); font-size: var(--fs-10); font-family: var(--font-mono); }

  .symbol-entry { padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); }
  .entry-label { font-size: var(--fs-11); color: var(--text-label); }
  .symbol-input {
    width: 100%; box-sizing: border-box; padding: var(--sp-2) var(--sp-3);
    background: var(--bg-app); border: 1px solid var(--border); border-radius: var(--r-sm);
    color: var(--text-primary); font-family: var(--font-mono); font-size: var(--fs-12);
  }
  .symbol-input:focus { outline: 1px solid var(--accent); }
  .row { display: flex; justify-content: space-between; gap: var(--sp-2); margin-top: var(--sp-1); }
  .btn {
    flex: 1; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); cursor: pointer;
    font-family: var(--font-ui); font-size: var(--fs-12); transition: background .15s ease, color .15s ease;
  }
  .btn.ghost { background: none; border: 1px solid var(--border); color: var(--text-muted); }
  .btn.ghost:hover, .btn.ghost:focus { color: var(--text-primary); outline: none; }
  .btn.primary { background: var(--accent); border: 1px solid var(--accent); color: var(--text-primary); }
  .btn.primary:hover, .btn.primary:focus { filter: brightness(0.9); outline: none; }

  /* Keyboard-focus ring (mouse-click focus keeps the background affordance only). */
  .fab:focus-visible, .item:focus-visible, .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
