# NeuroSense FX - Design System & UI Architecture Specification

## Document Purpose

This specification defines the comprehensive design system, component architecture, and implementation guidelines for the NeuroSense FX web application. It is intended for LLM-assisted development and human developers to create a cohesive, high-performance, neuro-cognitively optimized trading interface.

---

## 1. Design Philosophy & Constraints

### 1.1 Core Principles

**Human-Centric, Neuro-Cognitive Design:**
- **Minimal Visual Noise**: Ultra-dark backgrounds, subtle borders, high-density information display
- **Pre-Attentive Processing**: Leverage color, motion, size, and position for <200ms perception
- **Cognitive Load Reduction**: Support 8-12 hour trading sessions without mental fatigue
- **Adaptive Visual Hierarchy**: Critical information demands immediate attention through science-based visual cues
- **Glanceability**: Traders must extract information in <1 second glances

**Performance Requirements:**
- Support 20+ concurrent Canvas 2D visualizations (220px × 120px each)
- Main UI thread must remain responsive during real-time data processing
- Web Workers handle all computationally intensive tasks
- Canvas rendering synchronized via `requestAnimationFrame`
- Minimal DOM manipulation - UI controls only, visualizations in Canvas

**Design System Goals:**
- **Atomic Design**: Build from smallest primitives to complex organisms
- **Dynamic Adaptability**: Global density/spacing changes via CSS variables
- **Consistent Visual Language**: Single source of truth for all design tokens
- **Developer Experience**: Predictable patterns, minimal cognitive overhead for developers

### 1.2 Visual Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Canvas Viz Size | 220px × 120px | Fixed per design intent document |
| Background | Ultra-dark (#0a0e1a) | Reduce eye strain, emphasize data |
| Primary Text | Light gray (#e8eaed) | High contrast without harshness |
| Border Style | Subtle, 1px | Minimize visual weight |
| Font | Monospace for data, Sans for UI | Data clarity, UI readability |
| Default Density | High (compact spacing) | Maximize screen real estate |

---

## 2. Technology Stack

### 2.1 Core Technologies (Existing)

```javascript
{
  "framework": "Svelte",
  "bundler": "Vite",
  "rendering": "Canvas 2D API",
  "dataProcessing": "Web Workers",
  "realTimeData": "WebSockets",
  "stateManagement": "Svelte Stores"
}
```

### 2.2 Design System Stack (New)

| Layer | Technology | Purpose | Bundle Impact |
|-------|-----------|---------|---------------|
| **UI Primitives** | **Melt UI** | Headless, accessible components | ~50KB |
| **Styling Foundation** | **Tailwind CSS (core only)** | Atomic utility classes | ~30KB |
| **Design Tokens** | **CSS Custom Properties** | Global theming, runtime changes | 0KB |
| **Component Architecture** | **Atomic Design Pattern** | Systematic composition | 0KB (pattern) |
| **Icons** | **Lucide Svelte** | Tree-shakeable icon set | ~5KB (used icons) |
| **Data Tables** | **TanStack Table (Svelte)** | Virtual scrolling, high performance | ~20KB |
| **Motion** | **Svelte Transitions + CSS** | Native performance | 0KB (built-in) |

**Total Additional Bundle Size**: ~105KB (acceptable for enterprise trading app)

### 2.3 Rationale for Melt UI over Alternatives

| Criteria | Melt UI | Skeleton UI | Flowbite | Custom |
|----------|---------|-------------|----------|--------|
| Performance Impact | None (headless) | Low | Medium | None |
| Canvas Compatibility | ✅ Perfect | ✅ Good | ⚠️ Potential conflicts | ✅ Perfect |
| Customization | ✅ Total control | ⚠️ Theme overrides | ❌ Limited | ✅ Total |
| Bundle Size | Minimal | Medium | Large | Minimal |
| Development Speed | Medium | Fast | Fastest | Slowest |
| **Recommendation** | **PRIMARY** | Fallback | Avoid | Future refactor |

---

## 3. Design Token System

### 3.1 Token Structure

Design tokens are the **single source of truth** for all visual properties. They enable global changes to spacing, colors, typography, and motion without touching component code.

```javascript
// src/design/tokens.js

export const tokens = {
  // SPACING SCALE - Easily adjust entire UI density
  space: {
    0: '0',
    1: '2px',   // Ultra-dense UI elements
    2: '4px',   // High-density default
    3: '8px',   // Normal spacing
    4: '12px',  // Comfortable spacing
    5: '16px',  // Generous spacing
    6: '24px',  // Section spacing
    7: '32px',  // Large gaps
    8: '48px'   // Major sections
  },

  // COGNITIVE COLOR SYSTEM - Pre-attentive processing
  cognitive: {
    // Immediate attention colors (from design intent)
    critical: '#dc2626',    // Brightest red - alerts, ADR boundary pulse
    danger: '#ef4444',      // Red - bearish, sell activity
    warning: '#f59e0b',     // Orange - caution signals
    success: '#10b981',     // Green - bullish, buy activity
    info: '#3b82f6',        // Blue - neutral information
    focus: '#8b5cf6',       // Purple - active state, price float glow
    
    // Trading-specific (matches design intent document)
    bullish: '#10b981',     // Buy pressure, upward movement
    bearish: '#ef4444',     // Sell pressure, downward movement
    neutral: '#6b7280',     // No directional bias
    priceFloat: '#a78bfa', // Soft purple for price float line
    orbGlow: '#8b5cf6',     // Volatility orb color
    
    // Attention hierarchy (brightness = urgency)
    criticalHigh: '#dc2626',  // Maximum urgency
    high: '#f59e0b',          // Important
    medium: '#60a5fa',        // Notable
    low: '#9ca3af'            // Background info
  },

  // BACKGROUNDS - Ultra-dark for minimal visual noise
  background: {
    primary: '#0a0e1a',    // Main app background
    secondary: '#0f1419',  // Panel backgrounds
    tertiary: '#141821',   // Elevated elements
    elevated: '#1a1d26',   // Dropdowns, modals
    canvas: '#0a0e1a'      // Canvas visualization background
  },

  // BORDERS - Subtle separation
  border: {
    subtle: '#1f2229',     // Barely visible
    default: '#2d3139',    // Standard borders
    emphasis: '#404652',   // Hover, focus states
    active: '#4a8cff'      // Active selection
  },

  // TEXT HIERARCHY
  text: {
    primary: '#e8eaed',    // Main content
    secondary: '#9ca3af',  // Supporting text
    tertiary: '#6b7280',   // De-emphasized text
    disabled: '#4b5563',   // Disabled state
    inverse: '#0a0e1a'     // Text on light backgrounds
  },

  // TYPOGRAPHY - Information density & hierarchy
  typography: {
    fontFamily: {
      mono: "'Roboto Mono', 'JetBrains Mono', 'Courier New', monospace",
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    },
    fontSize: {
      xs: '10px',    // Dense labels, metadata
      sm: '11px',    // Secondary information
      base: '12px',  // Primary data (default)
      md: '14px',    // Section headers
      lg: '16px',    // Important metrics
      xl: '18px',    // Key figures
      xxl: '20px'    // Critical values
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeight: {
      tight: 1.2,    // Dense text
      normal: 1.4,   // Standard
      relaxed: 1.6   // Comfortable
    },
    letterSpacing: {
      tight: '-0.01em',
      normal: '0',
      wide: '0.01em',
      wider: '0.05em'
    }
  },

  // DENSITY PRESETS - Switch entire app density instantly
  density: {
    ultra: {
      padding: '2px',
      gap: '2px',
      fontSize: '10px',
      lineHeight: 1.2,
      iconSize: '14px'
    },
    high: {
      padding: '4px',
      gap: '4px',
      fontSize: '11px',
      lineHeight: 1.3,
      iconSize: '16px'
    },
    normal: {
      padding: '8px',
      gap: '8px',
      fontSize: '12px',
      lineHeight: 1.4,
      iconSize: '18px'
    },
    comfortable: {
      padding: '12px',
      gap: '12px',
      fontSize: '14px',
      lineHeight: 1.5,
      iconSize: '20px'
    }
  },

  // MOTION - Neuro-cognitive timing (from neuroscience research)
  motion: {
    duration: {
      instant: '50ms',    // Immediate feedback (tactile response)
      fast: '150ms',      // Quick transitions (still feels immediate)
      normal: '250ms',    // Standard UI transitions
      slow: '400ms',      // Attention-drawing animations
      verySlow: '600ms'   // Dramatic state changes
    },
    easing: {
      // Standard easings
      linear: 'linear',
      easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
      easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      
      // Neuro-cognitive optimized
      snappy: 'cubic-bezier(0.4, 0.0, 0.2, 1)',  // Feels responsive
      smooth: 'cubic-bezier(0.4, 0.0, 0.6, 1)',  // Natural motion
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Playful
      anticipate: 'cubic-bezier(0.22, 1, 0.36, 1)' // Overshoots slightly
    }
  },

  // Z-INDEX LAYERS - Prevent z-index chaos
  zIndex: {
    base: 0,
    dropdown: 50,
    sticky: 100,
    overlay: 200,
    modal: 300,
    popover: 400,
    tooltip: 500,
    alert: 600
  },

  // SHADOW - Depth perception
  shadow: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    default: '0 2px 4px 0 rgba(0, 0, 0, 0.4)',
    md: '0 4px 8px 0 rgba(0, 0, 0, 0.5)',
    lg: '0 8px 16px 0 rgba(0, 0, 0, 0.6)',
    xl: '0 16px 32px 0 rgba(0, 0, 0, 0.7)'
  },

  // VISUAL IMPORTANCE PRESETS - Cognitive hierarchy
  importance: {
    critical: {
      fontSize: '18px',
      fontWeight: 700,
      color: '#dc2626',
      textShadow: '0 0 8px rgba(220, 38, 38, 0.5)',
      animation: 'pulse 2s ease-in-out infinite'
    },
    high: {
      fontSize: '16px',
      fontWeight: 600,
      color: '#e8eaed'
    },
    medium: {
      fontSize: '12px',
      fontWeight: 500,
      color: '#e8eaed'
    },
    low: {
      fontSize: '11px',
      fontWeight: 400,
      color: '#9ca3af'
    }
  }
};
```

### 3.2 CSS Variable Implementation

```css
/* src/design/tokens.css */

:root {
  /* ==================== SPACING ==================== */
  --space-0: 0;
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 8px;
  --space-4: 12px;
  --space-5: 16px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 48px;

  /* ==================== DENSITY (Dynamic) ==================== */
  /* Default to HIGH density */
  --density-padding: var(--space-2);
  --density-gap: var(--space-2);
  --density-text: 11px;
  --density-line-height: 1.3;
  --density-icon-size: 16px;

  /* ==================== COLORS - COGNITIVE ==================== */
  --color-critical: #dc2626;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-success: #10b981;
  --color-info: #3b82f6;
  --color-focus: #8b5cf6;
  
  --color-bullish: #10b981;
  --color-bearish: #ef4444;
  --color-neutral: #6b7280;
  --color-price-float: #a78bfa;
  --color-orb-glow: #8b5cf6;

  /* ==================== BACKGROUNDS ==================== */
  --bg-primary: #0a0e1a;
  --bg-secondary: #0f1419;
  --bg-tertiary: #141821;
  --bg-elevated: #1a1d26;
  --bg-canvas: #0a0e1a;

  /* ==================== BORDERS ==================== */
  --border-subtle: #1f2229;
  --border-default: #2d3139;
  --border-emphasis: #404652;
  --border-active: #4a8cff;

  /* ==================== TEXT ==================== */
  --text-primary: #e8eaed;
  --text-secondary: #9ca3af;
  --text-tertiary: #6b7280;
  --text-disabled: #4b5563;
  --text-inverse: #0a0e1a;

  /* ==================== TYPOGRAPHY ==================== */
  --font-mono: 'Roboto Mono', 'JetBrains Mono', 'Courier New', monospace;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  --text-xs: 10px;
  --text-sm: 11px;
  --text-base: 12px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 18px;
  --text-xxl: 20px;

  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  --line-height-tight: 1.2;
  --line-height-normal: 1.4;
  --line-height-relaxed: 1.6;

  /* ==================== MOTION ==================== */
  --motion-instant: 50ms;
  --motion-fast: 150ms;
  --motion-normal: 250ms;
  --motion-slow: 400ms;
  --motion-very-slow: 600ms;

  --ease-snappy: cubic-bezier(0.4, 0.0, 0.2, 1);
  --ease-smooth: cubic-bezier(0.4, 0.0, 0.6, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* ==================== Z-INDEX ==================== */
  --z-base: 0;
  --z-dropdown: 50;
  --z-sticky: 100;
  --z-overlay: 200;
  --z-modal: 300;
  --z-popover: 400;
  --z-tooltip: 500;
  --z-alert: 600;

  /* ==================== SHADOWS ==================== */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-default: 0 2px 4px 0 rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 8px 0 rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 8px 16px 0 rgba(0, 0, 0, 0.6);
  --shadow-xl: 0 16px 32px 0 rgba(0, 0, 0, 0.7);
}

/* ==================== DENSITY MODES ==================== */
/* Apply via data attribute: <html data-density="ultra"> */

[data-density="ultra"] {
  --density-padding: var(--space-1);
  --density-gap: var(--space-1);
  --density-text: 10px;
  --density-line-height: 1.2;
  --density-icon-size: 14px;
}

[data-density="high"] {
  --density-padding: var(--space-2);
  --density-gap: var(--space-2);
  --density-text: 11px;
  --density-line-height: 1.3;
  --density-icon-size: 16px;
}

[data-density="normal"] {
  --density-padding: var(--space-3);
  --density-gap: var(--space-3);
  --density-text: 12px;
  --density-line-height: 1.4;
  --density-icon-size: 18px;
}

[data-density="comfortable"] {
  --density-padding: var(--space-4);
  --density-gap: var(--space-4);
  --density-text: 14px;
  --density-line-height: 1.5;
  --density-icon-size: 20px;
}

/* ==================== ANIMATIONS ==================== */

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 4px currentColor; }
  50% { box-shadow: 0 0 12px currentColor; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { 
    opacity: 0;
    transform: translateY(8px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 3.3 Tailwind Configuration

```javascript
// tailwind.config.js

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      // Map Tailwind utilities to CSS variables
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '7': 'var(--space-7)',
        '8': 'var(--space-8)'
      },
      colors: {
        // Cognitive colors
        'critical': 'var(--color-critical)',
        'danger': 'var(--color-danger)',
        'warning': 'var(--color-warning)',
        'success': 'var(--color-success)',
        'info': 'var(--color-info)',
        'focus': 'var(--color-focus)',
        'bullish': 'var(--color-bullish)',
        'bearish': 'var(--color-bearish)',
        'neutral': 'var(--color-neutral)',
        
        // Backgrounds
        'bg': {
          'primary': 'var(--bg-primary)',
          'secondary': 'var(--bg-secondary)',
          'tertiary': 'var(--bg-tertiary)',
          'elevated': 'var(--bg-elevated)'
        },
        
        // Borders
        'border': {
          'subtle': 'var(--border-subtle)',
          'default': 'var(--border-default)',
          'emphasis': 'var(--border-emphasis)',
          'active': 'var(--border-active)'
        },
        
        // Text
        'text': {
          'primary': 'var(--text-primary)',
          'secondary': 'var(--text-secondary)',
          'tertiary': 'var(--text-tertiary)',
          'disabled': 'var(--text-disabled)'
        }
      },
      fontSize: {
        'xs': 'var(--text-xs)',
        'sm': 'var(--text-sm)',
        'base': 'var(--text-base)',
        'md': 'var(--text-md)',
        'lg': 'var(--text-lg)',
        'xl': 'var(--text-xl)',
        'xxl': 'var(--text-xxl)'
      },
      fontFamily: {
        'mono': 'var(--font-mono)',
        'sans': 'var(--font-sans)'
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'default': 'var(--shadow-default)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)'
      },
      transitionDuration: {
        'instant': 'var(--motion-instant)',
        'fast': 'var(--motion-fast)',
        'normal': 'var(--motion-normal)',
        'slow': 'var(--motion-slow)'
      }
    }
  },
  plugins: []
};
```

---

## 4. Atomic Component Architecture

### 4.1 Component Hierarchy

```
src/components/
├── atoms/              (Smallest, indivisible UI elements)
│   ├── Button.svelte
│   ├── Input.svelte
│   ├── Label.svelte
│   ├── Badge.svelte
│   ├── Icon.svelte
│   ├── Checkbox.svelte
│   ├── Radio.svelte
│   └── Slider.svelte
│
├── molecules/          (Simple combinations of atoms)
│   ├── PriceDisplay.svelte
│   ├── SymbolBadge.svelte
│   ├── StatusIndicator.svelte
│   ├── FormField.svelte
│   ├── SearchInput.svelte
│   └── MetricCard.svelte
│
├── organisms/          (Complex, feature-complete components)
│   ├── SymbolSelector.svelte
│   ├── ConfigPanel.svelte
│   ├── OrderBook.svelte
│   ├── TradeHistory.svelte
│   └── AlertPanel.svelte
│
├── templates/          (Page-level layouts)
│   ├── DashboardGrid.svelte
│   ├── MultiChartLayout.svelte
│   └── TradingWorkspace.svelte
│
└── viz/                (Existing canvas visualizations)
    └── Container.svelte
```

### 4.2 Component Design Principles

**Every component must:**
1. Use design tokens (CSS variables) for all visual properties
2. Support density modes via `data-density` attribute propagation
3. Be keyboard accessible (Tab, Enter, Escape, Arrows)
4. Have clear prop interfaces with TypeScript/JSDoc types
5. Emit standardized events (on:select, on:change, on:submit)
6. Be composable (work with other components seamlessly)
7. Have minimal dependencies (avoid tight coupling)

**Performance requirements:**
- No unnecessary re-renders (use Svelte's reactivity wisely)
- Avoid heavy computations in component logic (use Web Workers)
- Use `{#key}` blocks sparingly
- Prefer CSS transitions over JavaScript animations
- Keep component file size < 200 lines (split if larger)

---

## 5. Atomic Components Specification

### 5.1 Button Component

```svelte
<!-- src/components/atoms/Button.svelte -->
<script>
  /**
   * Button variant - controls visual style
   * @type {'default' | 'primary' | 'critical' | 'success' | 'ghost'}
   */
  export let variant = 'default';
  
  /**
   * Button size - uses density tokens
   * @type {'compact' | 'default' | 'large'}
   */
  export let size = 'default';
  
  /**
   * Disabled state
   * @type {boolean}
   */
  export let disabled = false;
  
  /**
   * Full width button
   * @type {boolean}
   */
  export let fullWidth = false;
  
  /**
   * Loading state - shows spinner, disables interaction
   * @type {boolean}
   */
  export let loading = false;
</script>

<button
  class="btn btn-{variant} btn-{size}"
  class:btn-full-width={fullWidth}
  class:btn-loading={loading}
  {disabled}
  on:click
  on:mouseenter
  on:mouseleave
  on:focus
  on:blur
>
  {#if loading}
    <span class="btn-spinner" aria-hidden="true"></span>
  {/if}
  <slot />
</button>

<style>
  .btn {
    /* Use density tokens for adaptive sizing */
    padding: var(--density-padding) calc(var(--density-padding) * 2);
    font-size: var(--density-text);
    line-height: var(--density-line-height);
    font-family: var(--font-sans);
    font-weight: var(--font-medium);
    
    /* Minimal visual style */
    border-radius: 2px;
    border: 1px solid var(--border-default);
    background: var(--bg-elevated);
    color: var(--text-primary);
    
    /* Smooth transitions */
    transition: all var(--motion-fast) var(--ease-snappy);
    
    /* Remove default button styles */
    cursor: pointer;
    outline: none;
    
    /* Prevent text selection */
    user-select: none;
    
    /* Inline-flex for icon + text alignment */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  
  .btn:hover:not(:disabled) {
    background: var(--bg-tertiary);
    border-color: var(--border-emphasis);
  }
  
  .btn:focus-visible {
    border-color: var(--border-active);
    box-shadow: 0 0 0 2px rgba(74, 140, 255, 0.2);
  }
  
  .btn:active:not(:disabled) {
    transform: translateY(1px);
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Variants */
  .btn-primary {
    background: var(--color-focus);
    border-color: var(--color-focus);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-focus) 85%, black);
  }
  
  .btn-critical {
    background: var(--color-critical);
    border-color: var(--color-critical);
    color: white;
  }
  
  .btn-success {
    background: var(--color-success);
    border-color: var(--color-success);
    color: white;
  }
  
  .btn-ghost {
    background: transparent;
    border-color: transparent;
  }
  
  .btn-ghost:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }
  
  /* Sizes */
  .btn-compact {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
  }
  
  .btn-large {
    padding: var(--space-4) var(--space-6);
    font-size: var(--text-md);
  }
  
  /* Full width */
  .btn-full-width {
    width: 100%;
  }
  
  /* Loading state */
  .btn-loading {
    pointer-events: none;
    opacity: 0.7;
  }
  
  .btn-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
```

**Usage:**
```svelte
<Button variant="primary" on:click={handleSubmit}>Submit</Button>
<Button variant="critical" size="compact">Delete</Button>
<Button variant="ghost" loading={true}>Loading...</Button>
```

### 5.2 Input Component

```svelte
<!-- src/components/atoms/Input.svelte -->
<script>
  /**
   * Input type
   * @type {'text' | 'number' | 'email' | 'password' | 'search'}
   */
  export let type = 'text';
  
  /**
   * Input value (two-way binding)
   * @type {string | number}
   */
  export let value = '';
  
  /**
   * Placeholder text
   * @type {string}
   */
  export let placeholder = '';
  
  /**
   * Disabled state
   * @type {boolean}
   */
  export let disabled = false;
  
  /**
   * Error state
   * @type {boolean}
   */
  export let error = false;
  
  /**
   * Full width input
   * @type {boolean}
   */
  export let fullWidth = false;
  
  /**
   * Monospace font