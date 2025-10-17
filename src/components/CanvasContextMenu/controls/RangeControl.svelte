<script>
  // Range Control Component
  // Reusable range slider for numeric parameters
  
  export let parameter = '';
  export let label = '';
  export let value = 0;
  export let min = 0;
  export let max = 100;
  export let step = 1;
  export let onChange = () => {};
  
  function handleChange() {
    onChange(parameter, parseFloat(value));
  }
  
  function handleKeyDown(event) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      value = Math.min(parseFloat(value) + step, max);
      handleChange();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      value = Math.max(parseFloat(value) - step, min);
      handleChange();
    }
  }
</script>

<div class="control-row">
  <label for="range-{parameter}">{label}</label>
  <div class="control-input">
    <div class="range-container">
      <input 
        id="range-{parameter}"
        type="range" 
        min={min} 
        max={max} 
        step={step}
        bind:value={value}
        on:change={handleChange}
        on:keydown={handleKeyDown}
      />
      <span class="range-value">{value}</span>
    </div>
  </div>
</div>

<style>
  .control-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    gap: 12px;
  }
  
  .control-row:last-child {
    margin-bottom: 0;
  }
  
  .control-row label {
    color: #9ca3af;
    font-size: 12px;
    flex: 1;
    min-width: 0;
  }
  
  .control-input {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1;
  }
  
  .range-container {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  
  .control-row input[type="range"] {
    flex: 1;
    height: 4px;
    background: #374151;
    border-radius: 2px;
    outline: none;
    accent-color: #4f46e5;
    cursor: pointer;
  }
  
  .control-row input[type="range"]:focus {
    outline: none;
  }
  
  .control-row input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: #4f46e5;
    border-radius: 50%;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .control-row input[type="range"]::-webkit-slider-thumb:hover {
    background: #6366f1;
  }
  
  .control-row input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #4f46e5;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    transition: background-color 0.2s ease;
  }
  
  .control-row input[type="range"]::-moz-range-thumb:hover {
    background: #6366f1;
  }
  
  .range-value {
    color: #d1d5db;
    font-size: 11px;
    font-family: 'Courier New', monospace;
    min-width: 40px;
    text-align: right;
    background: #374151;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #4b5563;
  }
</style>