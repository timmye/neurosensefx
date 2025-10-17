<script>
  // Select Control Component
  // Reusable dropdown for select parameters
  
  export let parameter = '';
  export let label = '';
  export let value = '';
  export let options = [];
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
  <label for="select-{parameter}">{label}</label>
  <div class="control-input">
    <select 
      id="select-{parameter}"
      bind:value={value}
      on:change={handleChange}
      on:keydown={handleKeyDown}
    >
      {#each options as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
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
  
  .control-row select {
    background: #374151;
    border: 1px solid #4b5563;
    color: #e5e7eb;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    min-width: 100px;
    cursor: pointer;
    width: 100%;
    outline: none;
    transition: border-color 0.2s ease;
  }
  
  .control-row select:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.3);
  }
  
  .control-row select:hover {
    border-color: #6b7280;
  }
  
  .control-row select option {
    background: #374151;
    color: #e5e7eb;
  }
  
  .control-row select option:hover {
    background: #4b5563;
  }
  
  /* Custom dropdown arrow */
  .control-row select {
    appearance: none;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 12px;
    padding-right: 32px;
  }
</style>