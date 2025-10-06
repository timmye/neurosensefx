<script>
  import { createEventDispatcher } from 'svelte';
  import { Button, Icon, Badge } from '../atoms/index.js';
  
  // Component props
  export let title = '';
  export let subtitle = '';
  export let description = '';
  export let variant = 'default'; // 'default', 'elevated', 'outlined', 'filled'
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let status = 'default'; // 'default', 'success', 'warning', 'danger', 'info'
  export let bordered = true;
  export let rounded = true;
  export let shadow = false;
  export let collapsible = false;
  export let collapsed = false;
  export let closable = false;
  export let loading = false;
  export let disabled = false;
  export let padded = true;
  export let header = true;
  export let footer = false;
  export let actions = [];
  export let badges = [];
  export let icon = null;
  export let iconPosition = 'left'; // 'left', 'right'
  export let animated = true;
  export let hoverable = false;
  export let clickable = false;
  export let selected = false;
  export let draggable = false;
  export let resizable = false;
  export let scrollable = false;
  export let maxHeight = null;
  export let minHeight = null;
  export let width = null;
  export let height = null;
  export let fullWidth = false;
  export let fullHeight = false;
  
  const dispatch = createEventDispatcher();
  
  // Panel state
  let panelElement;
  let headerElement;
  let isDragging = false;
  let isResizing = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;
  let resizeStartX = 0;
  let resizeStartY = 0;
  
  // Calculate CSS classes
  $: panelClasses = [
    'panel',
    `panel--${variant}`,
    `panel--${size}`,
    `panel--${status}`,
    bordered && 'panel--bordered',
    rounded && 'panel--rounded',
    shadow && 'panel--shadow',
    collapsible && 'panel--collapsible',
    collapsed && 'panel--collapsed',
    closable && 'panel--closable',
    loading && 'panel--loading',
    disabled && 'panel--disabled',
    padded && 'panel--padded',
    header && 'panel--has-header',
    footer && 'panel--has-footer',
    hoverable && 'panel--hoverable',
    clickable && 'panel--clickable',
    selected && 'panel--selected',
    draggable && 'panel--draggable',
    resizable && 'panel--resizable',
    scrollable && 'panel--scrollable',
    animated && 'panel--animated',
    fullWidth && 'panel--full-width',
    fullHeight && 'panel--full-height'
  ].filter(Boolean).join(' ');
  
  $: headerClasses = [
    'panel__header',
    `panel__header--${variant}`,
    `panel__header--${size}`,
    `panel__header--${status}`,
    collapsible && 'panel__header--collapsible',
    clickable && 'panel__header--clickable'
  ].filter(Boolean).join(' ');
  
  $: bodyClasses = [
    'panel__body',
    `panel__body--${size}`,
    scrollable && 'panel__body--scrollable',
    animated && 'panel__body--animated'
  ].filter(Boolean).join(' ');
  
  $: footerClasses = [
    'panel__footer',
    `panel__footer--${variant}`,
    `panel__footer--${size}`
  ].filter(Boolean).join(' ');
  
  // Handle panel click
  function handleClick(event) {
    if (!clickable || disabled) return;
    
    dispatch('click', { event });
  }
  
  // Handle collapse toggle
  function handleCollapse(event) {
    if (!collapsible || disabled) return;
    
    collapsed = !collapsed;
    dispatch('collapse', { collapsed });
    dispatch('toggle', { collapsed });
  }
  
  // Handle close
  function handleClose(event) {
    if (!closable || disabled) return;
    
    dispatch('close', { event });
  }
  
  // Handle action click
  function handleAction(action, event) {
    if (disabled) return;
    
    if (action.handler) {
      action.handler(event);
    }
    
    dispatch('action', { action, event });
  }
  
  // Handle drag start
  function handleDragStart(event) {
    if (!draggable || disabled) return;
    
    isDragging = true;
    dragStartX = event.clientX - panelElement.offsetLeft;
    dragStartY = event.clientY - panelElement.offsetTop;
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    
    event.preventDefault();
    dispatch('dragStart', { event });
  }
  
  // Handle drag move
  function handleDragMove(event) {
    if (!isDragging) return;
    
    const newX = event.clientX - dragStartX;
    const newY = event.clientY - dragStartY;
    
    panelElement.style.position = 'absolute';
    panelElement.style.left = `${newX}px`;
    panelElement.style.top = `${newY}px`;
    
    dispatch('dragMove', { x: newX, y: newY, event });
  }
  
  // Handle drag end
  function handleDragEnd(event) {
    isDragging = false;
    
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    
    dispatch('dragEnd', { event });
  }
  
  // Handle resize start
  function handleResizeStart(event, handle) {
    if (!resizable || disabled) return;
    
    isResizing = true;
    resizeStartWidth = panelElement.offsetWidth;
    resizeStartHeight = panelElement.offsetHeight;
    resizeStartX = event.clientX;
    resizeStartY = event.clientY;
    
    document.addEventListener('mousemove', (e) => handleResizeMove(e, handle));
    document.addEventListener('mouseup', handleResizeEnd);
    
    event.preventDefault();
    event.stopPropagation();
    dispatch('resizeStart', { handle, event });
  }
  
  // Handle resize move
  function handleResizeMove(event, handle) {
    if (!isResizing) return;
    
    const deltaX = event.clientX - resizeStartX;
    const deltaY = event.clientY - resizeStartY;
    
    let newWidth = resizeStartWidth;
    let newHeight = resizeStartHeight;
    
    switch (handle) {
      case 'se':
        newWidth = resizeStartWidth + deltaX;
        newHeight = resizeStartHeight + deltaY;
        break;
      case 'e':
        newWidth = resizeStartWidth + deltaX;
        break;
      case 's':
        newHeight = resizeStartHeight + deltaY;
        break;
    }
    
    if (newWidth > 100) {
      panelElement.style.width = `${newWidth}px`;
    }
    
    if (newHeight > 100) {
      panelElement.style.height = `${newHeight}px`;
    }
    
    dispatch('resizeMove', { width: newWidth, height: newHeight, handle, event });
  }
  
  // Handle resize end
  function handleResizeEnd(event) {
    isResizing = false;
    
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    
    dispatch('resizeEnd', { 
      width: panelElement.offsetWidth, 
      height: panelElement.offsetHeight, 
      event 
    });
  }
  
  // Get collapse icon
  function getCollapseIcon() {
    return collapsed ? 'chevron-right' : 'chevron-down';
  }
</script>

<div 
  class={panelClasses}
  bind:this={panelElement}
  style="
    --panel-width: {width || 'auto'};
    --panel-height: {height || 'auto'};
    --panel-max-height: {maxHeight || 'none'};
    --panel-min-height: {minHeight || 'none'};
  "
  onclick={handleClick}
  role={clickable ? 'button' : 'region'}
  tabindex={clickable && !disabled ? 0 : -1}
  on:keydown={(e) => clickable && (e.key === 'Enter' || e.key === ' ') && handleClick(e)}
>
  <!-- Loading overlay -->
  {#if loading}
    <div class="panel__loading-overlay">
      <Icon name="loader" class="panel__loading-icon" />
    </div>
  {/if}
  
  <!-- Panel header -->
  {#if header}
    <div 
      class={headerClasses}
      bind:this={headerElement}
      on:mousedown={draggable ? handleDragStart : undefined}
    >
      <!-- Left side -->
      <div class="panel__header-left">
        <!-- Collapse button -->
        {#if collapsible}
          <button
            type="button"
            class="panel__collapse-button"
            onclick={handleCollapse}
            disabled={disabled}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            <Icon name={getCollapseIcon()} size="sm" />
          </button>
        {/if}
        
        <!-- Icon -->
        {#if icon}
          <div class="panel__icon">
            <Icon name={icon} size={size === 'lg' ? 'lg' : 'md'} variant={status} />
          </div>
        {/if}
        
        <!-- Title and subtitle -->
        <div class="panel__titles">
          {#if title}
            <h3 class="panel__title">{title}</h3>
          {/if}
          
          {#if subtitle}
            <h4 class="panel__subtitle">{subtitle}</h4>
          {/if}
        </div>
      </div>
      
      <!-- Right side -->
      <div class="panel__header-right">
        <!-- Badges -->
        {#if badges.length > 0}
          <div class="panel__badges">
            {#each badges as badge}
              <Badge 
                variant={badge.variant || 'default'} 
                size="sm"
                clickable={badge.clickable}
              >
                {badge.label}
              </Badge>
            {/each}
          </div>
        {/if}
        
        <!-- Actions -->
        {#if actions.length > 0}
          <div class="panel__actions">
            {#each actions as action}
              <Button
                variant="ghost"
                size="sm"
                icon={action.icon}
                onClick={(e) => handleAction(action, e)}
                title={action.title}
                disabled={action.disabled || disabled}
              />
            {/each}
          </div>
        {/if}
        
        <!-- Close button -->
        {#if closable}
          <button
            type="button"
            class="panel__close-button"
            onclick={handleClose}
            disabled={disabled}
            aria-label="Close panel"
          >
            <Icon name="x" size="sm" />
          </button>
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- Panel body -->
  <div class={bodyClasses} hidden={collapsed}>
    {#if description}
      <p class="panel__description">{description}</p>
    {/if}
    
    <!-- Slot for main content -->
    <slot />
  </div>
  
  <!-- Panel footer -->
  {#if footer}
    <div class={footerClasses}>
      <slot name="footer" />
    </div>
  {/if}
  
  <!-- Resize handles -->
  {#if resizable}
    <div 
      class="panel__resize-handle panel__resize-handle--se"
      on:mousedown={(e) => handleResizeStart(e, 'se')}
    />
    <div 
      class="panel__resize-handle panel__resize-handle--e"
      on:mousedown={(e) => handleResizeStart(e, 'e')}
    />
    <div 
      class="panel__resize-handle panel__resize-handle--s"
      on:mousedown={(e) => handleResizeStart(e, 's')}
    />
  {/if}
</div>

<style>
  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    width: var(--panel-width, auto);
    height: var(--panel-height, auto);
    max-height: var(--panel-max-height, none);
    min-height: var(--panel-min-height, none);
    background: var(--bg-primary);
    font-family: var(--font-sans);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  /* Variant styles */
  .panel--default {
    border: 1px solid var(--border-default);
  }
  
  .panel--elevated {
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-subtle);
  }
  
  .panel--outlined {
    border: 2px solid var(--border-default);
  }
  
  .panel--filled {
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
  }
  
  /* Status variants */
  .panel--success {
    border-color: var(--color-success-subtle);
  }
  
  .panel--warning {
    border-color: var(--color-warning-subtle);
  }
  
  .panel--danger {
    border-color: var(--color-danger-subtle);
  }
  
  .panel--info {
    border-color: var(--color-info-subtle);
  }
  
  /* Style modifiers */
  .panel--bordered {
    border: 1px solid var(--border-default);
  }
  
  .panel--rounded {
    border-radius: var(--radius-md);
  }
  
  .panel--shadow {
    box-shadow: var(--shadow-sm);
  }
  
  .panel--full-width {
    width: 100%;
  }
  
  .panel--full-height {
    height: 100%;
  }
  
  /* Interactive states */
  .panel--hoverable:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  
  .panel--clickable {
    cursor: pointer;
  }
  
  .panel--clickable:hover {
    background: var(--bg-secondary);
  }
  
  .panel--selected {
    border-color: var(--color-focus);
    box-shadow: 0 0 0 2px var(--color-focus-subtle);
  }
  
  .panel--disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  
  /* Draggable state */
  .panel--draggable .panel__header {
    cursor: move;
  }
  
  /* Collapsible state */
  .panel--collapsed .panel__body {
    display: none;
  }
  
  /* Size variants */
  .panel--sm {
    font-size: var(--text-sm);
  }
  
  .panel--md {
    font-size: var(--text-base);
  }
  
  .panel--lg {
    font-size: var(--text-lg);
  }
  
  /* Panel header */
  .panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-default);
    background: var(--bg-primary);
    min-height: 60px;
  }
  
  .panel__header--sm {
    padding: var(--space-2) var(--space-3);
    min-height: 48px;
  }
  
  .panel__header--lg {
    padding: var(--space-5) var(--space-6);
    min-height: 72px;
  }
  
  .panel__header--collapsible {
    cursor: pointer;
  }
  
  .panel__header--clickable {
    cursor: pointer;
  }
  
  .panel__header-left,
  .panel__header-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  
  .panel__titles {
    flex: 1;
    min-width: 0;
  }
  
  .panel__title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    line-height: 1.3;
  }
  
  .panel__subtitle {
    margin: var(--space-1) 0 0 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.3;
  }
  
  .panel__icon {
    flex-shrink: 0;
  }
  
  .panel__badges {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  
  .panel__actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }
  
  .panel__collapse-button,
  .panel__close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .panel__collapse-button:hover:not(:disabled),
  .panel__close-button:hover:not(:disabled) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .panel__collapse-button:disabled,
  .panel__close-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Panel body */
  .panel__body {
    flex: 1;
    padding: var(--space-4);
    overflow-y: auto;
  }
  
  .panel__body--sm {
    padding: var(--space-3);
  }
  
  .panel__body--lg {
    padding: var(--space-6);
  }
  
  .panel__body--scrollable {
    overflow-y: auto;
  }
  
  .panel__body--animated {
    transition: all var(--motion-normal) var(--ease-snappy);
  }
  
  .panel__description {
    margin: 0 0 var(--space-4) 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  
  .panel--padded .panel__body {
    padding: var(--space-4);
  }
  
  /* Panel footer */
  .panel__footer {
    padding: var(--space-4);
    border-top: 1px solid var(--border-default);
    background: var(--bg-secondary);
  }
  
  .panel__footer--sm {
    padding: var(--space-3);
  }
  
  .panel__footer--lg {
    padding: var(--space-6);
  }
  
  /* Loading overlay */
  .panel__loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: inherit;
    z-index: 10;
  }
  
  .panel__loading-icon {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Resize handles */
  .panel__resize-handle {
    position: absolute;
    background: transparent;
    z-index: 5;
  }
  
  .panel__resize-handle--se {
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    cursor: se-resize;
  }
  
  .panel__resize-handle--e {
    top: 0;
    right: 0;
    bottom: 0;
    width: 4px;
    cursor: e-resize;
  }
  
  .panel__resize-handle--s {
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    cursor: s-resize;
  }
  
  .panel__resize-handle:hover {
    background: var(--color-focus-subtle);
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .panel__header {
      padding: var(--space-3);
      min-height: 48px;
    }
    
    .panel__body {
      padding: var(--space-3);
    }
    
    .panel__footer {
      padding: var(--space-3);
    }
    
    .panel__title {
      font-size: var(--text-base);
    }
    
    .panel__header-left,
    .panel__header-right {
      gap: var(--space-2);
    }
    
    .panel__badges {
      display: none;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .panel--default,
    .panel--filled {
      border-width: 2px;
    }
    
    .panel--outlined {
      border-width: 3px;
    }
    
    .panel__header,
    .panel__footer {
      border-width: 2px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .panel,
    .panel__body--animated,
    .panel__collapse-button,
    .panel__close-button {
      transition: none !important;
    }
    
    .panel__loading-icon {
      animation: none;
    }
  }
  
  /* Print styles */
  @media print {
    .panel {
      break-inside: avoid;
      box-shadow: none !important;
      border: 1px solid black !important;
    }
    
    .panel__loading-overlay {
      display: none;
    }
    
    .panel__actions,
    .panel__close-button,
    .panel__collapse-button {
      display: none;
    }
    
    .panel__resize-handle {
      display: none;
    }
  }
</style>
