# Implementation Chunk Specifications

## Overview

This document provides detailed specifications for the first phase of implementation chunks, designed to be manageable units of work for LLM development while maintaining context and minimizing dependencies.

## Phase 1: Foundation Chunks

### Chunk 1.1: Design System Foundation

#### Description
Establish the visual design foundation with CSS custom properties, base styles, and utility classes that will be used throughout the application.

#### Files to Create/Modify
- `src/styles/design-tokens.css` - CSS custom properties for colors, spacing, typography
- `src/styles/base.css` - Base styles for HTML elements
- `src/styles/utilities.css` - Utility classes for common patterns
- `src/styles/components.css` - Base component styles

#### Specifications
1. **Design Tokens** (`src/styles/design-tokens.css`)
   ```css
   :root {
     /* Spacing */
     --space-1: 2px;
     --space-2: 4px;
     --space-3: 8px;
     --space-4: 12px;
     --space-5: 16px;
     --space-6: 24px;
     
     /* Colors */
     --color-primary: #0a0e1a;
     --color-secondary: #0f1419;
     --color-tertiary: #141821;
     --color-elevated: #1a1d26;
     
     /* Typography */
     --font-sans: 'Inter', sans-serif;
     --font-mono: 'Roboto Mono', monospace;
     
     /* Component-specific tokens */
     --color-bullish: #10b981;
     --color-bearish: #ef4444;
     --color-price-float: #a78bfa;
   }
   ```

2. **Base Styles** (`src/styles/base.css`)
   - Reset styles for consistency across browsers
   - Base typography settings
   - Base layout styles

3. **Utility Classes** (`src/styles/utilities.css`)
   - Spacing utilities (margin, padding)
   - Text utilities (alignment, weight, size)
   - Display utilities (flex, grid, block)
   - Color utilities (text color, background color)

#### Integration Points
- Import into main application styles
- Reference in all component styles
- Use as foundation for all visual styling

#### Tests
- Visual regression tests for design tokens
- Cross-browser compatibility tests
- Contrast ratio tests for accessibility

#### Documentation
- Design token reference guide
- Usage examples for utility classes
- Integration guidelines for components

---

### Chunk 1.2: Core Data Layer Functions

#### Description
Implement the fundamental data management functions for handling real-time market data, WebSocket connections, and symbol subscriptions.

#### Files to Create/Modify
- `src/data/websocketManager.js` - WebSocket connection management
- `src/data/symbolSubscriptionManager.js` - Symbol subscription management
- `src/data/priceDataProcessor.js` - Price data processing and normalization
- `src/data/dataCache.js` - Data caching and persistence

#### Specifications
1. **WebSocket Manager** (`src/data/websocketManager.js`)
   ```javascript
   export class WebSocketManager {
     constructor(url) {
       this.url = url;
       this.socket = null;
       this.reconnectAttempts = 0;
       this.maxReconnectAttempts = 5;
       this.reconnectDelay = 1000;
     }
     
     connect() {
       // Establish WebSocket connection
       // Handle connection events
       // Implement reconnection logic
     }
     
     disconnect() {
       // Close WebSocket connection
       // Clear reconnection timer
     }
     
     send(message) {
       // Send message through WebSocket
       // Handle connection errors
     }
     
     onMessage(callback) {
       // Register callback for incoming messages
     }
   }
   ```

2. **Symbol Subscription Manager** (`src/data/symbolSubscriptionManager.js`)
   ```javascript
   export class SymbolSubscriptionManager {
     constructor(websocketManager) {
       this.websocketManager = websocketManager;
       this.subscriptions = new Map();
     }
     
     subscribe(symbol, callback) {
       // Subscribe to symbol data
       // Store subscription and callback
       // Handle subscription errors
     }
     
     unsubscribe(symbol) {
       // Unsubscribe from symbol data
       // Remove subscription and callback
     }
     
     getSubscriptions() {
       // Return list of active subscriptions
     }
   }
   ```

3. **Price Data Processor** (`src/data/priceDataProcessor.js`)
   ```javascript
   export class PriceDataProcessor {
     constructor() {
       this.processors = new Map();
     }
     
     registerProcessor(symbol, processor) {
       // Register custom processor for symbol
     }
     
     process(rawData) {
       // Process raw price data
       // Normalize data format
       // Apply registered processors
     }
     
     calculateChange(currentPrice, previousPrice) {
       // Calculate price change
       // Return absolute and percentage change
     }
   }
   ```

4. **Data Cache** (`src/data/dataCache.js`)
   ```javascript
   export class DataCache {
     constructor(maxSize = 1000) {
       this.cache = new Map();
       this.maxSize = maxSize;
     }
     
     set(key, value) {
       // Store value in cache
       // Implement LRU eviction if needed
     }
     
     get(key) {
       // Retrieve value from cache
       // Update access time for LRU
     }
     
     has(key) {
       // Check if key exists in cache
     }
     
     clear() {
       // Clear all cached data
     }
   }
   ```

#### Integration Points
- Connect to WebSocket server in services/tick-backend
- Interface with Svelte stores for reactive state management
- Provide processed data to visualization components

#### Tests
- Unit tests for each class and method
- Integration tests for WebSocket connection
- Mock tests for data processing
- Performance tests for caching

#### Documentation
- API reference for each class
- Usage examples and integration patterns
- Error handling guidelines

---

### Chunk 1.3: Basic State Management

#### Description
Implement the core state management system using Svelte stores to manage application state reactively.

#### Files to Create/Modify
- `src/stores/connectionStore.js` - Connection status management
- `src/stores/symbolStore.js` - Symbol data management
- `src/stores/uiStateStore.js` - UI state management
- `src/stores/index.js` - Store aggregation and exports

#### Specifications
1. **Connection Store** (`src/stores/connectionStore.js`)
   ```javascript
   import { writable, derived } from 'svelte/store';
   
   function createConnectionStore() {
     const { subscribe, set, update } = writable({
       status: 'disconnected', // disconnected, connecting, connected, error
       url: '',
       lastConnected: null,
       reconnectAttempts: 0
     });
     
     return {
       subscribe,
       setStatus: (status) => update(state => ({ ...state, status })),
       setUrl: (url) => update(state => ({ ...state, url })),
       setLastConnected: (timestamp) => update(state => ({ ...state, lastConnected: timestamp })),
       incrementReconnectAttempts: () => update(state => ({ ...state, reconnectAttempts: state.reconnectAttempts + 1 })),
       resetReconnectAttempts: () => update(state => ({ ...state, reconnectAttempts: 0 })),
       reset: () => set({
         status: 'disconnected',
         url: '',
         lastConnected: null,
         reconnectAttempts: 0
       })
     };
   }
   
   export const connectionStore = createConnectionStore();
   
   // Derived stores
   export const isConnected = derived(
     connectionStore,
     $connectionStore => $connectionStore.status === 'connected'
   );
   ```

2. **Symbol Store** (`src/stores/symbolStore.js`)
   ```javascript
   import { writable, derived } from 'svelte/store';
   
   function createSymbolStore() {
     const { subscribe, set, update } = writable({
       subscriptions: new Map(),
       availableSymbols: [],
       selectedSymbol: null
     });
     
     return {
       subscribe,
       addSubscription: (symbol, data) => update(state => {
         const newSubscriptions = new Map(state.subscriptions);
         newSubscriptions.set(symbol, data);
         return { ...state, subscriptions: newSubscriptions };
       }),
       removeSubscription: (symbol) => update(state => {
         const newSubscriptions = new Map(state.subscriptions);
         newSubscriptions.delete(symbol);
         return { ...state, subscriptions: newSubscriptions };
       }),
       updateSubscription: (symbol, data) => update(state => {
         const newSubscriptions = new Map(state.subscriptions);
         if (newSubscriptions.has(symbol)) {
           newSubscriptions.set(symbol, { ...newSubscriptions.get(symbol), ...data });
         }
         return { ...state, subscriptions: newSubscriptions };
       }),
       setAvailableSymbols: (symbols) => update(state => ({ ...state, availableSymbols: symbols })),
       setSelectedSymbol: (symbol) => update(state => ({ ...state, selectedSymbol: symbol }))
     };
   }
   
   export const symbolStore = createSymbolStore();
   
   // Derived stores
   export const selectedSymbolData = derived(
     symbolStore,
     $symbolStore => $symbolStore.subscriptions.get($symbolStore.selectedSymbol)
   );
   ```

3. **UI State Store** (`src/stores/uiStateStore.js`)
   ```javascript
   import { writable, derived } from 'svelte/store';
   
   function createUIStateStore() {
     const { subscribe, set, update } = writable({
       selectedCanvas: null,
       canvasPositions: new Map(),
       activeTab: 'canvas',
       workspaceLayout: 'free', // free, grid
       zoom: 1
     });
     
     return {
       subscribe,
       setSelectedCanvas: (canvasId) => update(state => ({ ...state, selectedCanvas: canvasId })),
       updateCanvasPosition: (canvasId, position) => update(state => {
         const newPositions = new Map(state.canvasPositions);
         newPositions.set(canvasId, position);
         return { ...state, canvasPositions: newPositions };
       }),
       setActiveTab: (tab) => update(state => ({ ...state, activeTab: tab })),
       setWorkspaceLayout: (layout) => update(state => ({ ...state, workspaceLayout: layout })),
       setZoom: (zoom) => update(state => ({ ...state, zoom }))
     };
   }
   
   export const uiStateStore = createUIStateStore();
   ```

4. **Store Index** (`src/stores/index.js`)
   ```javascript
   export { connectionStore, isConnected } from './connectionStore';
   export { symbolStore, selectedSymbolData } from './symbolStore';
   export { uiStateStore } from './uiStateStore';
   ```

#### Integration Points
- Connect to data layer functions for state updates
- Subscribe to stores in Svelte components
- Persist state to local storage for recovery

#### Tests
- Unit tests for store creation and updates
- Integration tests for derived stores
- Subscription and unsubscription tests
- Persistence tests for state recovery

#### Documentation
- Store structure and usage guide
- State flow diagrams
- Integration examples with components

---

### Chunk 1.4: Development Environment Setup

#### Description
Configure the development environment for efficient LLM development, including build optimizations, testing setup, and development tools.

#### Files to Create/Modify
- `vite.config.js` - Vite configuration for development and build
- `jest.config.js` - Jest configuration for testing
- `.eslintrc.js` - ESLint configuration for code quality
- `src/main.js` - Application entry point
- `index.html` - HTML template for the application

#### Specifications
1. **Vite Configuration** (`vite.config.js`)
   ```javascript
   import { defineConfig } from 'vite';
   import { svelte } from '@sveltejs/vite-plugin-svelte';
   
   export default defineConfig({
     plugins: [svelte()],
     server: {
       port: 3000,
       open: true
     },
     build: {
       outDir: 'dist',
       sourcemap: true
     },
     resolve: {
       alias: {
         '@': '/src',
         '@components': '/src/components',
         '@stores': '/src/stores',
         '@lib': '/src/lib'
       }
     }
   });
   ```

2. **Jest Configuration** (`jest.config.js`)
   ```javascript
   export default {
     preset: 'svelte-jest',
     testEnvironment: 'jsdom',
     setupFilesAfterEnv: ['<rootDir>/src/test/setup.js'],
     moduleNameMapping: {
       '^@(.*)$': '<rootDir>/src/$1'
     },
     collectCoverageFrom: [
       'src/**/*.{js,svelte}',
       '!src/main.js',
       '!src/test/**/*'
     ]
   };
   ```

3. **ESLint Configuration** (`.eslintrc.js`)
   ```javascript
   module.exports = {
     root: true,
     extends: [
       'eslint:recommended',
       '@typescript-eslint/recommended',
       'plugin:svelte/recommended'
     ],
     parser: '@typescript-eslint/parser',
     plugins: ['@typescript-eslint'],
     parserOptions: {
       sourceType: 'module',
       ecmaVersion: 2020,
       extraFileExtensions: ['.svelte']
     },
     env: {
       browser: true,
       es2017: true,
       node: true
     },
     rules: {
       'no-console': 'warn',
       'no-debugger': 'warn'
     },
     overrides: [
       {
         files: ['*.svelte'],
         parser: 'svelte-eslint-parser',
         parserOptions: {
           parser: '@typescript-eslint/parser'
         }
       }
     ]
   };
   ```

4. **Application Entry Point** (`src/main.js`)
   ```javascript
   import './styles/design-tokens.css';
   import './styles/base.css';
   import './styles/utilities.css';
   import './styles/components.css';
   
   import App from './App.svelte';
   
   const app = new App({
     target: document.body,
     props: {}
   });
   
   export default app;
   ```

5. **HTML Template** (`index.html`)
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <title>NeuroSense FX</title>
     <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
   </head>
   <body>
     <div id="app"></div>
     <script type="module" src="/src/main.js"></script>
   </body>
   </html>
   ```

#### Integration Points
- Configure build process for all components
- Set up testing environment for all chunks
- Establish development workflow for LLM implementation

#### Tests
- Configuration tests for build tools
- Environment setup tests
- Development server tests

#### Documentation
- Development environment setup guide
- Build process documentation
- Testing workflow guide

## Phase 2: Core Components Chunks

### Chunk 2.1: Atomic UI Components

#### Description
Implement the basic UI building blocks that will be used throughout the application, following the design system established in Phase 1.

#### Files to Create/Modify
- `src/components/atomic/Button.svelte` - Button component
- `src/components/atomic/Input.svelte` - Text input component
- `src/components/atomic/Toggle.svelte` - Toggle switch component
- `src/components/atomic/Slider.svelte` - Slider component
- `src/components/atomic/StatusIndicator.svelte` - Status indicator component

#### Specifications
1. **Button Component** (`src/components/atomic/Button.svelte`)
   ```svelte
   <script>
     export let variant = 'primary'; // primary, secondary, tertiary
     export let size = 'medium'; // small, medium, large
     export let disabled = false;
     export let href = null;
     
     function getClasses() {
       return [
         'btn',
         `btn-${variant}`,
         `btn-${size}`,
         disabled && 'btn-disabled'
       ].filter(Boolean).join(' ');
     }
   </script>
   
   {#if href}
     <a {href} class={getClasses()} on:click>
       <slot />
     </a>
   {:else}
     <button class={getClasses()} {disabled} on:click>
       <slot />
     </button>
   {/if}
   
   <style>
     .btn {
       display: inline-flex;
       align-items: center;
       justify-content: center;
       border: none;
       border-radius: var(--space-1);
       font-family: var(--font-sans);
       font-weight: var(--font-medium);
       cursor: pointer;
       transition: all var(--motion-fast) var(--ease-snappy);
     }
     
     .btn-primary {
       background-color: var(--color-focus);
       color: var(--text-primary);
     }
     
     .btn-secondary {
       background-color: var(--bg-elevated);
       color: var(--text-primary);
       border: 1px solid var(--border-default);
     }
     
     .btn-small {
       padding: var(--space-1) var(--space-2);
       font-size: var(--text-xs);
     }
     
     .btn-medium {
       padding: var(--space-2) var(--space-4);
       font-size: var(--text-sm);
     }
     
     .btn-large {
       padding: var(--space-3) var(--space-5);
       font-size: var(--text-base);
     }
     
     .btn-disabled {
       opacity: 0.5;
       cursor: not-allowed;
     }
   </style>
   ```

#### Integration Points
- Use design tokens for styling
- Implement consistent event handling
- Provide accessibility features

#### Tests
- Component rendering tests
- Prop variation tests
- Event handling tests
- Accessibility tests

#### Documentation
- Component API reference
- Usage examples and guidelines
- Customization options

---

### Chunk 2.2: Basic Visualization Components

#### Description
Implement the foundational visualization components that will form the core of the NeuroSense FX interface.

#### Files to Create/Modify
- `src/components/viz/PriceFloat.svelte` - Price float visualization
- `src/components/viz/MarketProfile.svelte` - Market profile visualization
- `src/components/viz/VolatilityOrb.svelte` - Volatility orb visualization
- `src/components/viz/ADRAxis.svelte` - ADR axis visualization

#### Specifications
1. **Price Float Component** (`src/components/viz/PriceFloat.svelte`)
   ```svelte
   <script>
     export let price = 0;
     export let position = 50; // Percentage position in canvas
     export let width = 100;
     export let color = 'var(--color-price-float)';
     export let glow = true;
     
     $: style = `
       left: 50%;
       top: ${position}%;
       width: ${width}px;
       background-color: ${color};
       ${glow ? 'box-shadow: 0 0 12px rgba(167, 139, 250, 0.8);' : ''}
     `;
   </script>
   
   <div class="price-float" {style}></div>
   
   <style>
     .price-float {
       position: absolute;
       height: 4px;
       transform: translateX(-50%);
       transition: top var(--motion-normal) var(--ease-smooth);
       z-index: 3;
     }
   </style>
   ```

#### Integration Points
- Connect to symbol store for price data
- Implement smooth transitions for position changes
- Provide customization options for appearance

#### Tests
- Component rendering tests
- Data binding tests
- Animation tests
- Performance tests

#### Documentation
- Component API reference
- Data format specifications
- Customization options

---

## Implementation Guidelines for LLM Development

### 1. Chunk Structure
Each chunk should follow this structure:
1. **Specification Document** - Detailed requirements and design
2. **Implementation Files** - Code for the chunk
3. **Test Files** - Comprehensive tests
4. **Documentation Files** - Usage examples and API reference
5. **Integration Guide** - How to integrate with other chunks

### 2. Context Management
- Include relevant context in each implementation request
- Reference related chunks and their interfaces
- Maintain a current state document
- Document decisions and rationale

### 3. Validation Strategy
- Implement tests for each chunk
- Validate integration points between chunks
- Perform visual regression testing for UI components
- Test error handling and edge cases

### 4. Iterative Development
- Start with basic implementation
- Add features incrementally
- Refine based on testing and feedback
- Maintain working state at each step

### 5. Documentation Maintenance
- Update documentation after each chunk
- Maintain current state information
- Document decisions and rationale
- Track dependencies and relationships

This chunk-based approach provides a structured path for LLM implementation while maintaining context and minimizing dependencies between work units.