<script>
  // Color Control Component
  // Reusable color picker for color parameters
  
  export let parameter = '';
  export let label = '';
  export let value = '#ffffff';
  export let onChange = () => {};
  
  function handleChange() {
    onChange(parameter, value);
  }
  
  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      handleChange();
    }
  }
</script>

<div class="control-row">
  <label for="color-{parameter}">{label}</label>
  <div class="control-input">
    <div class="color-container">
      <input 
        id="color-{parameter}"
        type="color" 
        bind:value={value}
        on:change={handleChange}
      />
      <input 
        type="text" 
        class="color-text"
        bind:value={value}
        on:keydown={handleKeyDown}
        on:blur={handleChange}
        placeholder="#ffffff"
      />
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
  
  .color-container {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  
  .control-row input[type="color"] {
    width: 32px;
    height: 24px;
    padding: 0;
    border: 1px solid #4b5563;
    border-radius: 4px;
    cursor: pointer;
    background: #374151;
    flex-shrink: 0;
  }
  
  .control-row input[type="color"]:focus {
    outline: 2px solid #4f46e5;
    outline-offset: 1px;
  }
  
  .color-text {
    flex: 1;
    background: #374151;
    border: 1px solid #4b5563;
    color: #e5e7eb;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    font-family: 'Courier New', monospace;
    min-width: 0;
    text-transform: lowercase;
  }
  
  .color-text:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.3);
  }
  
  .color-text::placeholder {
    color: #6b7280;
  }
</style>