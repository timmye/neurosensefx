# Front-End Documentation for NeuroSense FX

## 1. Overview

This document provides a comprehensive overview of the front-end architecture for the NeuroSense FX application. The primary goal of this project is to develop a highly performant, web-based display system that can render up to 20 independent, real-time price feed visualizations in a single browser tab.

The front end is built with Svelte and Vite, and it leverages web workers to offload computationally intensive tasks to a background thread. This ensures that the main UI thread remains responsive, even when rendering a large number of visualizations.

### Core Technologies

*   **Front-end Framework**: Svelte
*   **Bundler**: Vite
*   **Data Processing**: Web Workers
*   **Real-time Data**: WebSockets
*   **Rendering**: SVG (via D3.js)

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
        *   **`viz`**: This directory contains the individual visualization components.
    *   **`data`**: This directory contains the WebSocket client and the `symbolStore`.
    *   **`lib`**: This directory contains shared utilities, such as D3 helper functions.
    *   **`stores`**: This directory contains the Svelte stores.
    *   **`workers`**: This directory contains the web worker that is responsible for processing the tick data.
*   **`public`**: This directory contains all the static assets, such as the `index.html` file.

## 4. State Management

The application's state is managed using a combination of Svelte stores and the WebSocket client.

*   **`wsClient.js`**: This module is responsible for managing the WebSocket connection to the backend. It exposes several Svelte writable stores that represent the connection status, available symbols from the live data feed, and active subscriptions.
*   **`symbolStore.js`**: This store is the single source of truth for all symbol-related data and configuration. It is a writable Svelte store that contains a collection of symbol objects, keyed by symbol name.
*   **`configStore.js`**: This store holds the configuration for the visualizations.
*   **`symbolStateStore.js`**: This store holds the dynamic state for each symbol, which is updated by the web worker.
*   **`uiState.js`**: This store holds UI-related state, such as the currently selected symbol.
*   **`dataProcessor.js`**: This web worker is responsible for processing all the incoming tick data for a single symbol.

## 5. Component Reference

The front end is composed of the following key components:

*   **`App.svelte`**: This is the main application component. It is responsible for managing the overall application flow and rendering the `Container` and `ConfigPanel` components.
*   **`ConfigPanel.svelte`**: This component allows the user to configure the application's settings and control the data source.
*   **`viz/Container.svelte`**: This component is the main container for the visualizations for a single symbol. It orchestrates the rendering of the individual visualization components.
*   **`viz/DayRangeMeter.svelte`**: Renders the ADR (Average Daily Range) meter.
*   **`viz/PriceFloat.svelte`**: Renders the current price line.
*   **`viz/PriceDisplay.svelte`**: Renders the numeric price display.
*   **`viz/VolatilityOrb.svelte`**: Renders the volatility orb.
*   **`viz/MarketProfile.svelte`**: Renders the market profile.
*   **`viz/Flash.svelte`**: Handles the "flash" effect on significant ticks.

## 6. How to Add a New Visualization

To add a new visualization, you will need to perform the following steps:

1.  **Update the Web Worker (`dataProcessor.js`):** Modify the worker to perform any necessary calculations for the new visualization.
2.  **Update the Stores:** Update the relevant stores (`configStore.js`, `symbolStateStore.js`) to include any new state or configuration for your visualization.
3.  **Create a New Visualization Component:** Create a new Svelte component in the `src/components/viz/` directory.
4.  **Update the Container Component:** Add the new component to `src/components/viz/Container.svelte`.
5.  **Update the Config Panel (`ConfigPanel.svelte`):** Add controls for the new visualization's configuration.

## 7. Performance Considerations

To maintain the application's performance, it is important to follow these best practices:

*   **Offload expensive computations to the web worker**: The web worker should be used to perform all the computationally intensive tasks.
*   **Minimize the number of DOM updates**: Svelte is very efficient at updating the DOM, but it is still important to minimize the number of updates.
*   **Use SVG for visualizations**: SVG is used for rendering the visualizations, as it provides a good balance between performance and ease of use for this application.
