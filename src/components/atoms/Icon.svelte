<script>
  /**
   * Icon Component
   * A versatile icon component with loading states and accessibility features
   */

  export let name = ''; // Icon name/identifier
  export let size = 'md'; // xs, sm, md, lg, xl, 2xl, 3xl
  export let variant = 'default'; // default, muted, primary, secondary, success, warning, danger, info
  export let loading = false; // Show loading spinner
  export let clickable = false; // Make icon clickable
  export let rotation = 0; // Rotation angle in degrees
  export let flip = null; // flip-horizontal, flip-vertical, flip-both
  export let label = ''; // Accessibility label
  export let title = ''; // Tooltip title
  export let ariaHidden = false; // Hide from screen readers
  export let id = '';

  // Generate unique ID if not provided
  let iconId = id || `icon-${Math.random().toString(36).substr(2, 9)}`;

  // Handle click events
  function handleClick(event) {
    if (!clickable) return;
    dispatchEvent('click', event);
  }

  // Handle key events for accessibility
  function handleKeydown(event) {
    if (!clickable) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event);
    }
  }

  // Get CSS classes based on props
  $: baseClasses = [
    'icon',
    `icon-${size}`,
    `icon-${variant}`,
    clickable && 'icon-clickable',
    loading && 'icon-loading',
    rotation && 'icon-rotated',
    flip && `icon-${flip}`
  ].filter(Boolean).join(' ');

  // Get icon size in pixels
  $: iconSize = {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '20px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '48px'
  }[size] || '16px';

  // Inline styles for dynamic properties
  $: inlineStyles = `
    --icon-size: ${iconSize};
    --icon-rotation: ${rotation}deg;
  `;

  // Determine if icon should be interactive
  $: isInteractive = clickable || loading;

  // Default icon set (simple SVG icons for common use cases)
  $: iconSvg = getIconSvg(name);

  // Get accessibility attributes
  $: ariaAttributes = {
    'aria-label': label || undefined,
    'aria-hidden': ariaHidden || (!label && !title) ? 'true' : undefined,
    'title': title || undefined,
    'role': clickable ? 'button' : undefined,
    'tabindex': clickable ? '0' : undefined
  };
</script>

{#if loading}
  <div
    id={iconId}
    class={baseClasses}
    style={inlineStyles}
    {...ariaAttributes}
    on:click={handleClick}
    on:keydown={handleKeydown}
  >
    <div class="icon-spinner"></div>
  </div>
{:else if iconSvg}
  <div
    id={iconId}
    class={baseClasses}
    style={inlineStyles}
    {...ariaAttributes}
    on:click={handleClick}
    on:keydown={handleKeydown}
  >
    {@html iconSvg}
  </div>
{:else}
  <!-- Fallback icon if name not found -->
  <div
    id={iconId}
    class={baseClasses}
    style={inlineStyles}
    {...ariaAttributes}
    on:click={handleClick}
    on:keydown={handleKeydown}
  >
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>
  </div>
{/if}

<style>
  /* Base icon styles */
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--icon-size);
    height: var(--icon-size);
    color: var(--text-secondary);
    transition: all var(--motion-fast) var(--ease-out);
    flex-shrink: 0;
  }

  .icon svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }

  /* Size variants */
  .icon-xs {
    font-size: 12px;
  }

  .icon-sm {
    font-size: 14px;
  }

  .icon-md {
    font-size: 16px;
  }

  .icon-lg {
    font-size: 20px;
  }

  .icon-xl {
    font-size: 24px;
  }

  .icon-2xl {
    font-size: 32px;
  }

  .icon-3xl {
    font-size: 48px;
  }

  /* Variant styles */
  .icon-default {
    color: var(--text-secondary);
  }

  .icon-muted {
    color: var(--text-tertiary);
    opacity: 0.7;
  }

  .icon-primary {
    color: var(--color-primary);
  }

  .icon-secondary {
    color: var(--color-secondary);
  }

  .icon-success {
    color: var(--color-success);
  }

  .icon-warning {
    color: var(--color-warning);
  }

  .icon-danger {
    color: var(--color-danger);
  }

  .icon-info {
    color: var(--color-info);
  }

  /* Interactive states */
  .icon-clickable {
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: var(--space-1);
    margin: calc(-1 * var(--space-1));
  }

  .icon-clickable:hover {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
  }

  .icon-clickable:active {
    background-color: var(--bg-tertiary);
    transform: scale(0.95);
  }

  .icon-clickable:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 1px;
  }

  /* Loading state */
  .icon-loading {
    color: var(--color-primary);
  }

  .icon-spinner {
    width: 100%;
    height: 100%;
    border: 2px solid var(--border-default);
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* Transformations */
  .icon-rotated {
    transform: rotate(var(--icon-rotation));
  }

  .icon-flip-horizontal {
    transform: scaleX(-1);
  }

  .icon-flip-vertical {
    transform: scaleY(-1);
  }

  .icon-flip-both {
    transform: scale(-1, -1);
  }

  /* Combined transformations */
  .icon-rotated.icon-flip-horizontal {
    transform: rotate(var(--icon-rotation)) scaleX(-1);
  }

  .icon-rotated.icon-flip-vertical {
    transform: rotate(var(--icon-rotation)) scaleY(-1);
  }

  .icon-rotated.icon-flip-both {
    transform: rotate(var(--icon-rotation)) scale(-1, -1);
  }

  /* Animation */
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .icon-default {
      color: var(--text-secondary-dark);
    }

    .icon-muted {
      color: var(--text-tertiary-dark);
    }

    .icon-clickable:hover {
      background-color: var(--bg-secondary-dark);
      color: var(--text-primary-dark);
    }

    .icon-clickable:active {
      background-color: var(--bg-tertiary-dark);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .icon {
      color: var(--text-primary);
    }

    .icon-clickable {
      border: 1px solid transparent;
    }

    .icon-clickable:hover,
    .icon-clickable:focus {
      border-color: var(--color-primary);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .icon {
      transition: none;
    }

    .icon-clickable:active {
      transform: none;
    }

    .icon-spinner {
      animation: none;
      border: 2px solid currentColor;
    }
  }

  /* Print styles */
  @media print {
    .icon {
      color: black !important;
    }

    .icon-clickable {
      background: transparent !important;
    }
  }
</style>

<script context="module">
  /**
   * Icon SVG Library
   * Simple SVG icons for common use cases
   */

  function getIconSvg(name) {
    const icons = {
      // Navigation
      'arrow-left': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
      'arrow-right': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>',
      'arrow-up': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>',
      'arrow-down': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>',
      'chevron-left': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.707 7.293a1 1 0 010 1.414L12.414 12l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>',
      'chevron-right': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.293 7.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L11.586 12 8.293 8.707a1 1 0 010-1.414z"/></svg>',
      'chevron-up': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.707 15.293a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L12 13.586l3.293-3.293a1 1 0 011.414 1.414l-4 4z"/></svg>',
      'chevron-down': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.293 8.707a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L12 10.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4z"/></svg>',
      
      // Actions
      'close': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.707 5.293a1 1 0 00-1.414 0L12 10.586 6.707 5.293a1 1 0 00-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 101.414 1.414L12 13.414l5.293 5.293a1 1 0 001.414-1.414L13.414 12l5.293-5.293a1 1 0 000-1.414z"/></svg>',
      'menu': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>',
      'search': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
      'settings': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>',
      
      // Status
      'check': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
      'warning': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
      'error': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
      'info': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
      
      // UI
      'plus': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
      'minus': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>',
      'edit': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
      'trash': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
      'download': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
      'upload': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>',
      
      // Media
      'play': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
      'pause': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
      'stop': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>',
      'volume': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
      
      // Trading specific
      'trending-up': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>',
      'trending-down': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/></svg>',
      'chart': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>',
      'currency': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>'
    };

    return icons[name] || null;
  }
</script>
