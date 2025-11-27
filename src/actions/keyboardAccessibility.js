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
 * Updated to work with unified keyboard system - no competing handlers
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

  // UNIFIED SYSTEM: Use unified keyboard action for Enter/Space on buttons
  // This prevents competing addEventListener calls
  // Individual element keyboard triggers still use direct listeners for specific interactions

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
      // Clean up ARIA attributes
      node.removeAttribute('aria-label');
      node.removeAttribute('aria-describedby');
      node.removeAttribute('role');
      node.removeAttribute('tabindex');
      node.classList.remove('keyboard-triggered', 'keyboard-pressed');
    }
  };
}

/**
 * Action for comprehensive context menu keyboard navigation
 * Updated to work with unified keyboard system - no competing handlers
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

  // UNIFIED SYSTEM: Context menu navigation now handled by unified keyboard shortcuts
  // This removes competing addEventListener('keydown') calls
  // The keyboardAction system handles context menu shortcuts through registered actions

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

  // Set ARIA attributes
  node.setAttribute('role', 'menu');

  // Export functions for use by unified keyboard system
  node.contextMenuNavigation = {
    updateMenuItems,
    focusFirstItem,
    getCurrentIndex: () => currentIndex,
    setCurrentIndex: (index) => { currentIndex = index; },
    getMenuItems: () => menuItems,
    handleNavigation: async (key) => {
      updateMenuItems();

      switch (key) {
        case 'ArrowDown':
          currentIndex = (currentIndex + 1) % menuItems.length;
          menuItems[currentIndex]?.focus();
          return true;
        case 'ArrowUp':
          currentIndex = currentIndex <= 0 ? menuItems.length - 1 : currentIndex - 1;
          menuItems[currentIndex]?.focus();
          return true;
        case 'Home':
          currentIndex = 0;
          menuItems[currentIndex]?.focus();
          return true;
        case 'End':
          currentIndex = menuItems.length - 1;
          menuItems[currentIndex]?.focus();
          return true;
        case 'Enter':
        case ' ':
          if (currentIndex >= 0 && menuItems[currentIndex]) {
            menuItems[currentIndex].click();
            if (onSelect) {
              onSelect(menuItems[currentIndex]);
            }
          }
          return true;
        case 'Escape':
          if (onClose) {
            onClose();
          }
          return true;
      }
      return false;
    }
  };

  return {
    update(newOptions = {}) {
      Object.assign(options, newOptions);
    },
    destroy() {
      node.removeAttribute('role');
      // Clean up exported functions
      delete node.contextMenuNavigation;
    }
  };
}

/**
 * Action for drag-and-drop keyboard alternatives
 * Updated to work with unified keyboard system - no competing handlers
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

  // UNIFIED SYSTEM: Keyboard dragging now handled by unified keyboard shortcuts
  // This removes competing addEventListener('keydown') calls
  // The keyboardAction system handles drag operations through registered actions

  // Export drag functionality for unified keyboard system
  node.keyboardDraggable = {
    isActive: () => isActive,
    toggleActive: () => {
      isActive = !isActive;
      node.classList.toggle('keyboard-dragging', isActive);
      if (isActive) {
        node.focus();
      }
      return isActive;
    },
    handleMove: (key) => {
      if (!isActive) return false;

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

      const move = moves[key];
      if (move) {
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
          onMove(position, { key });
        }
        return true;
      }
      return false;
    },
    getPosition: () => ({ ...position }),
    setPosition: (newPosition) => {
      position = { ...newPosition };
      node.style.transform = `translate(${position.x}px, ${position.y}px)`;
    }
  };

  const handleFocus = () => {
    node.classList.add('keyboard-focusable');
  };

  const handleBlur = () => {
    node.classList.remove('keyboard-focusable', 'keyboard-dragging');
    isActive = false;
  };

  // Make element focusable and add focus/blur listeners only
  node.setAttribute('tabindex', '0');
  node.setAttribute('role', 'application');
  node.setAttribute('aria-label', 'Draggable element - press Space to drag, arrow keys to move');
  node.addEventListener('focus', handleFocus);
  node.addEventListener('blur', handleBlur);

  return {
    update(newOptions = {}) {
      Object.assign(options, newOptions);
    },
    destroy() {
      node.removeEventListener('focus', handleFocus);
      node.removeEventListener('blur', handleBlur);
      node.removeAttribute('tabindex');
      node.removeAttribute('role');
      node.removeAttribute('aria-label');
      node.classList.remove('keyboard-focusable', 'keyboard-dragging');
      delete node.keyboardDraggable;
    }
  };
}

/**
 * Action for comprehensive keyboard navigation in panels and dialogs
 * Updated to work with unified keyboard system - no competing handlers
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

  // UNIFIED SYSTEM: Panel navigation now handled by unified keyboard shortcuts
  // This removes competing addEventListener('keydown') calls
  // The keyboardAction system handles panel navigation through registered actions

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

  // Add focus management listeners only (no keydown)
  if (trapFocus) {
    document.addEventListener('focusin', handleFocusIn, true);
  }

  // Export panel navigation functionality for unified keyboard system
  node.panelNavigation = {
    getFocusableElements,
    handleTabNavigation: (event) => {
      if (!trapFocus) return false;

      focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return false;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.key === 'Tab') {
        if (event.shiftKey) {
          // Shift + Tab (backwards)
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
            return true;
          }
        } else {
          // Tab (forwards)
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
            return true;
          }
        }
      }
      return false;
    },
    focusFirst: () => {
      focusableElements = getFocusableElements();
      if (firstFocus) {
        firstFocus.focus();
      } else if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    },
    focusLast: () => {
      focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[focusableElements.length - 1].focus();
      }
    }
  };

  return {
    update(newOptions = {}) {
      Object.assign(options, newOptions);
    },
    destroy() {
      document.removeEventListener('focusin', handleFocusIn, true);
      delete node.panelNavigation;

      // Restore previous focus
      if (restoreFocus && previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    }
  };
}