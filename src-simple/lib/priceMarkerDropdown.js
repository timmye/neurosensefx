// Price Marker Dropdown System - Crystal Clarity Compliant
// Framework-first: Direct DOM APIs, no custom dropdown libraries

import { workspaceActions } from '../stores/workspace.js';
import { MARKER_TYPES } from './priceMarkers.js';

// Create and show dropdown menu at position
export function showDropdown(x, y, marker, displayId) {
  const d = document.createElement('div');
  d.className = 'price-marker-dropdown';
  d.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:4px 0;z-index:10000;box-shadow:0 2px 8px rgba(0,0,0,0.3);min-width:120px;`;

  const opts = [
    { l: 'Big', t: 'big' },
    { l: 'Normal', t: 'normal' },
    { l: 'Small', t: 'small' },
    { l: 'Delete', t: 'delete' }
  ];

  opts.forEach(o => {
    const i = document.createElement('div');
    i.textContent = o.l;
    const c = o.t === marker.type.name ? '#4a9eff' : (o.t === 'delete' ? '#ff6b35' : '#fff');
    i.style.cssText = `padding:8px 16px;cursor:pointer;color:${c};font-size:13px;background:${o.t === marker.type.name ? '#4a9eff' : 'transparent'};`;

    i.onmouseenter = () => {
      if (o.t !== marker.type.name) i.style.backgroundColor = '#333';
    };

    i.onmouseleave = () => {
      if (o.t !== marker.type.name) i.style.backgroundColor = 'transparent';
    };

    i.onclick = () => {
      executeAction(o.t, marker, displayId);
      d.remove();
    };

    d.appendChild(i);
  });

  document.body.appendChild(d);

  // Adjust position if outside viewport
  const r = d.getBoundingClientRect();
  if (r.right > window.innerWidth) d.style.left = `${x - r.width}px`;
  if (r.bottom > window.innerHeight) d.style.top = `${y - r.height}px`;

  return d;
}

// Execute dropdown action
export function executeAction(type, marker, displayId) {
  if (type === 'delete') {
    workspaceActions.removePriceMarker(displayId, marker.id);
  } else {
    const markerType = MARKER_TYPES[type.toUpperCase()];
    if (markerType) {
      workspaceActions.updatePriceMarker(displayId, marker.id, { type: markerType });
    }
  }
}