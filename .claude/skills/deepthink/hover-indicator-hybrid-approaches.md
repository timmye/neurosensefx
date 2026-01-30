# Design Synthesis: Hybrid Approaches for Hover Indicator in Financial Trading Visualization

**Context:** NeuroSense FX currently implements Alt+hover for price preview indicators. This analysis explores hybrid approaches that balance the need for instant price feedback (trading UX expectations) with performance and cognitive load considerations.

**Current Implementation:**
- Alt+hover shows dashed preview line with price label
- Crosshair cursor when Alt is pressed
- Real-time price tracking following mouse movement
- Located at `/workspaces/neurosensefx/src/lib/priceMarkerInteraction.js` (lines 92-106)

## Industry Benchmarking

### TradingView (Primary Reference)
- **Crosshair:** Always-on hover, no modifier required
- **Behavior:** Instant price feedback on both axes
- **Dismissal:** ESC key or dedicated toggle button
- **User Mental Model:** "I'm looking at a chart, show me the price"

### Bloomberg Terminal
- **Tooltips:** Show on hover, deliberately unobtrusive
- **Philosophy:** Speed is paramount for traders
- **Design:** Subtle, professional, no visual clutter

### Photoshop (Tool Reference)
- **Alt+hover:** Shows color picker (temporary mode)
- **Rationale:** Professional tools use modifiers for temporary, precision operations
- **Key Difference:** Photo editing is deliberate; trading is reactive/real-time

## The Core Trade-off

| Dimension | Alt+Hover (Current) | Always-On Hover |
|-----------|---------------------|-----------------|
| **Discovery** | Low (must learn modifier) | High (immediately obvious) |
| **Performance** | Optimal (render on demand) | Continuous render cost |
| **Cognitive Load** | Higher (remember modifier) | Lower (natural behavior) |
| **Visual Clutter** | Minimal | Potential over-stimulation |
| **Trading UX** | Non-standard | Aligns with expectations |

## Hybrid Approach #1: Smart Timeout with Momentum

### Design Specification
**User Flow:**
1. Mouse enters canvas → no immediate indicator
2. Mouse pauses or slows (velocity < threshold) → indicator appears after 200ms
3. Mouse moves quickly → indicator disappears
4. Mouse exits canvas → indicator dismissed

**Implementation:**
```javascript
// Velocity-based hover detection
let lastMouseTime = 0;
let lastMouseY = 0;
let hoverTimeout = null;
let isShowing = false;

handleMouseMove(e) {
  const now = Date.now();
  const currentY = e.clientY - this.canvas.getBoundingClientRect().top;
  const velocity = Math.abs(currentY - lastMouseY) / (now - lastMouseTime);

  // Clear existing timeout
  if (hoverTimeout) clearTimeout(hoverTimeout);

  if (velocity < 0.5 && !isShowing) {
    // Slow movement - schedule hover show
    hoverTimeout = setTimeout(() => {
      const price = toPrice(this.canvas, this.scale, this.data, currentY);
      if (this.onHoverPrice) {
        this.onHoverPrice(price);
        this.canvas.style.cursor = 'crosshair';
        isShowing = true;
      }
    }, 200);
  } else if (velocity > 2.0 && isShowing) {
    // Fast movement - hide immediately
    if (this.onHoverPrice) {
      this.onHoverPrice(null);
      this.canvas.style.cursor = 'default';
      isShowing = false;
    }
  }

  lastMouseTime = now;
  lastMouseY = currentY;
}
```

**Complexity:** Medium (~30 lines additional code)
**Pros:**
- Intelligently detects "intent" (hovering vs. passing through)
- Reduces renders during fast mouse movement
- Maintains professional feel

**Cons:**
- 200ms delay may feel sluggish for some traders
- Velocity threshold needs tuning per user preference
- More complex state management

**Best For:** Users who want always-on but are sensitive to visual noise

---

## Hybrid Approach #2: Context-Aware Zones

### Design Specification
**User Flow:**
1. Mouse in "action zone" (right 20% of canvas near price axis) → indicator shows
2. Mouse in "data zone" (center 60%) → no indicator
3. Mouse in "label zone" (left 20%) → no indicator
4. Alt+hover overrides → shows anywhere

**Implementation:**
```javascript
handleMouseMove(e) {
  const rect = this.canvas.getBoundingClientRect();
  const relativeX = e.clientX - rect.left;
  const relativeY = e.clientY - rect.top;
  const actionZoneWidth = rect.width * 0.2; // Right 20%
  const inActionZone = relativeX > (rect.width - actionZoneWidth);

  const altKey = e.altKey;
  const shouldShow = altKey || inActionZone;

  this.canvas.style.cursor = shouldShow ? 'crosshair' : 'default';

  if (shouldShow) {
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
```

**Complexity:** Low (~10 lines modification)
**Pros:**
- Aligns with "reading price from axis" mental model
- Minimal code change
- Preserves Alt+hover as override
- Natural discovery (mouse naturally goes to axis to read prices)

**Cons:**
- May not satisfy users who want center-crosshair
- Zone boundary arbitrary (20% vs 30%?)

**Best For:** Users who primarily check prices at the axis (TradingView-like behavior)

---

## Hybrid Approach #3: Toggle with Preference Persistence

### Design Specification
**User Flow:**
1. Default: Alt+hover (current behavior)
2. New UI: Toggle button in display header ("Always show crosshair")
3. Toggle state persists to localStorage
4. ESC key temporarily dismisses (when in always-on mode)

**Implementation:**
```javascript
// In workspace store or component
let hoverPreference = localStorage.getItem('hoverMode') || 'alt';

// In handleMouseMove
handleMouseMove(e) {
  const shouldShow = hoverPreference === 'always' || e.altKey;

  this.canvas.style.cursor = shouldShow ? 'crosshair' : 'default';

  if (shouldShow) {
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

// Add ESC listener for temporary dismissal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && hoverPreference === 'always') {
    if (this.onHoverPrice) {
      this.onHoverPrice(null);
    }
    this.tempDismissed = true;
  }
});

// Reset on mouse move (re-enable after ESC)
handleMouseMove(e) {
  if (this.tempDismissed) {
    this.tempDismissed = false;
  }
  // ... rest of logic
}
```

**Complexity:** Medium (~40 lines including UI toggle)
**Pros:**
- User choice (respect individual preferences)
- A/B testable (track toggle usage)
- ESC provides "emergency off" switch
- Aligns with Crystal Clarity (Framework-First: localStorage)

**Cons:**
- UI clutter (additional button)
- Discovery issue (users may not know toggle exists)
- Preference management overhead

**Best For:** Power users who want control over their trading environment

---

## Hybrid Approach #4: Adaptive Rendering (Performance-First)

### Design Specification
**User Flow:**
1. Always show on hover (no modifier)
2. BUT: Throttle rendering to 60fps max
3. Use `requestAnimationFrame` for smooth updates
4. Debounce price calculation to every 16ms

**Implementation:**
```javascript
let lastRenderTime = 0;
const RENDER_INTERVAL = 16; // ~60fps

handleMouseMove(e) {
  const now = Date.now();

  // Throttle rendering
  if (now - lastRenderTime < RENDER_INTERVAL) {
    return;
  }

  lastRenderTime = now;

  const relativeY = e.clientY - this.canvas.getBoundingClientRect().top;
  const price = toPrice(this.canvas, this.scale, this.data, relativeY);

  // Use rAF for smooth updates
  requestAnimationFrame(() => {
    if (this.onHoverPrice) {
      this.onHoverPrice(price);
    }
  });

  this.canvas.style.cursor = 'crosshair';
}
```

**Complexity:** Low (~15 lines modification)
**Pros:**
- Always-on UX (meets trader expectations)
- Performance-conscious (throttled)
- Minimal visual lag (60fps = 16ms, imperceptible)
- Simple implementation

**Cons:**
- Still more frequent renders than Alt+hover
- Doesn't address cognitive load concerns

**Best For:** Performance-conscious users who want always-on behavior

---

## Hybrid Approach #5: Progressive Disclosure (Discovery-First)

### Design Specification
**User Flow:**
1. First session: Show subtle "tip" annotation on canvas edge: "Hold Alt for price preview"
2. After 5 Alt+hover uses: Prompt "Always show on hover? [Yes] [No] [Ask later]"
3. If Yes: Switch to always-on mode
4. If No: Keep Alt+hover, don't ask again
5. Store preference in localStorage

**Implementation:**
```javascript
// Track usage
let altHoverCount = parseInt(localStorage.getItem('altHoverCount') || '0');
let userPreference = localStorage.getItem('hoverPreference');

// In handleMouseMove
handleMouseMove(e) {
  if (e.altKey) {
    // Increment counter
    altHoverCount++;
    localStorage.setItem('altHoverCount', altHoverCount);

    // Show prompt after 5 uses if no preference set
    if (altHoverCount === 5 && !userPreference) {
      showPreferencePrompt();
    }

    // Show hover (existing logic)
    const relativeY = e.clientY - this.canvas.getBoundingClientRect().top;
    const price = toPrice(this.canvas, this.scale, this.data, relativeY);
    if (this.onHoverPrice) {
      this.onHoverPrice(price);
    }
  } else if (userPreference === 'always') {
    // Always-on mode (existing logic)
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

function showPreferencePrompt() {
  // Simple modal or toast
  const choice = confirm(
    'You\'ve used Alt+hover 5 times. Would you like to ' +
    'always show the price indicator on hover?\n\n' +
    'Yes: Always show\nCancel: Keep Alt+hover\n' +
    '(You can change this later in Settings)'
  );

  if (choice) {
    localStorage.setItem('hoverPreference', 'always');
  } else {
    localStorage.setItem('hoverPreference', 'alt');
  }
}
```

**Complexity:** High (~60 lines including prompt UI)
**Pros:**
- Educational (teaches feature during onboarding)
- Data-driven decision (users "vote" with usage)
- Respects user choice
- Reduces discovery friction

**Cons:**
- Most complex implementation
- Prompt may be disruptive
- Requires UI design for prompt
- May not scale to other features

**Best For:** Product teams who want data-driven UX decisions

---

## Decision Framework

### Evaluation Matrix

| Approach | UX Score | Performance | Code Complexity | User Control | Trading Alignment |
|----------|----------|-------------|-----------------|--------------|-------------------|
| **#1 Smart Timeout** | 7/10 | 9/10 | Medium | Low | Medium |
| **#2 Context Zones** | 8/10 | 9/10 | Low | None | High |
| **#3 Toggle** | 9/10 | 8/10 | Medium | High | High |
| **#4 Adaptive** | 8/10 | 7/10 | Low | None | High |
| **#5 Progressive** | 9/10 | 8/10 | High | Medium | High |

### Recommendation: Phased Implementation

**Phase 1 (Quick Win):** Implement **#2 Context-Aware Zones**
- Rationale: Low complexity, high trading UX alignment, minimal code change
- Timeline: 1-2 hours
- Risk: Low

**Phase 2 (User Choice):** Add **#3 Toggle with Persistence**
- Rationale: Gives users control, A/B testable
- Timeline: 3-4 hours
- Risk: Medium (UI design required)

**Phase 3 (Optimization):** Consider **#4 Adaptive Rendering**
- Rationale: Performance optimization if needed
- Timeline: 1-2 hours
- Risk: Low

**Not Recommended:**
- **#1 Smart Timeout:** Too clever, velocity thresholds are hard to tune universally
- **#5 Progressive Disclosure:** Over-engineering for a simple feature

## Implementation Guidance

### For Phase 1 (Context-Aware Zones)

**Files to Modify:**
1. `/workspaces/neurosensefx/src/lib/priceMarkerInteraction.js` (lines 92-106)
2. `/workspaces/neurosensefx/src/docs/crystal-clarity/week2-task7-hover-preview-implementation.md` (update docs)

**Code Change:** ~10 lines in `handleMouseMove()`

**Testing:**
- Verify indicator shows only in right 20% of canvas
- Verify Alt+hover override still works anywhere
- Verify smooth transition at zone boundary

**Performance Impact:** Negligible (one additional comparison per mousemove)

---

## Conclusion

The binary choice between "Alt+hover" and "always-on" is a false dichotomy. Hybrid approaches exist that capture the benefits of both:

- **Trading UX expectations** (instant price feedback)
- **Performance consciousness** (minimal render overhead)
- **Cognitive load management** (show only when relevant)
- **User agency** (preferences, overrides)

**Recommended path:** Start with **Context-Aware Zones (#2)** as a minimal, high-value change. If user feedback indicates desire for more control, add **Toggle (#3)** as a follow-up. This phased approach respects Crystal Clarity principles (Simple, Performant, Maintainable) while evolving toward user needs.

The key insight: Trading users expect instant price feedback (like TradingView), but professional tools balance this with restraint (like Bloomberg). The right solution likely lies in the middle—smart, context-aware behavior that feels both powerful and measured.
