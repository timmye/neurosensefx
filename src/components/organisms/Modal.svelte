<script>
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  import { Button, Icon } from '../atoms/index.js';
  import { createPortal } from 'svelte';
  
  // Component props
  export let open = false;
  export let title = '';
  export let subtitle = '';
  export let size = 'md'; // 'sm', 'md', 'lg', 'xl', 'full'
  export let variant = 'default'; // 'default', 'danger', 'warning', 'info'
  export let closable = true;
  export let closeOnEscape = true;
  export let closeOnBackdrop = true;
  export let showCloseButton = true;
  export let showHeader = true;
  export let showFooter = false;
  export let centered = true;
  export let scrollable = false;
  export let animated = true;
  export let persistent = false; // Prevent closing
  export let fullscreen = false;
  export let backdrop = true;
  export let backdropBlur = false;
  export let focusTrap = true;
  export let restoreFocus = true;
  export let zIndex = 1000;
  
  // Actions
  export let actions = [];
  export let confirmText = 'Confirm';
  export let cancelText = 'Cancel';
  export let showConfirm = false;
  export let showCancel = true;
  export let confirmVariant = 'primary';
  export let cancelVariant = 'ghost';
  
  // Content
  export let content = '';
  export let icon = null;
  export let loading = false;
  export let disabled = false;
  
  const dispatch = createEventDispatcher();
  
  // Modal state
  let modalElement;
  let backdropElement;
  let previousFocusElement;
  let modalId = `modal-${Math.random().toString(36).substr(2, 9)}`;
  let isTransitioning = false;
  
  // Calculate CSS classes
  $: modalClasses = [
    'modal',
    `modal--${size}`,
    `modal--${variant}`,
    centered && 'modal--centered',
    scrollable && 'modal--scrollable',
    animated && 'modal--animated',
    fullscreen && 'modal--fullscreen',
    isTransitioning && 'modal--transitioning'
  ].filter(Boolean).join(' ');
  
  $: backdropClasses = [
    'modal__backdrop',
    backdropBlur && 'modal__backdrop--blur',
    animated && 'modal__backdrop--animated'
  ].filter(Boolean).join(' ');
  
  $: dialogClasses = [
    'modal__dialog',
    `modal__dialog--${size}`,
    fullscreen && 'modal__dialog--fullscreen'
  ].filter(Boolean).join(' ');
  
  $: headerClasses = [
    'modal__header',
    `modal__header--${variant}`
  ].filter(Boolean).join(' ');
  
  $: bodyClasses = [
    'modal__body',
    scrollable && 'modal__body--scrollable'
  ].filter(Boolean).join(' ');
  
  $: footerClasses = [
    'modal__footer',
    `modal__footer--${variant}`
  ].filter(Boolean).join(' ');
  
  // Handle modal open/close
  $: if (open && modalElement) {
    openModal();
  } else if (!open && modalElement) {
    closeModal();
  }
  
  // Initialize modal
  onMount(() => {
    // Store current focus element
    previousFocusElement = document.activeElement;
    
    // Add global event listeners
    document.addEventListener('keydown', handleKeydown);
    
    // Handle initial open state
    if (open) {
      tick().then(() => openModal());
    }
  });
  
  onDestroy(() => {
    // Cleanup
    document.removeEventListener('keydown', handleKeydown);
    
    // Restore focus
    if (restoreFocus && previousFocusElement) {
      previousFocusElement.focus();
    }
  });
  
  // Open modal
  async function openModal() {
    if (!modalElement) return;
    
    isTransitioning = true;
    
    // Add to DOM
    document.body.appendChild(modalElement);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Focus management
    if (focusTrap) {
      await tick();
      trapFocus();
    }
    
    // Dispatch open event
    dispatch('open');
    
    // Transition complete
    setTimeout(() => {
      isTransitioning = false;
    }, 150);
  }
  
  // Close modal
  async function closeModal() {
    if (!modalElement || persistent) return;
    
    isTransitioning = true;
    
    // Dispatch close event
    dispatch('close');
    
    // Wait for transition
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Remove from DOM
    if (modalElement.parentNode) {
      modalElement.parentNode.removeChild(modalElement);
    }
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Restore focus
    if (restoreFocus && previousFocusElement) {
      previousFocusElement.focus();
    }
    
    isTransitioning = false;
  }
  
  // Handle keyboard events
  function handleKeydown(event) {
    if (!open) return;
    
    const { key } = event;
    
    // Escape key
    if (key === 'Escape' && closeOnEscape && !persistent) {
      event.preventDefault();
      handleClose();
    }
    
    // Tab key (focus trap)
    if (key === 'Tab' && focusTrap) {
      handleTabKey(event);
    }
  }
  
  // Focus trap
  function trapFocus() {
    if (!modalElement) return;
    
    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }
  
  // Handle tab key for focus trap
  function handleTabKey(event) {
    if (!modalElement) return;
    
    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }
  
  // Handle close
  function handleClose() {
    if (persistent || loading || disabled) return;
    
    dispatch('close');
    open = false;
  }
  
  // Handle backdrop click
  function handleBackdropClick(event) {
    if (closeOnBackdrop && event.target === backdropElement) {
      handleClose();
    }
  }
  
  // Handle confirm
  function handleConfirm() {
    if (loading || disabled) return;
    
    dispatch('confirm');
  }
  
  // Handle cancel
  function handleCancel() {
    if (loading || disabled) return;
    
    dispatch('cancel');
    handleClose();
  }
  
  // Handle action click
  function handleAction(action, event) {
    if (loading || disabled) return;
    
    if (action.handler) {
      action.handler(event);
    }
    
    dispatch('action', { action, event });
  }
</script>

{#if open}
  <div bind:this={modalElement} class="modal__container" style="z-index: {zIndex};">
    <!-- Backdrop -->
    {#if backdrop}
      <div 
        class={backdropClasses}
        bind:this={backdropElement}
        onclick={handleBackdropClick}
        role="presentation"
      />
    {/if}
    
    <!-- Modal dialog -->
    <div 
      class={dialogClasses}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? `${modalId}-title` : undefined}
      aria-describedby={content ? `${modalId}-content` : undefined}
    >
      <div class={modalClasses}>
        <!-- Modal header -->
        {#if showHeader}
          <div class={headerClasses}>
            <!-- Icon -->
            {#if icon}
              <div class="modal__icon">
                <Icon name={icon} size="lg" variant={variant} />
              </div>
            {/if}
            
            <!-- Title and subtitle -->
            <div class="modal__titles">
              {#if title}
                <h2 class="modal__title" id={`${modalId}-title`}>
                  {title}
                </h2>
              {/if}
              
              {#if subtitle}
                <p class="modal__subtitle">{subtitle}</p>
              {/if}
            </div>
            
            <!-- Close button -->
            {#if showCloseButton && closable && !persistent}
              <button
                type="button"
                class="modal__close"
                aria-label="Close modal"
                onclick={handleClose}
                disabled={loading || disabled}
              >
                <Icon name="x" size="md" />
              </button>
            {/if}
          </div>
        {/if}
        
        <!-- Modal body -->
        <div class={bodyClasses} id={`${modalId}-content`}>
          {#if loading}
            <div class="modal__loading">
              <Icon name="loader" class="modal__loading-icon" />
              <span>Loading...</span>
            </div>
          {:else if typeof content === 'function'}
            <content />
          {:else}
            {@html content}
          {/if}
          
          <!-- Slot for additional content -->
          <slot />
        </div>
        
        <!-- Modal footer -->
        {#if showFooter || actions.length > 0 || showConfirm || showCancel}
          <div class={footerClasses}>
            <!-- Actions -->
            {#each actions as action}
              <Button
                variant={action.variant || 'ghost'}
                size={action.size || 'md'}
                icon={action.icon}
                onClick={(e) => handleAction(action, e)}
                disabled={action.disabled || loading || disabled}
                loading={action.loading}
              >
                {action.text}
              </Button>
            {/each}
            
            <!-- Default actions -->
            {#if showCancel}
              <Button
                variant={cancelVariant}
                size="md"
                onClick={handleCancel}
                disabled={loading || disabled}
              >
                {cancelText}
              </Button>
            {/if}
            
            {#if showConfirm}
              <Button
                variant={confirmVariant}
                size="md"
                onClick={handleConfirm}
                disabled={loading || disabled}
                loading={loading}
              >
                {confirmText}
              </Button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal__container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    font-family: var(--font-sans);
  }
  
  /* Backdrop */
  .modal__backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: -1;
  }
  
  .modal__backdrop--blur {
    backdrop-filter: blur(4px);
  }
  
  .modal__backdrop--animated {
    animation: modalBackdropFadeIn 0.15s ease-out;
  }
  
  @keyframes modalBackdropFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  /* Modal dialog */
  .modal__dialog {
    position: relative;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
  }
  
  .modal__dialog--sm {
    max-width: 400px;
  }
  
  .modal__dialog--md {
    max-width: 500px;
  }
  
  .modal__dialog--lg {
    max-width: 700px;
  }
  
  .modal__dialog--xl {
    max-width: 900px;
  }
  
  .modal__dialog--full {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
  
  /* Modal content */
  .modal {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .modal--animated {
    animation: modalSlideIn 0.3s ease-out;
  }
  
  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  /* Modal header */
  .modal__header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-6);
    border-bottom: 1px solid var(--border-default);
    background: var(--bg-primary);
  }
  
  .modal__header--danger {
    border-bottom-color: var(--color-danger-subtle);
  }
  
  .modal__header--warning {
    border-bottom-color: var(--color-warning-subtle);
  }
  
  .modal__header--info {
    border-bottom-color: var(--color-info-subtle);
  }
  
  .modal__icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-full);
    background: var(--bg-secondary);
  }
  
  .modal__titles {
    flex: 1;
    min-width: 0;
  }
  
  .modal__title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    line-height: 1.3;
  }
  
  .modal__subtitle {
    margin: var(--space-1) 0 0 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .modal__close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .modal__close:hover:not(:disabled) {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .modal__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Modal body */
  .modal__body {
    flex: 1;
    padding: var(--space-6);
    overflow-y: auto;
  }
  
  .modal__body--scrollable {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .modal__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-8);
    color: var(--text-secondary);
  }
  
  .modal__loading-icon {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Modal footer */
  .modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: var(--space-6);
    border-top: 1px solid var(--border-default);
    background: var(--bg-secondary);
  }
  
  .modal__footer--danger {
    border-top-color: var(--color-danger-subtle);
  }
  
  .modal__footer--warning {
    border-top-color: var(--color-warning-subtle);
  }
  
  .modal__footer--info {
    border-top-color: var(--color-info-subtle);
  }
  
  /* Size variants */
  .modal--sm .modal__header,
  .modal--sm .modal__body,
  .modal--sm .modal__footer {
    padding: var(--space-4);
  }
  
  .modal--lg .modal__header,
  .modal--lg .modal__body,
  .modal--lg .modal__footer {
    padding: var(--space-8);
  }
  
  .modal--xl .modal__header,
  .modal--xl .modal__body,
  .modal--xl .modal__footer {
    padding: var(--space-8);
  }
  
  /* Centered variant */
  .modal--centered {
    text-align: center;
  }
  
  .modal--centered .modal__header {
    flex-direction: column;
    text-align: center;
  }
  
  .modal--centered .modal__footer {
    justify-content: center;
  }
  
  /* Fullscreen variant */
  .modal--fullscreen .modal__dialog {
    width: 100vw;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .modal__container {
      padding: var(--space-2);
    }
    
    .modal__dialog {
      max-width: 100%;
      max-height: 100vh;
    }
    
    .modal__header,
    .modal__body,
    .modal__footer {
      padding: var(--space-4);
    }
    
    .modal__title {
      font-size: var(--text-lg);
    }
    
    .modal__footer {
      flex-direction: column;
      gap: var(--space-2);
    }
    
    .modal__footer button {
      width: 100%;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .modal__dialog {
      border: 2px solid var(--border-default);
    }
    
    .modal__header,
    .modal__footer {
      border-width: 2px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .modal__backdrop--animated,
    .modal--animated {
      animation: none !important;
    }
    
    .modal__loading-icon {
      animation: none;
    }
  }
  
  /* Print styles */
  @media print {
    .modal__container {
      position: static;
      padding: 0;
    }
    
    .modal__backdrop {
      display: none;
    }
    
    .modal__dialog {
      box-shadow: none;
      border: 1px solid black;
      max-width: 100%;
      max-height: none;
    }
    
    .modal__close {
      display: none;
    }
  }
</style>
