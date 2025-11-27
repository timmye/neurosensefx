/**
 * Keyboard Accessibility Actions for NeuroSense FX
 *
 * Provides comprehensive keyboard alternatives for mouse-only interactions
 * following WCAG 2.1 AA standards and trading workflow requirements.
 *
 * Keyboard-First Trading Requirements:
 * - Rapid display switching during active trading
 * - Quick access to symbol search and display controls
 * - Context menu navigation without mouse
 * - Panel management via keyboard
 * - Tab order and focus management for efficiency
 */

import { tick } from 'svelte';

/**
 * Action for making any element keyboard-triggerable
 * Replaces mouse-only interactions with keyboard alternatives
 *
 * @param {HTMLElement} node - The element to make keyboard accessible
 * @param {Object} options - Accessibility configuration
 * @returns {{ update: Function, destroy: Function }} - Action lifecycle
 */
export function keyboardClickable(node, options = {}) {
  const {
    triggerKey = 'Enter', // Keyboard key to trigger the action
    triggerKey2 = ' ', // Spacebar as secondary trigger
    onMouseClick = null, // Original mouse click handler
    ariaLabel = null, // Accessibility label
    ariaDescription = null, // Additional description
    role = 'button' // ARIA role
  } = options;

  // Set ARIA attributes for accessibility
  if (ariaLabel) node.setAttribute('aria-label', ariaLabel);
  if (ariaDescription) node.setAttribute('aria-describedby', ariaDescription);
  if (role) node.setAttribute('role', role);
  node.setAttribute('tabindex', '0'); // Make focusable

  const handleKeyDown = async (event) => {
    if (event.key === triggerKey || event.key === triggerKey2) {
      event.preventDefault();
      event.stopPropagation();

      // Create synthetic click event
      const syntheticEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });

      // Add keyboard-specific properties
      syntheticEvent.keyboardTriggered = true;
      syntheticEvent.originalKey = event.key;

      // Dispatch synthetic click
      node.dispatchEvent(syntheticEvent);

      // Call original handler if provided
      if (onMouseClick) {
        onMouseClick(syntheticEvent);
      }

      // Visual feedback
      node.classList.add('keyboard-triggered');
      await tick();
      setTimeout(() => {
        node.classList.remove('keyboard-triggered');
      }, 150);
    }
  };

  const handleKeyUp = (event) => {
    if (event.key === triggerKey || event.key === triggerKey2) {
      node.classList.remove('keyboard-pressed');
    }
  };

  const handleKeyDownVisual = (event) => {
    if (event.key === triggerKey || event.key === triggerKey2) {
      node.classList.add('keyboard-pressed');
    }
  };

  // Add keyboard event listeners
  node.addEventListener('keydown', handleKeyDownVisual);
  node.addEventListener('keydown', handleKeyDown);
  node.addEventListener('keyup', handleKeyUp);

  return {
    update(newOptions = {}) {
      Object.assign(options, newOptions);

      // Update ARIA attributes
      if (newOptions.ariaLabel) {
        node.setAttribute('aria-label', newOptions.ariaLabel);
      }
      if (newOptions.role) {
        node.setAttribute('role', newOptions.role);
      }
    },
    destroy() {
      node.removeEventListener('keydown', handleKeyDownVisual);
      node.removeEventListener('keydown', handleKeyDown);
      node.removeEventListener('keyup', handleKeyUp);

      // Clean up ARIA attributes
      node.removeAttribute('aria-label');
      node.removeAttribute('aria-describedby');
      node.removeAttribute('role');
      node.removeAttribute('tabindex');
    }
  };
}

/**
 * Action for comprehensive context menu keyboard navigation
 * Provides full keyboard control for context menus
 *
 * @param {HTMLElement} node - Context menu container
 * @param {Object} options - Menu navigation options
 * @returns {{ update: Function, destroy: Function }} - Action lifecycle
 */
export function contextMenuNavigation(node, options = {}) {
  const {
    onClose = null,
    onSelect = null,
    items = '.menu-item, button, [role="menuitem"]',
    firstFocus = null
  } = options;

  let menuItems = [];
  let currentIndex = -1;

  const updateMenuItems = () => {
    menuItems = Array.from(node.querySelectorAll(items));
  };

  const handleKeyDown = async (event) => {
    // Update menu items on each keydown
    updateMenuItems();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        currentIndex = (currentIndex + 1) % menuItems.length;
        menuItems[currentIndex]?.focus();
        break;

      case 'ArrowUp':
        event.preventDefault();
        currentIndex = currentIndex <= 0 ? menuItems.length - 1 : currentIndex - 1;
        menuItems[currentIndex]?.focus();
        break;

      case 'Home':
        event.preventDefault();
        currentIndex = 0;
        menuItems[currentIndex]?.focus();
        break;

      case 'End':
        event.preventDefault();
        currentIndex = menuItems.length - 1;
        menuItems[currentIndex]?.focus();
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (currentIndex >= 0 && menuItems[currentIndex]) {
          menuItems[currentIndex].click();
          if (onSelect) {
            onSelect(menuItems[currentIndex]);
          }
        }
        break;

      case 'Escape':
        event.preventDefault();
        if (onClose) {
          onClose();
        }
        break;

      case 'Tab':
        // Allow tab to escape the menu (but prevent default to control focus)
        event.preventDefault();
        if (onClose) {
          onClose();
        }
        break;
    }
  };

  // Focus management
  const focusFirstItem = async () => {
    await tick();
    updateMenuItems();

    if (firstFocus) {
      firstFocus.focus();
    } else if (menuItems.length > 0) {
      currentIndex = 0;
      menuItems[0].focus();
    }
  };

  // Set initial focus when menu opens
  if (node.offsetParent !== null) { // Menu is visible
    focusFirstItem();
  }

  // Add keyboard navigation
  node.addEventListener('keydown', handleKeyDown);

  // Set ARIA attributes
  node.setAttribute('role', 'menu');

  return {
    update(newOptions = {}) {
      Object.assign(options, newOptions);
    },
    destroy() {
      node.removeEventListener('keydown', handleKeyDown);
      node.removeAttribute('role');
    }
  };
}

/**
 * Action for drag-and-drop keyboard alternatives
 * Enables keyboard-based element positioning
 *
 * @param {HTMLElement} node - Draggable element
 * @param {Object} options - Drag control options
 * @returns {{ update: Function, destroy: Function }} - Action lifecycle
 */
export function keyboardDraggable(node, options = {}) {
  const {
    onMove = null,
    stepSize = 10, // Pixels per keyboard move
    bounds = null // { top, left, right, bottom }
  } = options;

  let position = { x: 0, y: 0 };
  let isActive = false;

  const handleKeyDown = (event) => {
    // Only handle when element has focus and is active
    if (!isActive) return;

    const moves = {
      'ArrowUp': { x: 0, y: -stepSize },
      'ArrowDown': { x: 0, y: stepSize },
      'ArrowLeft': { x: -stepSize, y: 0 },
      'ArrowRight': { x: stepSize, y: 0 },
      'PageUp': { x: 0, y: -stepSize * 10 },
      'PageDown': { x: 0, y: stepSize * 10 },
      'Home': { x: -stepSize * 10, y: 0 },
      'End': { x: stepSize * 10, y: 0 }
    };

    const move = moves[event.key];
    if (move) {
      event.preventDefault();

      position.x += move.x;
      position.y += move.y;

      // Apply bounds if specified
      if (bounds) {
        position.x = Math.max(bounds.left, Math.min(bounds.right, position.x));
        position.y = Math.max(bounds.top, Math.min(bounds.bottom, position.y));
      }

      // Apply position
      node.style.transform = `translate(${position.x}px, ${position.y}px)`;

      // Notify callback
      if (onMove) {
        onMove(position, event);
      }
    }

    // Toggle drag mode with Space
    if (event.key === ' ') {
      event.preventDefault();
      isActive = !isActive;
      node.classList.toggle('keyboard-dragging', isActive);

      if (isActive) {
        node.focus();
      }
    }
  };

  const handleFocus = () => {
    node.classList.add('keyboard-focusable');
  };

  const handleBlur = () => {
    node.classList.remove('keyboard-focusable', 'keyboard-dragging');
    isActive = false;
  };

  // Make element focusable and add event listeners
  node.setAttribute('tabindex', '0');
  node.setAttribute('role', 'application');
  node.setAttribute('aria-label', 'Draggable element - press Space to drag, arrow keys to move');
  node.addEventListener('keydown', handleKeyDown);
  node.addEventListener('focus', handleFocus);
  node.addEventListener('blur', handleBlur);

  return {
    update(newOptions = {}) {
      Object.assign(options, newOptions);
    },
    destroy() {
      node.removeEventListener('keydown', handleKeyDown);
      node.removeEventListener('focus', handleFocus);
      node.removeEventListener('blur', handleBlur);
      node.removeAttribute('tabindex');
      node.removeAttribute('role');
      node.removeAttribute('aria-label');
      node.classList.remove('keyboard-focusable', 'keyboard-dragging');
    }
  };
}

/**
 * Action for comprehensive keyboard navigation in panels and dialogs
 * Implements tab trapping, skip links, and efficient navigation
 *
 * @param {HTMLElement} node - Container element
 * @param {Object} options - Navigation options
 * @returns {{ update: Function, destroy: Function }} - Action lifecycle
 */
export function panelNavigation(node, options = {}) {
  const {
    trapFocus = true,
    skipLinks = true,
    firstFocus = null,
    restoreFocus = true
  } = options;

  let previousActiveElement = null;
  let focusableElements = [];

  const getFocusableElements = () => {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(node.querySelectorAll(selector))
      .filter(el => {
        // Filter out hidden elements
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               !el.disabled;
      });
  };

  const handleKeyDown = (event) => {
    if (!trapFocus) return;

    focusableElements = getFocusableElements();

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.key === 'Tab') {
      if (event.shiftKey) {
        // Shift + Tab (backwards)
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab (forwards)
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  const handleFocusIn = (event) => {
    // Keep focus within the panel when trapFocus is enabled
    if (trapFocus && !node.contains(event.target)) {
      event.stopPropagation();
      focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }
  };

  // Store previous focus
  if (restoreFocus) {
    previousActiveElement = document.activeElement;
  }

  // Set initial focus
  tick().then(() => {
    focusableElements = getFocusableElements();

    if (firstFocus) {
      firstFocus.focus();
    } else if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  });

  // Add event listeners
  if (trapFocus) {
    node.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn, true);
  }

  return {
    update(newOptions = {}) {
      Object.assign(options, newOptions);

      // Update focus trap status
      if (newOptions.trapFocus !== trapFocus) {
        if (newOptions.trapFocus) {
          node.addEventListener('keydown', handleKeyDown);
          document.addEventListener('focusin', handleFocusIn, true);
        } else {
          node.removeEventListener('keydown', handleKeyDown);
          document.removeEventListener('focusin', handleFocusIn, true);
        }
      }
    },
    destroy() {
      node.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn, true);

      // Restore previous focus
      if (restoreFocus && previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    }
  };
}