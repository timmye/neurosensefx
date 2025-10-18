<script>
  // Props
  export let title = '';
  export let level = 4; // Default to h4
  export let showBorder = true;
  export let uppercase = true;
  export let letterSpacing = '0.5px';
  export let fontSize = '11px';
  export let fontWeight = '600';
  export let marginBottom = '8px';
  export let paddingBottom = '4px';
  
  // CSS classes
  $: headerClass = `section-header level-${level} ${showBorder ? 'with-border' : 'no-border'} ${uppercase ? 'uppercase' : ''}`;
  
  // CSS styles
  $: headerStyle = `
    --letter-spacing: ${letterSpacing};
    --font-size: ${fontSize};
    --font-weight: ${fontWeight};
    --margin-bottom: ${marginBottom};
    --padding-bottom: ${paddingBottom};
  `;
</script>

<!-- Use conditional rendering for heading tags -->
{#if level === 1}
  <h1 class={headerClass} style={headerStyle}>{title}</h1>
{:else if level === 2}
  <h2 class={headerClass} style={headerStyle}>{title}</h2>
{:else if level === 3}
  <h3 class={headerClass} style={headerStyle}>{title}</h3>
{:else if level === 4}
  <h4 class={headerClass} style={headerStyle}>{title}</h4>
{:else if level === 5}
  <h5 class={headerClass} style={headerStyle}>{title}</h5>
{:else}
  <h6 class={headerClass} style={headerStyle}>{title}</h6>
{/if}

<style>
  .section-header {
    margin: 0 0 var(--margin-bottom) 0;
    color: #d1d5db;
    font-size: var(--font-size);
    font-weight: var(--font-weight);
    letter-spacing: var(--letter-spacing);
    transition: color 0.2s ease;
  }
  
  .section-header.with-border {
    border-bottom: 1px solid #374151;
    padding-bottom: var(--padding-bottom);
  }
  
  .section-header.no-border {
    padding-bottom: 0;
  }
  
  .section-header.uppercase {
    text-transform: uppercase;
  }
  
  /* Level-specific styles */
  .level-1 {
    --font-size: 16px;
    --font-weight: 700;
    --margin-bottom: 12px;
  }
  
  .level-2 {
    --font-size: 14px;
    --font-weight: 600;
    --margin-bottom: 10px;
  }
  
  .level-3 {
    --font-size: 12px;
    --font-weight: 600;
    --margin-bottom: 8px;
  }
  
  .level-4 {
    --font-size: 11px;
    --font-weight: 600;
    --margin-bottom: 8px;
  }
  
  .level-5 {
    --font-size: 10px;
    --font-weight: 500;
    --margin-bottom: 6px;
  }
  
  .level-6 {
    --font-size: 10px;
    --font-weight: 500;
    --margin-bottom: 4px;
  }
</style>