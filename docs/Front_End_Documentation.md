# Front-End Documentation for NeuroSense FX

## 1. Overview

This document provides a comprehensive overview of the front-end architecture for the NeuroSense FX application. The primary goal of this project is to develop a highly performant, web-based display system that can render up to 20 independent, real-time price feed visualizations in a single browser tab.

The front end is built with Svelte and Vite, and it leverages web workers to offload computationally intensive tasks to a background thread. This ensures that the main UI thread remains responsive, even when rendering a large number of visualizations.

### Core Technologies

*   **Front-end Framework**: Svelte
*   **Bundler**: Vite
*   **Data Processing**: Web Workers
*   **Real-time Data**: WebSockets
*   **Rendering**: HTML Canvas

## 2. Getting Started

To get started with the front-end development, you will need to have Node.js and npm installed on your system.

1.  **Install Dependencies**: From the root of the project, run the following command to install the necessary dependencies:

    ```bash
    npm install
    ```

2.  **Run the Development Server**: Once the dependencies are installed, you can start the Vite development server by running the following command:

    ```bash
    npm run dev
    ```

    This will start the development server on `http://localhost:5173`.

## 3. Project Structure

The front-end code is organized into the following directories:

*   **`src`**: This directory contains all the Svelte source code.
    *   **`components`**: This directory contains all the Svelte components.
    *   **`data`**: This directory contains the WebSocket client and the Svelte stores.
    *   **`workers`**: This directory contains the web worker that is responsible for processing the tick data.
*   **`public`**: This directory contains all the static assets, such as the `index.html` file.

## 4. State Management

The application's state is managed using a combination of Svelte stores and the WebSocket client.

*   **`wsClient.js`**: This module is responsible for managing the WebSocket connection to the backend. It exposes several Svelte writable stores that represent the connection status, available symbols from the live data feed, and active subscriptions:
    *   `wsStatus`: A store reflecting the overall WebSocket and cTrader session connection status. Possible values include: `disconnected`, `ws-connecting` (WebSocket connecting), `ws-open` (WebSocket open, cTrader connecting), `ctrader-connecting` (cTrader connecting), `connected` (cTrader connected and symbols loaded), and `error`.
    *   `availableSymbols`: A store containing an array of strings, representing the symbols available for subscription from the connected live data source.
    *   `subscriptions`: A store containing a Set of strings, representing the symbols the frontend is currently subscribed to for live tick data.
    It also exports functions for initiating and closing the WebSocket connection (`connect`, `disconnect`) and managing subscriptions (`subscribe`, `unsubscribe`), as well as controlling the simulated data (`startSimulation`, `stopSimulation`).

*   **`symbolStore.js`**: This store is the single source of truth for all symbol-related data and configuration. It is a writable Svelte store that contains a collection of symbol objects, keyed by symbol name. Each symbol object contains:
    *   `config`: The configuration settings for that symbol's visualization and processing.
    *   `state`: The current processed state derived from tick data (managed by the web worker).
    *   `marketProfile`: The market profile data calculated by the web worker.
    The `symbolStore` also manages the web workers for each symbol and provides functions to create new symbols (`createNewSymbol`), dispatch incoming ticks to the relevant worker (`dispatchTick`), update/reset symbol configuration (`updateConfig`, `resetConfig`), and remove/clear symbols (`removeSymbol`, `clear`).

*   **`dataProcessor.js`**: This web worker is responsible for processing all the incoming tick data for a single symbol. It receives ticks and configuration updates from the `symbolStore`, performs all the necessary calculations (e.g., volatility, market profile), and then sends the updated state back to the `symbolStore`.

## 5. WebSocket API

The front end communicates with the backend WebSocket server using a defined message API. All messages are JSON objects with a `type` field and a `payload` (which varies by type).

### Client to Backend Messages

*   **`{ type: 'connect' }`**: Sent by the frontend after establishing the WebSocket connection to signal readiness and request the current backend status.
*   **`{ type: 'subscribe', symbols: string[] }`**: Sent to request subscription to one or more symbols. The backend will respond with a `subscribeResponse`.
*   **`{ type: 'unsubscribe', symbols: string[] }`**: Sent to request unsubscription from one or more symbols. The backend will respond with a `subscribeResponse`.

### Backend to Client Messages

*   **`{ type: 'status', status: string, availableSymbols: string[], message?: string }`**: Sent by the backend to report the current overall connection status. The `status` field will be one of the unified states (e.g., `disconnected`, `ws-open`, `connected`). `availableSymbols` is an array of strings listing symbols available for trading when `status` is `connected`. An optional `message` field may provide additional details.
*   **`{ type: 'tick', symbol: string, bid: number, ask: number, spread: number, timestamp: number, ...otherTickData }`**: Sent for each incoming tick for a subscribed symbol.
*   **`{ type: 'subscribeResponse', results: Array<{ symbol: string, status: 'subscribed' | 'unsubscribed' | 'error', message?: string }> }`**: Sent in response to a `subscribe` or `unsubscribe` message, detailing the outcome for each requested symbol.
*   **`{ type: 'error', message: string }`**: Sent by the backend to indicate a backend-specific error has occurred.

## 6. Component Reference

The front end is composed of the following key components:

*   **`App.svelte`**: This is the main application component. It is responsible for managing the overall application flow, including switching between simulated and live data sources, and rendering the `VizDisplay` and `ConfigPanel` components based on the current state from the stores.
*   **`VizDisplay.svelte`**: This component is responsible for rendering the visualizations for a single symbol. It receives the symbol's state and configuration as props and uses the HTML Canvas API to render the real-time data visually.
*   **`ConfigPanel.svelte`**: This component allows the user to configure the application's settings and control the data source. It binds to the relevant stores (`dataSourceMode`, `wsStatus`, `availableSymbols`, `subscriptions`) and dispatches events (like `dataSourceChange`) or calls functions from `wsClient.js` and `symbolStore.js` to interact with the application state and backend.

## 7. Data Flow

The data flows through the application in the following order:

1.  The user selects a data source in the `ConfigPanel`, dispatching a `dataSourceChange` event.
2.  `App.svelte` handles the `dataSourceChange` event, stopping the current data source (simulation or live) and initiating the new one (calling `startSimulation` or `connect` from `wsClient.js`). It also clears existing symbols in `symbolStore`.
3.  If the data source is 'live', `wsClient.js` attempts to establish a WebSocket connection to the backend proxy (`/ws`).
4.  Upon successful WebSocket connection, `wsClient.js` sends a `{ type: 'connect' }` message to the backend.
5.  The backend processes the 'connect' message and sends a `{ type: 'status', ... }` message reflecting the current cTrader session state (e.g., `ws-open`, `ctrader-connecting`, `connected`).
6.  `wsClient.js` receives the status message and updates the `$wsStatus` and `$availableSymbols` stores. This triggers reactivity in `App.svelte` and `ConfigPanel.svelte` to update the UI.
7.  If the status becomes `connected`, `wsClient.js` attempts to resubscribe to any previously active live symbols by sending `{ type: 'subscribe', ... }` messages.
8.  The user can manually subscribe to available symbols in the `ConfigPanel`, calling `wsClient.subscribe()`.
9.  `wsClient.subscribe()` sends a `{ type: 'subscribe', ... }` message to the backend.
10. The backend receives the subscribe request, validates it, starts the cTrader tick subscription if it's the first subscriber for that symbol, and sends a `{ type: 'subscribeResponse', ... }` back.
11. `wsClient.js` receives the `subscribeResponse` and updates the `$subscriptions` store. For newly subscribed symbols, it calls `symbolStore.createNewSymbol()`.
12. `symbolStore.createNewSymbol()` creates a new symbol entry in the store and spawns a dedicated `dataProcessor.js` web worker for that symbol.
13. When the backend receives a tick for a subscribed symbol, it broadcasts a `{ type: 'tick', ... }` message.
14. `wsClient.js` receives the tick message and calls `symbolStore.dispatchTick()`.
15. `symbolStore.dispatchTick()` forwards the tick data to the appropriate `dataProcessor.js` worker for that symbol.
16. The `dataProcessor.js` worker processes the tick, updates the symbol's state and market profile, and sends a `{ type: 'stateUpdate', payload: { newState: {...}, marketProfile: {...}, flashEffect: {...} } }` message back to the `symbolStore`.
17. `symbolStore` receives the state update and updates the corresponding symbol's entry. This reactivity causes the `VizDisplay.svelte` component for that symbol to re-render with the latest data.
18. If the data source is 'simulated', `App.svelte` calls `wsClient.startSimulation()`. `wsClient.stopSimulation()` is called to clear any live connection.
19. `wsClient.startSimulation()` generates simulated tick data and directly calls `symbolStore.createNewSymbol()` (for 'SIM-EURUSD') and `symbolStore.dispatchTick()` with simulated ticks.
20. The rest of the data flow for simulation mirrors steps 12-17, with the worker processing the simulated ticks.

## 8. How to Add a New Visualization

To add a new visualization, you will need to perform the following steps:

1.  **Update the Web Worker (`dataProcessor.js`):** Modify the worker to perform any necessary calculations for the new visualization based on incoming tick data and the symbol's configuration. Add the calculated data to the state updates sent back to the `symbolStore`.
2.  **Update the Symbol Store (`symbolStore.js`):** Ensure the default configuration (`defaultConfig`) includes any new settings for your visualization and that the `initialState` for a new symbol includes placeholder properties for the new visualization's data.
3.  **Update the Visualization Component (`VizDisplay.svelte`):** Add props to receive the necessary state and configuration for the new visualization (`export let yourNewVizStateProp; export let yourNewVizConfigProp;`). Implement the drawing logic using the HTML Canvas API within the component, reacting to changes in the relevant props.
4.  **Update the Config Panel (`ConfigPanel.svelte`):** Add controls (e.g., checkboxes, sliders, dropdowns) that bind to the new configuration properties in the `config` prop. Ensure these controls trigger the `handleConfigChange` function (which updates the `symbolStore` and notifies the worker).
5.  **Update `App.svelte` (if necessary):** If the new visualization requires changes to how data is passed to `VizDisplay` in the `#each` loop, update `App.svelte` accordingly.

## 9. Performance Considerations

To maintain the application's performance, it is important to follow these best practices:

*   **Offload expensive computations to the web worker**: The web worker should be used to perform all the computationally intensive tasks, such as the volatility and market profile calculations.
*   **Minimize the number of DOM updates**: Svelte is very efficient at updating the DOM, but it is still important to minimize the number of updates.
*   **Use the HTML Canvas API for all the visualizations**: The HTML Canvas API is much more performant than SVG for rendering a large number of dynamic elements.
*   **Only re-draw the parts of the canvas that have changed**: To improve performance, you should only re-draw the parts of the canvas that have changed, rather than re-drawing the entire canvas on every frame.
