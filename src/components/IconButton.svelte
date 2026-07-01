<script>
  // IconButton — one chrome for icon buttons (↻ refresh, × close, …). Replaces the
  // per-component button style blocks that were copy-pasted across DisplayHeader/Headlines.
  // variant: 'ghost' (hover → accent, e.g. refresh) | 'subtle' (hover → primary, e.g. close).
  // Click is forwarded so parents use on:click={...}.
  export let variant = 'ghost';
  export let label = '';
  export let title = '';
  export let fontSize = 'var(--fs-14)';
</script>

<button type="button" class="icon-btn {variant}" style="font-size:{fontSize}"
  aria-label={label} title={title} on:click>
  <slot />
</button>

<style>
  .icon-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px 3px;
    border-radius: var(--r-sm);
    line-height: 1;
    font-family: var(--font-ui);
    transition: background .2s ease, color .2s ease;
  }
  .icon-btn:hover,
  .icon-btn:focus { background: var(--border); }
  .icon-btn:focus { outline: 1px solid var(--accent); }
  .icon-btn.ghost:hover,
  .icon-btn.ghost:focus { color: var(--accent); }
  .icon-btn.subtle:hover,
  .icon-btn.subtle:focus { color: var(--text-primary); }
</style>
