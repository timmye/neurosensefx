// Price Marker Interaction System - Crystal Clarity: Simple, Performant, Maintainable
// Framework-first: Direct DOM APIs, no custom libraries

import { workspaceActions, workspaceStore } from '../stores/workspace.js';
import { createMarker, getMarkerAtPosition } from './priceMarkers.js';
import { toPrice } from './priceMarkerCoordinates.js';
import { createPriceScale } from './dayRangeRenderingUtils.js';
import { showDropdown } from './priceMarkerDropdown.js';
import { formatPriceToPipLevel, formatPipMovement, formatPriceWithPipPosition } from './priceFormat.js';
import { getYCoordinate, calculateAdaptiveScale } from './dayRangeCalculations.js';
import { drawPriceMarker } from './dayRangeElements.js';

export class PriceMarkerInteraction {
  constructor(canvas, displayId, data, scale) {
    this.canvas = canvas;
    this.displayId = displayId;
    this.scale = scale;
    this.data = data;
    this.activeDropdown = null;
    this.deltaMode = null;
    this.onDeltaMove = null;
    this.onDeltaEnd = null;
    this.init();
  }

  updateData(data) {
    this.data = data;
  }

  init() {
    this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e));
    this.canvas.addEventListener('contextmenu', e => this.handleContextMenu(e));
    document.addEventListener('keydown', e => e.key === 'Escape' && this.hideDropdown());
  }

  handleMouseDown(e) {
    // Right-click-hold for delta mode (but NOT when Alt is held for marker operations)
    if (e.button === 2 && !e.altKey) {
      e.preventDefault(); // Prevent context menu

      const rect = this.canvas.getBoundingClientRect();
      // Bounds checking
      if (e.clientY < rect.top || e.clientY > rect.bottom) return;

      const relativeY = e.clientY - rect.top;
      const price = toPrice(this.canvas, this.scale, this.data, relativeY);

      // Validate price
      if (!price || !isFinite(price)) return;

      if (price) {
        this.deltaMode = {
          startY: relativeY,
          startPrice: price,
          startTime: Date.now()
        };
        // Trigger parent re-render instead of storing canvas data
        this.onRerender?.();
      }
      return;
    }

    // Alt+click for price markers
    if (!e.altKey || e.button !== 0) return;
    const relativeY = e.clientY - this.canvas.getBoundingClientRect().top;
    const price = toPrice(this.canvas, this.scale, this.data, relativeY);
    if (price) {
      const pipSize = this.data?.pipSize || 0.0001;
      const pipPosition = this.data?.pipPosition || 4;
      const roundedPrice = formatPriceToPipLevel(price, pipPosition, pipSize);
      const marker = createMarker('normal', roundedPrice, this.displayId);
      if (marker) {
        workspaceActions.addPriceMarker(this.displayId, marker);
      }
    }
  }

  handleMouseMove(e) {
    // Delta mode drag
    if (this.deltaMode) {
      const relativeY = e.clientY - this.canvas.getBoundingClientRect().top;
      const currentPrice = toPrice(this.canvas, this.scale, this.data, relativeY);
      if (currentPrice && this.onDeltaMove) {
        // Let parent handle via reactive render pipeline
        this.onDeltaMove(this.deltaMode.startPrice, currentPrice);
      }
      return;
    }

    // Alt+hover for price preview
    const altKey = e.altKey;
    this.canvas.style.cursor = altKey ? 'crosshair' : 'default';

    if (altKey) {
      const relativeY = e.clientY - this.canvas.getBoundingClientRect().top;
      const price = toPrice(this.canvas, this.scale, this.data, relativeY);
      if (this.onHoverPrice) {
        this.onHoverPrice(price);
      }
    } else {
      if (this.onHoverPrice) {
        this.onHoverPrice(null);
      }
    }
  }

  handleMouseUp(e) {
    // End delta mode on right button release
    if (this.deltaMode && e.button === 2) {
      this.deltaMode = null;
      if (this.onDeltaEnd) {
        this.onDeltaEnd();
      }
    }
  }

  handleContextMenu(e) {
    e.preventDefault();

    // Only handle Alt+right-click for dropdown (exclude delta when Alt is held)
    if (!e.altKey) return;

    const rect = this.canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const price = toPrice(this.canvas, this.scale, this.data, y);

    if (price) {
      const state = workspaceStore.getState();
      const display = state.displays.get(this.displayId);
      // Use same coordinate system as renderDeltaOverlay (dayRangeRenderingUtils)
      const scaleData = {
        adrHigh: this.data?.adrHigh,
        adrLow: this.data?.adrLow,
        high: this.data?.high,
        low: this.data?.low,
        current: this.data?.current,
        open: this.data?.open
      };
      const config = { scaling: 'adaptive' };
      const adaptiveScale = calculateAdaptiveScale(scaleData, config);
      // Use CSS height (rect.height) to match mouse coordinate system
      const scale = createPriceScale(config, adaptiveScale, this.canvas.getBoundingClientRect().height);
      const marker = getMarkerAtPosition(display?.priceMarkers || [], y, scale);
      if (marker) {
        this.activeDropdown = showDropdown(e.clientX, e.clientY, marker, this.displayId);
      }
    }
  }

  hideDropdown() {
    if (this.activeDropdown) {
      this.activeDropdown.remove();
      this.activeDropdown = null;
    }
  }

  endDeltaMode() {
    this.deltaMode = null;
    if (this.onDeltaEnd) {
      this.onDeltaEnd();
    }
  }

  
  destroy() {
    this.hideDropdown();
    this.endDeltaMode(); // Clean up any active delta mode
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('keydown', e => e.key === 'Escape' && this.hideDropdown());

    // Clear memory references
    this.deltaMode = null;
  }
}

export function createPriceMarkerInteraction(canvas, displayId, data, scale) {
  return new PriceMarkerInteraction(canvas, displayId, data, scale);
}