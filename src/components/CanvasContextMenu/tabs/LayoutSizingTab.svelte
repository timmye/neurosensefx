<script>
  import { createEventDispatcher } from 'svelte';
  import { layoutSizingGroup } from '../utils/parameterGroups.js';
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
      title: 'Canvas Dimensions',
      controls: [
        'visualizationsContentWidth',
        'meterHeight',
        'centralAxisXPosition'
      ]
    },
    {
      title: 'ADR Label',
      controls: [
        'adrLabelType',
        'adrRangeIndicatorLabelColor',
        'adrRangeIndicatorLabelShowBackground'
      ]
    },
    {
      title: 'ADR Label Background',
      controls: [
        'adrRangeIndicatorLabelBackgroundColor',
        'adrRangeIndicatorLabelBackgroundOpacity',
        'adrRangeIndicatorLabelShowBoxOutline'
      ]
    },
    {
      title: 'ADR Label Box',
      controls: [
        'adrRangeIndicatorLabelBoxOutlineColor',
        'adrRangeIndicatorLabelBoxOutlineOpacity'
      ]
    },
    {
      title: 'Price Colors',
      controls: [
        'priceStaticColor'
      ]
    }
  ];
  
  function handleChange(parameter, value) {
    onParameterChange(parameter, value);
  }
  
  function renderControl(controlKey) {
    const controlType = layoutSizingGroup.controlTypes[controlKey];
    
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
      label: layoutSizingGroup.labels[controlKey],
      value: config[controlKey],
      onChange: handleChange,
      options: layoutSizingGroup.controlOptions?.[controlKey],
      min: layoutSizingGroup.ranges?.[controlKey]?.min,
      max: layoutSizingGroup.ranges?.[controlKey]?.max,
      step: layoutSizingGroup.ranges?.[controlKey]?.step
    };
  }
</script>

<div class="tab-content">
  <div class="tab-header">
    <h3>Layout & Sizing</h3>
    <p class="tab-description">Dimensions and positioning</p>
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
  
  <div class="layout-sizing-footer">
    <p class="tip">💡 Tip: Adjust canvas dimensions to fit your workspace layout</p>
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
  
  .layout-sizing-footer {
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