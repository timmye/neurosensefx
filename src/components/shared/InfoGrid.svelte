<script>
  // Props
  export let data = [];
  export let columns = 2; // Default to 2 columns
  export let fontSize = '11px';
  export let gap = '4px 8px';
  
  // Validate data structure
  $: isValidData = Array.isArray(data) && data.length > 0;
  
  // Format values for display
  function formatValue(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      // If the value is already a string with formatted number, return as is
      return value;
    }
    return String(value);
  }
</script>

{#if isValidData}
  <div class="info-grid" style="--columns: {columns}; --font-size: {fontSize}; --gap: {gap};">
    {#each data as item}
      <span class="info-label">{item.label}</span>
      <span class="info-value">{formatValue(item.value)}</span>
    {/each}
  </div>
{:else}
  <div class="no-data">No data available</div>
{/if}

<style>
  .info-grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), auto 1fr);
    gap: var(--gap);
    font-size: var(--font-size);
  }
  
  .info-label {
    color: #9ca3af;
    font-weight: 500;
  }
  
  .info-value {
    color: #e5e7eb;
    text-align: right;
  }
  
  .no-data {
    text-align: center;
    padding: 8px;
    color: #6b7280;
    font-size: var(--font-size);
    font-style: italic;
  }
</style>