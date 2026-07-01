<script>
  import { onMount, onDestroy } from 'svelte';
  import { createInteractConfig } from '../../lib/interactSetup.js';

  // DisplayFrame — shared chrome for floating displays. Owns: absolute positioning,
  // frame bg/border/radius, selection ring (--select) + focus glow (--accent), optional
  // ticker flash border, the resize handle, and the interact.js drag/resize/snap setup.
  // Adopted by FloatingDisplay, FxBasketDisplay, HeadlinesWidget.
  // (PriceTicker keeps its own shell this phase — tuned rAF flash — token-only migration.)
  export let position;          // { x, y }
  export let size;              // { width, height }
  export let zIndex = null;     // omit for widgets that don't stack (Headlines)
  export let selected = false;  // green ring on the chart-driving display
  export let resizable = true;
  export let flash = null;      // 'up' | 'down' | null — ticker-only; null for all current adopters
  export let flashDuration = 500;
  export let tabindex = null;   // 0 for selectable displays; null for Headlines
  export let role = null;
  export let ariaLabel = null;
  export let dataId = null;     // rendered as data-display-id (selectNextDisplay focus query)
  export let onFocus = null;    // focus → select + bringToFront (parent wires)
  export let interactCallbacks = {};  // { onDragMove, onResizeMove, onTap, ignoreFrom, resizable }
  export let bindElement = null;      // callback(node) — exposes root to parent (Alt+M focus check)

  let rootNode;
  let interactable;

  $: frameStyle =
    `left: ${position?.x}px; top: ${position?.y}px; width: ${size?.width}px; height: ${size?.height}px;` +
    (zIndex != null ? ` z-index: ${zIndex};` : '') +
    ` --flash-duration: ${flashDuration}ms;`;

  // Expose the root node to the parent ONCE on mount. (Not in a reactive statement —
  // parents pass an inline arrow whose identity changes each render, and calling it
  // from a `$:` block creates a cross-component make_dirty cycle → infinite loop.)
  // Wrap onFocus so passing no handler (Headlines) doesn't attach a null listener.
  function handleFocus(e) { onFocus?.(e); }

  onMount(() => {
    if (rootNode && bindElement) bindElement(rootNode);
    if (rootNode) interactable = createInteractConfig(rootNode, interactCallbacks);
  });

  onDestroy(() => {
    interactable?.unset();
  });
</script>

<div class="display-frame"
     bind:this={rootNode}
     class:selected
     class:flashable={flash !== null}
     class:flash-up={flash === 'up'}
     class:flash-down={flash === 'down'}
     {tabindex}
     {role}
     aria-label={ariaLabel}
     data-display-id={dataId}
     on:focus={handleFocus}
     style={frameStyle}>
  <slot name="header" />
  <slot />
  {#if resizable}<div class="resize-handle"></div>{/if}
</div>

<style>
  .display-frame {
    position: absolute;
    background: var(--bg-frame);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
    user-select: none;
    outline: none;
    transition: border-color .2s ease, box-shadow .2s ease;
    font-family: var(--font-ui);
  }
  /* Keyboard focus — blue glow. Superseded by the green selection ring below when selected. */
  .display-frame:focus {
    border-color: var(--accent);
    box-shadow: var(--glow-focus);
  }
  /* Selection — green ring on the focused / chart-driving display. */
  .display-frame.selected,
  .display-frame.selected:focus {
    border-color: var(--select);
    box-shadow: var(--glow-select);
  }
  /* Ticker flash border — gated behind .flashable so non-flashing frames are unaffected. */
  .display-frame.flashable:not(:focus) {
    transition: border-color var(--flash-duration, 500ms) ease-out;
  }
  .display-frame.flashable:not(:focus).flash-up {
    border-color: var(--flash-up);
    transition: none;
  }
  .display-frame.flashable:not(:focus).flash-down {
    border-color: var(--flash-down);
    transition: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .display-frame.flashable:not(:focus).flash-up,
    .display-frame.flashable:not(:focus).flash-down {
      transition: none;
    }
  }
  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, transparent 50%, var(--text-muted) 50%);
    cursor: se-resize;
    opacity: .6;
    transition: opacity .2s ease;
  }
  .resize-handle:hover { opacity: 1; }
</style>
