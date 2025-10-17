<script>
  import { createEventDispatcher } from 'svelte';
  import { advancedGroup } from '../utils/parameterGroups.js';
  import ToggleControl from '../controls/ToggleControl.svelte';
  import RangeControl from '../controls/RangeControl.svelte';
  import ColorControl from '../controls/ColorControl.svelte';
  import SelectControl from '../controls/SelectControl.svelte';
  
  export let config = {};
  export let onParameterChange = () => {};
  
  const dispatch = createEventDispatcher();
  
  // Group controls by type for better organization
  const controlSections = [
    {
      title: 'Performance',
      controls: [
        'frequencyMode'
      ]
    },
    {
      title: 'Marker Lines',
      controls: [
        'markerLineColor',
        'markerLineThickness'
      ]
    },
    {
      title: 'Hover Labels',
      controls: [
        'hoverLabelShowBackground',
        'hoverLabelBackgroundColor',
        'hoverLabelBackgroundOpacity'
      ]
    },
    {
      title: 'P-High/P-Low Labels',
      controls: [
        'pHighLowLabelBoxOutlineColor',
        'pHighLowLabelBoxOutlineOpacity'
      ]
    },
    {
      title: 'OHL Labels',
      controls: [
        'ohlLabelShowBackground',
        'ohlLabelBackgroundColor',
        'ohlLabelBackgroundOpacity',
        'ohlLabelShowBoxOutline',
        'ohlLabelBoxOutlineColor',
        'ohlLabelBoxOutlineOpacity'
      ]
    },
    {
      title: 'Price Colors',
      controls: [
        'priceUpColor',
        'priceDownColor',
        'priceBoxOutlineColor',
        'priceBoxOutlineOpacity'
      ]
    }
  ];
  
  function handleChange(parameter, value) {
    onParameterChange(parameter, value);
  }
  
  function renderControl(controlKey) {
    const controlType = advancedGroup.controlTypes[controlKey];
    
    switch (controlType) {
      case 'toggle':
        return ToggleControl;
      case 'range':
        return RangeControl;
      case 'color':
        return ColorControl;
      case 'select':
        return SelectControl;
      default:
        return null;
    }
  }
  
  function getControlProps(controlKey) {
    return {
      parameter: controlKey,
      label: advancedGroup.labels[controlKey],
      value: config[controlKey],
      onChange: handleChange,
      options: advancedGroup.controlOptions?.[controlKey],
      min: advancedGroup.ranges?.[controlKey]?.min,
      max: advancedGroup.ranges?.[controlKey]?.max,
      step: advancedGroup.ranges?.[controlKey]?.step
    };
  }
</script>

<div class="tab-content">
  <div class="tab-header">
    <h3>Advanced</h3>
    <p class="tab-description">Power user and experimental features</p>
  </div>
  
  <div class="warning-banner">
    <p class="warning-text">⚠️ These settings are for advanced users. Changes may affect performance.</p>
  </div>
  
  {#each controlSections as section}
    <div class="control-section">
      <h4 class="section-title">{section.title}</h4>
      <div class="controls-grid">
        {#each section.controls as controlKey}
          <div class="control-item">
            <svelte:component 
              this={renderControl(controlKey)} 
              {...getControlProps(controlKey)}
            />
          </div>
        {/each}
      </div>
    </div>
  {/each}
  
  <div class="advanced-footer">
    <p class="tip">💡 Tip: Use frequency mode to balance performance vs. visual quality</p>
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
  
  .warning-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 20px;
  }
  
  .warning-text {
    margin: 0;
    color: #fca5a5;
    font-size: 12px;
    font-weight: 500;
  }
  
  .control-section {
    margin-bottom: 24px;
  }
  
  .section-title {
    margin: 0 0 12px 0;
    color: #e5e7eb;
    font-size: 14px;
    font-weight: 500;
    padding-bottom: 6px;
    border-bottom: 1px solid #4b5563;
  }
  
  .controls-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
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
  
  .advanced-footer {
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