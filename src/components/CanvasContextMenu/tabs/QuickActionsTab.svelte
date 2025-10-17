<script>
  import { createEventDispatcher } from 'svelte';
  import { quickActionsGroup } from '../utils/parameterGroups.js';
  import ToggleControl from '../controls/ToggleControl.svelte';
  
  export let config = {};
  export let onParameterChange = () => {};
  
  const dispatch = createEventDispatcher();
  
  // Get control metadata for this tab
  const controlMetadata = quickActionsGroup.parameters.map(param => ({
    key: param,
    label: quickActionsGroup.labels[param],
    type: quickActionsGroup.controlTypes[param]
  }));
  
  function handleChange(parameter, value) {
    onParameterChange(parameter, value);
  }
</script>

<div class="tab-content">
  <div class="tab-header">
    <h3>Quick Actions</h3>
    <p class="tab-description">Essential toggles and show/hide controls</p>
  </div>
  
  <div class="controls-grid">
    {#each controlMetadata as control}
      <div class="control-item">
        <ToggleControl 
          parameter={control.key}
          label={control.label}
          value={config[control.key]}
          onChange={handleChange}
        />
      </div>
    {/each}
  </div>
  
  <div class="quick-actions-footer">
    <p class="tip">💡 Tip: Toggle multiple controls to customize your visualization</p>
  </div>
</div>

<style>
  .tab-content {
    padding: 16px;
  }
  
  .tab-header {
    margin-bottom: 20px;
  }
  
  .tab-header h3 {
    margin: 0 0 4px 0;
    color: #d1d5db;
    font-size: 16px;
    font-weight: 600;
  }
  
  .tab-description {
    margin: 0;
    color: #9ca3af;
    font-size: 12px;
  }
  
  .controls-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .control-item {
    background: #374151;
    border-radius: 6px;
    padding: 12px;
    transition: background-color 0.2s ease;
  }
  
  .control-item:hover {
    background: #4b5563;
  }
  
  .quick-actions-footer {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #4b5563;
  }
  
  .tip {
    margin: 0;
    color: #6b7280;
    font-size: 11px;
    font-style: italic;
    text-align: center;
  }
</style>