<script>
  // Toggle Control Component
  // Reusable checkbox/toggle control for boolean parameters
  
  export let parameter = '';
  export let label = '';
  export let value = false;
  export let onChange = () => {};
  
  function handleChange() {
    onChange(parameter, value);
  }
</script>

<div class="control-row">
  <label for="toggle-{parameter}">{label}</label>
  <div class="control-input">
    <input 
      id="toggle-{parameter}"
      type="checkbox" 
      bind:checked={value}
      on:change={handleChange}
    />
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
  }
  
  .control-row input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #4f46e5;
    cursor: pointer;
  }
  
  .control-row input[type="checkbox"]:focus {
    outline: 2px solid #4f46e5;
    outline-offset: 1px;
  }
</style>