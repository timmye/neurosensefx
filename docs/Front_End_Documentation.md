# Front-End Documentation for NeuroSense FX

## 1. Overview

This document provides a comprehensive overview of the front-end architecture for the NeuroSense FX application. The primary goal of this project is to develop a highly performant, web-based display system that can render up to 20 independent, real-time price feed visualizations in a single browser tab.

The front end is built with Svelte and Vite, and it leverages web workers to offload computationally intensive tasks to a background thread. This ensures that the main UI thread remains responsive, even when rendering a large number of visualizations.

### Core Technologies

*   **Front-end Framework**: Svelte
*   **Bundler**: Vite
*   **Data Processing**: Web Workers
*   **Real-time Data**: WebSockets
*   **Rendering**: **Canvas 2D API**

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
    *   **`lib`**: This directory contains the canvas drawing modules for each visualization.
    *   **`stores`**: This directory contains the Svelte stores.
    *   **`workers`**: This directory contains the web worker that is responsible for processing the tick data.
*   **`public`**: This directory contains all the static assets, such as the `index.html` file.

## 4. State Management

The application's state is managed using a combination of Svelte stores and the WebSocket client.

*   **`wsClient.js`**: This module is responsible for managing the WebSocket connection to the backend and for generating simulated data.
    *   For **Live Data**, it connects to a WebSocket and dispatches incoming tick messages to the `symbolStore`.
    *   For **Simulated Data**, it uses a `setInterval` loop to generate a continuous stream of ticks. The simulation engine incorporates a "sustained move" logic to create more realistic market trends, rather than a simple random walk. This provides a robust test environment for the visualization components.

*   **`symbolStore.js`**: This store is the single source of truth for all symbol-related data and configuration. It manages the lifecycle of `dataProcessor` workers and dispatches ticks to the appropriate worker for processing.

*   **`dataProcessor.js`**: This web worker is responsible for processing all the incoming tick data for a single symbol. It calculates volatility, market profile, and other key metrics, then sends the updated state back to the `symbolStore`.

*   **`stores/`**: The stores directory contains the individual Svelte stores for managing UI state (`uiState.js`) and visualization configuration (`configStore.js`).

## 5. Component Reference

The front end is composed of the following key components:

*   **`App.svelte`**: The main application component, responsible for the overall layout and orchestrating the `Container` and `ConfigPanel` components.
*   **`ConfigPanel.svelte`**: The UI for controlling the data source and tuning the visual parameters for each symbol.
*   **`viz/Container.svelte`**: A critical component that hosts the `<canvas>` element for a single symbol. It runs a `requestAnimationFrame` loop to efficiently render the visualization by calling drawing functions from the `lib/viz/` directory.

## 6. How to Add a New Visualization

To add a new visualization, you will need to perform the following steps:

1.  **Update the Web Worker (`dataProcessor.js`):** Add any new calculations required for your visualization.
2.  **Update `schema.js`:** Add any new properties to the `VisualizationStateSchema` or `VisualizationConfigSchema`.
3.  **Create a Drawing Module:** Create a new file in `src/lib/viz/` that exports a `draw(ctx, config, state, ...)` function.
4.  **Update the Container:** Import and call your new drawing function within the `render()` loop in `src/components/viz/Container.svelte`.
5.  **Update the Config Panel (`ConfigPanel.svelte`):** Add the necessary controls to manage the new visualization's configuration.

## 7. Performance Considerations

To maintain the application's performance, it is important to follow these best practices:

*   **Offload expensive computations to the web worker**: This is the most critical performance feature, preventing the UI thread from blocking.
*   **Use the Canvas 2D API for all visualizations**: The Canvas API is highly performant for rendering a large number of dynamic shapes, as it avoids DOM manipulation overhead.
*   **Use `requestAnimationFrame` for the render loop**: This ensures that drawing is synchronized with the browser's refresh rate, leading to smooth animations.
