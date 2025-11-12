<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let notifications = [];

  const dispatch = createEventDispatcher();

  let container = null;

  onMount(() => {
    // Auto-remove expired notifications
    const interval = setInterval(() => {
      const now = Date.now();
      notifications = notifications.filter(notification => {
        const elapsed = now - notification.createdAt;
        return elapsed < (notification.duration || 5000);
      });
    }, 1000);

    return () => clearInterval(interval);
  });

  function removeNotification(id) {
    notifications = notifications.filter(n => n.id !== id);
  }

  function getNotificationColor(type) {
    const colors = {
      success: {
        bg: '#10b981',
        border: '#059669',
        text: '#ffffff'
      },
      error: {
        bg: '#ef4444',
        border: '#dc2626',
        text: '#ffffff'
      },
      warning: {
        bg: '#f59e0b',
        border: '#d97706',
        text: '#ffffff'
      },
      info: {
        bg: '#3b82f6',
        border: '#2563eb',
        text: '#ffffff'
      }
    };
    return colors[type] || colors.info;
  }

  function getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }
</script>

<div class="notification-container" bind:this={container}>
  {#each notifications as notification (notification.id)}
    <div
      class="notification {notification.type}"
      style="--notification-bg: {getNotificationColor(notification.type).bg};
             --notification-border: {getNotificationColor(notification.type).border};
             --notification-text: {getNotificationColor(notification.type).text};"
      on:click={() => removeNotification(notification.id)}
      on:keypress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          removeNotification(notification.id);
        }
      }}
      tabindex="0"
      role="alert"
      aria-live="polite"
    >
      <div class="notification-icon">
        {getNotificationIcon(notification.type)}
      </div>
      <div class="notification-content">
        <div class="notification-title">
          {notification.title}
        </div>
        {#if notification.message}
          <div class="notification-message">
            {notification.message}
          </div>
        {/if}
      </div>
      <button
        class="notification-close"
        on:click|stopPropagation={() => removeNotification(notification.id)}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  {/each}
</div>

<style>
  .notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
  }

  .notification {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: var(--notification-bg);
    border: 1px solid var(--notification-border);
    border-radius: 8px;
    color: var(--notification-text);
    min-width: 300px;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    pointer-events: auto;
    cursor: pointer;
    transition: all 0.3s ease;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .notification:hover {
    transform: translateX(-4px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }

  .notification-icon {
    font-size: 20px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .notification-content {
    flex: 1;
    min-width: 0;
  }

  .notification-title {
    font-weight: 600;
    font-size: 14px;
    line-height: 1.3;
    margin-bottom: 4px;
  }

  .notification-message {
    font-size: 13px;
    line-height: 1.4;
    opacity: 0.9;
  }

  .notification-close {
    background: none;
    border: none;
    color: inherit;
    font-size: 16px;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    opacity: 0.7;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  }

  .notification-close:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .notification {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .notification:hover {
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    }

    .notification-close:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .notification-container {
      left: 20px;
      right: 20px;
      top: 10px;
    }

    .notification {
      min-width: auto;
      max-width: none;
    }
  }

  /* Animation for removal */
  .notification.removing {
    animation: slideOut 0.3s ease forwards;
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
</style>