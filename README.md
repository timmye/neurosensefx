# NeuroSense FX

Welcome to NeuroSense FX, a financial data visualization tool built with a Svelte frontend and a Node.js backend that connects to the cTrader platform.

This project is configured for **Firebase Studio (IDX)** and is designed for a seamless, automated setup.

## ✨ One-Step Setup

This project is fully automated. When you open it in Firebase Studio, a setup script (`setup_project.sh`) will automatically:

1.  **Initialize Git Submodules:** Clones the `ctrader_tick_backend` and its nested `cTrader-Layer` submodule.
2.  **Install All Dependencies:** Runs `npm install` for the frontend, backend, and cTrader layer in the correct order.
3.  **Build the cTrader Layer:** Compiles the necessary TypeScript files for the backend.
4.  **Start the Backend Server:** The Node.js backend will start automatically on port 8080.
5.  **Launch the Frontend Preview:** A Vite development server for the Svelte app will launch and be available in the IDX Previews panel.

## 🏛️ Project Architecture

This repository uses a modular, submodule-based architecture to keep the frontend and backend concerns cleanly separated.

-   **`neurosensefx` (Root):** The Svelte frontend application. It uses a performant, canvas-based rendering pipeline and includes a realistic simulation engine for robust testing and development.
-   **`ctrader_tick_backend` (Submodule):** A standalone Node.js server that connects to the cTrader API, processes data, and streams ticks via WebSockets.
-   **`cTrader-Layer` (Nested Submodule):** A specific communication layer for low-level interaction with the cTrader Open API.

This structure allows for independent development and versioning of each component.

## 📚 Documentation

This project includes detailed documentation for a deeper understanding of its design and architecture.

-   **[Front-End Documentation](./docs/Front_End_Documentation.md):** The primary technical guide to the frontend, covering architecture, state management, the rendering pipeline, and component structure.
-   **[Design Intent](./specs/NeuroSense%20FX_design%20intent.txt):** The core human-centric design philosophy and foundational principles.
-   **[Build Plan](./specs/Ground-Up%20Build%20Plan%20(Performant%20&%20Simple).txt):** The original technical specifications for the application.

## 🚀 Front-End Quick Start

The front-end is a Svelte application built with Vite, featuring a modular architecture focused on performance.

-   **Rendering:** It uses the **Canvas 2D API** for all visualizations, rendered within a `requestAnimationFrame` loop for maximum performance and smooth updates.
-   **Component Structure:** Visual elements are not Svelte components themselves, but modular JavaScript drawing functions located in `src/lib/viz/`. These are orchestrated by the central `src/components/viz/Container.svelte` component.
-   **State Management:** State is managed centrally using Svelte stores and a web worker (`src/workers/dataProcessor.js`) to offload heavy computation from the UI thread.
-   **Simulation:** A realistic simulation engine in `src/data/wsClient.js` generates a continuous stream of tick data with trending behavior for development and testing.

To get started with front-end development:
1. `npm install`
2. `npm run dev`
