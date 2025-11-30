# Claude Context: Simple Implementation

## 🎯 You Are Here: src-simple/

Building the simple, maintainable NeuroSense FX trading interface.

---

## ⚠️ Three Critical Documents

# MUST READ these BEFORE every session:

1. **CONTRACT.md** - Rules and line limits
2. **ARCHITECTURE.md** - Which framework does what


---

## 🚀 Quick Start

### Run the Simple Frontend
```bash
# From project root (not /src-simple)
./run.sh backend 
./run.sh dev-simple

# Opens:
# - Backend: ws://localhost:8080
# - Frontend: http://localhost:5175
```

### Check What's Running

```bash
# From project root (not /src-simple)
./run.sh status    # See running services
./run.sh stop      # Stop everything
```

### Test the Three MUST HAVEs
1. Open http://localhost:5175
2. Press `Alt+A` → Display appears?
3. Drag display → Smooth motion?
4. Canvas updates → Real-time data?

## Testing

### Crystal Clarity Frontend Testing

# Enhanced Console Monitoring (MANDATORY)
npm run test:console             # Comprehensive console logging analysis
npm run test:console:headed      # Console monitoring with visible browser
npm run test:console:ui          # Interactive console debugging with UI

```

### Enhanced Console Monitoring System
The enhanced console monitoring provides comprehensive system visibility with emoji-based classification:

**Features:**
- 🌐 **Network Activity**: HTTP requests, WebSocket connections, API calls
- ⌨️ **User Interactions**: Keyboard events, mouse actions, shortcut processing
- ❌ **System Errors**: JavaScript errors, component failures, initialization issues
- ✅ **Success Events**: Successful operations, completed workflows
- 🔥 **Critical Issues**: Server errors, network failures, system crashes
- ⚠️ **Warnings**: Deprecation notices, performance warnings
- 💡 **Debug Information**: Development logs, performance metrics
- 📦 **Asset Loading**: Static resource requests, module loading

**Quick Console Debugging:**
```bash
npm run test:console              # Full console analysis with classification
npm run test:console:headed       # See browser activity in real-time
npm run test:console:ui           # Interactive debugging interface
```

### Testing Philosophy
- **All testing happens within the live frontend** at http://localhost:5175
- **Playwright automated tests**: `npm test` (uses separate config)
- **No external test interfaces** - test the actual application directly
- **Real browser evidence required** - no mocks or simulations
- **Improve existing tests** rather than creating new ones
- **Enhanced console visibility**: Zero-overhead monitoring for rapid debugging

### Test Configuration
- **Config File**: `src-simple/playwright.config.cjs`
- **Test Directory**: `src-simple/tests/` (create as needed)
- **Target URL**: http://localhost:5175 (Crystal Clarity frontend)
- **Auto-start**: Tests automatically start dev server on port 5175
---

## 📏 Line Count Limits

| Tier | File Type | Max Lines |
|------|-----------|-----------|
| **Core** | stores/*.js | 150 |
| **Core** | components/Workspace.svelte | 120 |
| **Core** | components/displays/FloatingDisplay.svelte | 120 |
| **Viz** | lib/visualizations/*.js | 200 |
| **Infra** | lib/performance/*.js, lib/errors/*.js | 150 |
| **Utils** | lib/*/shared/*.js | 150 (guideline) |

**Check before committing:**
```bash
wc -l stores/*.js components/**/*.svelte lib/**/*.js
```

---

## 🏗️ File Structure

```
src-simple/
├── stores/
│   └── workspace.js              (Single store - all state)
│
├── components/
│   ├── Workspace.svelte          (Container)
│   └── displays/
│       ├── FloatingDisplay.svelte (Display wrapper)
│       ├── DisplayHeader.svelte   (Controls)
│       └── DisplayCanvas.svelte   (Canvas element)
│
└── lib/
    ├── visualizations/
    │   ├── dayRangeMeter.js      (Implemented ✓)
    │   ├── marketProfile.js      (Next)
    │   └── shared/
    │       ├── canvas.js         (DPR, setup)
    │       └── geometry.js       (Drawing helpers)
    │
    ├── data/
    │   └── websocket.js          (Real-time connection)
    │
    ├── navigation/
    │   └── keyboard.js           (Shortcuts)
    │
    └── persistence/
        └── workspace.js          (Save/load)
```

---

## 🎯 Framework Usage (Quick Reference)

**Full details in ARCHITECTURE.md** - Read it first.

| Need | Use | Never |
|------|-----|-------|
| UI/State | Svelte | Redux, MobX |
| Drag/Drop | interact.js | Manual mousedown/move |
| Rendering | Canvas 2D API | Chart.js, D3 |
| Real-time | WebSocket API | Socket.io, polling |
| Persistence | localStorage | IndexedDB |
| Build | Vite | Webpack |

---

## 📋 Development Checklist

### Before Starting
- [ ] Read CONTRACT.md
- [ ] Read ARCHITECTURE.md
- [ ] Understand user need
- [ ] Check line counts

### While Coding
- [ ] Using framework features?
- [ ] Functions under 15 lines?
- [ ] Single responsibility?
- [ ] Checking limits frequently?

### Before Committing
- [ ] Line counts under limits?
- [ ] Three MUST HAVEs still work?
- [ ] Clear commit message?

---

## 🚫 Never Do This

```javascript
// ❌ Import from legacy code
import { anything } from '../src/...'

// ❌ Build what frameworks provide
function customDragLogic() { /* ... */ }

// ❌ Multiple stores
export const displayStore = writable({});
export const symbolStore = writable({});

// ❌ Abstractions
class AbstractFactory { /* ... */ }

// ❌ Copy complex patterns from src/
```

---

## ✅ Always Do This

```javascript
// ✅ Use framework directly
import interact from 'interactjs';
interact(element).draggable({ /* ... */ });

// ✅ Single store
import { workspace } from '../stores/workspace.js';
workspace.update(state => { /* ... */ });

// ✅ Simple, direct code
function addDisplay(symbol) {
  const id = crypto.randomUUID();
  workspace.update(state => {
    state.displays.set(id, { id, symbol });
    return state;
  });
}
```

---

## 🎯 Feature Priorities

### Implemented ✓
- Floating workspace
- Interactive displays
- Day Range Meter visualization
- WebSocket real-time data
- Position persistence

### Next (Phase 2 - Core MUST HAVEs)
- Symbol management
- Error handling
- Keyboard shortcuts
- Context menu

### Future (Phase 3 - Visualizations)
- Market Profile
- Price Float
- Volatility Orb
- [8 more visualizations]

---

## 💡 Core Philosophy

**Simple**: Minimum code, framework defaults, readable in 15 minutes

**Performant**: <100ms latency, 60fps rendering, efficient primitives

**Maintainable**: Single responsibility, clear naming, no abstractions

**Framework First**: Never rebuild what Svelte, interact.js, Canvas provide

---

## 📞 When Stuck

1. Is this a MUST HAVE? (If no, stop)
2. Does framework provide this? (Check ARCHITECTURE.md)
3. What's the simplest way? (Functions <15 lines)
4. Will I exceed limits? (Check line counts)

If still stuck: Re-read CONTRACT.md decision framework.

---

**That's it. Keep it simple. Use frameworks. Ship features.**