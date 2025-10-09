<script>
  import { createEventDispatcher } from 'svelte';
  import { Badge, Icon, Toggle } from '../atoms/index.js';
  
  export let indicators = [];
  export let activeIndicators = [];
  export let disabled = false;
  export let compact = false;
  export let showSettings = true;
  
  const dispatch = createEventDispatcher();
  
  function handleToggle(indicatorId, isActive) {
    if (isActive) {
      activeIndicators = [...activeIndicators, indicatorId];
    } else {
      activeIndicators = activeIndicators.filter(id => id !== indicatorId);
    }
    
    dispatch('indicatorsChange', { 
      indicatorId, 
      isActive, 
      activeIndicators 
    });
  }
  
  function handleSettings(indicator) {
    dispatch('indicatorSettings', { indicator });
  }
  
  function handleReorder(direction, indicatorId) {
    dispatch('indicatorReorder', { direction, indicatorId });
  }
  
  function getIndicatorIcon(type) {
    switch (type) {
      case 'priceFloat': return 'minus';
      case 'marketProfile': return 'bar-chart-2';
      case 'volatilityOrb': return 'circle';
      case 'adrMeter': return 'gauge';
      case 'priceDisplay': return 'dollar-sign';
      default: return 'box';
    }
  }
  
  function getIndicatorColor(type) {
    switch (type) {
      case 'priceFloat': return 'primary';
      case 'marketProfile': return 'success';
      case 'volatilityOrb': return 'warning';
      case 'adrMeter': return 'info';
      case 'priceDisplay': return 'muted';
      default: return 'default';
    }
  }
</script>

<div class="indicator-toggle" class:compact class:disabled>
  <div class="indicator-list">
    {#each indicators as indicator, index (indicator.id)}
      <div 
        class="indicator-item"
        class:active={activeIndicators.includes(indicator.id)}
        class:disabled={disabled || indicator.disabled}
      >
        <!-- Drag Handle -->
        {#if !compact}
          <div class="drag-handle">
            <Icon name="grip-vertical" size="sm" variant="muted" />
          </div>
        {/if}
        
        <!-- Indicator Info -->
        <div class="indicator-info">
          <div class="indicator-header">
            <div class="indicator-icon">
              <Icon 
                name={getIndicatorIcon(indicator.type)} 
                variant={getIndicatorColor(indicator.type)}
                size={compact ? 'sm' : 'md'}
              />
            </div>
            
            <div class="indicator-details">
              <h4 class="indicator-name">{indicator.name}</h4>
              {#if !compact}
                <p class="indicator-description">{indicator.description}</p>
              {/if}
            </div>
          </div>
          
          <!-- Indicator Metadata -->
          {#if !compact}
            <div class="indicator-meta">
              {#if indicator.category}
                <Badge variant="outline" size="xs">
                  {indicator.category}
                </Badge>
              {/if}
              
              {#if indicator.performance?.cost}
                <Badge variant="subtle" size="xs">
                  {indicator.performance.cost}ms
                </Badge>
              {/if}
            </div>
          {/if}
        </div>
        
        <!-- Indicator Controls -->
        <div class="indicator-controls">
          <!-- Settings Button -->
          {#if showSettings && indicator.hasSettings}
            <button 
              class="control-button settings"
              on:click={() => handleSettings(indicator)}
              disabled={disabled || !activeIndicators.includes(indicator.id)}
              title="Indicator settings"
            >
              <Icon name="settings" size="sm" />
            </button>
          {/if}
          
          <!-- Reorder Buttons -->
          {#if !compact && indicators.length > 1}
            <div class="reorder-controls">
              <button 
                class="control-button reorder"
                on:click={() => handleReorder('up', indicator.id)}
                disabled={disabled || index === 0}
                title="Move up"
              >
                <Icon name="chevron-up" size="sm" />
              </button>
              
              <button 
                class="control-button reorder"
                on:click={() => handleReorder('down', indicator.id)}
                disabled={disabled || index === indicators.length - 1}
                title="Move down"
              >
                <Icon name="chevron-down" size="sm" />
              </button>
            </div>
          {/if}
          
          <!-- Toggle Switch -->
          <Toggle
            checked={activeIndicators.includes(indicator.id)}
            disabled={disabled || indicator.disabled}
            on:change={(e) => handleToggle(indicator.id, e.detail)}
            size={compact ? 'sm' : 'md'}
          />
        </div>
      </div>
    {/each}
  </div>
  
  <!-- Empty State -->
  {#if indicators.length === 0}
    <div class="empty-state">
      <Icon name="layers" size="lg" variant="muted" />
      <h3>No Indicators Available</h3>
      <p>Add indicators to customize your canvas visualization.</p>
    </div>
  {/if}
</div>

<style>
  .indicator-toggle {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .indicator-toggle.compact {
    gap: var(--space-1);
  }
  
  .indicator-toggle.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  
  .indicator-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .indicator-toggle.compact .indicator-list {
    gap: var(--space-1);
  }
  
  .indicator-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .indicator-toggle.compact .indicator-item {
    padding: var(--space-2);
    gap: var(--space-2);
  }
  
  .indicator-item:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-hover);
  }
  
  .indicator-item.active {
    background: var(--color-primary-subtle);
    border-color: var(--color-primary);
  }
  
  .indicator-item.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  
  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    color: var(--text-tertiary);
  }
  
  .drag-handle:active {
    cursor: grabbing;
  }
  
  .indicator-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }
  
  .indicator-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  
  .indicator-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .indicator-details h4 {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .indicator-details p {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .indicator-meta {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  
  .indicator-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .control-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .control-button:hover:not(:disabled) {
    background: var(--bg-elevated);
    border-color: var(--border-default);
    color: var(--text-primary);
  }
  
  .control-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  .control-button.settings:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  
  .reorder-controls {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  
  .reorder-controls .control-button {
    width: 20px;
    height: 20px;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--space-8) var(--space-4);
    gap: var(--space-4);
  }
  
  .empty-state h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .empty-state p {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    max-width: 300px;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .indicator-item {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
    
    .indicator-controls {
      width: 100%;
      justify-content: space-between;
    }
    
    .reorder-controls {
      flex-direction: row;
    }
  }
</style>
