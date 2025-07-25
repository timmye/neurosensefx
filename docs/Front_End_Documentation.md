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

The application's state is managed using a combination of Svelte stores and web workers.

*   **`symbolStore.js`**: This store is the single source of truth for all symbol-related data. It is a writable Svelte store that contains a collection of symbol objects, each with its own `vizState` and `vizConfig`.
*   **`dataProcessor.js`**: This web worker is responsible for processing all the incoming tick data. It receives ticks from the `wsClient.js`, performs all the necessary calculations, and then sends the updated state to the `symbolStore`.

## 5. Component Reference

The front end is composed of the following key components:

*   **`App.svelte`**: This is the main application component. It is responsible for rendering the `VizDisplay` and `ConfigPanel` components.
*   **`VizDisplay.svelte`**: This component is responsible for rendering the visualizations. It receives the `vizState` and `vizConfig` from the `symbolStore` and then uses the HTML Canvas API to render the visualizations.
*   **`ConfigPanel.svelte`**: This component allows the user to configure the application's settings. It is responsible for updating the `vizConfig` in the `symbolStore`.

## 6. Data Flow

The data flows through the application in the following order:

1.  The `wsClient.js` receives a tick from the WebSocket server.
2.  The `wsClient.js` dispatches the tick to the `symbolStore`.
3.  The `symbolStore` forwards the tick to the appropriate `dataProcessor.js` worker.
4.  The `dataProcessor.js` worker processes the tick and then sends the updated state to the `symbolStore`.
5.  The `symbolStore` updates its state, which in turn triggers a re-render of the `VizDisplay` and `ConfigPanel` components.

## 7. How to Add a New Visualization

To add a new visualization, you will need to perform the following steps:

1.  Add a new drawing function to the `VizDisplay.svelte` component. This function should take the `vizState` and `vizConfig` as input and then use the HTML Canvas API to render the visualization.
2.  Add a new configuration option to the `vizConfig` store. This will allow the user to enable or disable the new visualization from the `ConfigPanel` component.
3.  Add a new control to the `ConfigPanel.svelte` component to allow the user to configure the new visualization.

## 8. Performance Considerations

To maintain the application's performance, it is important to follow these best practices:

*   **Offload expensive computations to the web worker**: The web worker should be used to perform all the computationally intensive tasks, such as the volatility and market profile calculations.
*   **Minimize the number of DOM updates**: Svelte is very efficient at updating the DOM, but it is still important to minimize the number of updates.
*   **Use the HTML Canvas API for all the visualizations**: The HTML Canvas API is much more performant than SVG for rendering a large number of dynamic elements.
*   **Only re-draw the parts of the canvas that have changed**: To improve performance, you should only re-draw the parts of the canvas that have changed, rather than re-drawing the entire canvas on every frame.
