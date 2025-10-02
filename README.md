# NeuroSense FX

Welcome to NeuroSense FX, a financial data visualization tool built with a Svelte frontend and a Node.js backend that connects to the cTrader platform.

This project is configured for **Firebase Studio (IDX)** and is designed for a seamless, automated setup.

## ✨ One-Step Setup

This project is fully automated. When you open it in Firebase Studio, a setup script (`setup_project.sh`) will automatically:

1.  **Initialize Dependencies:** Sets up the monorepo structure with `libs/cTrader-Layer` and `services/tick-backend`.
2.  **Install All Dependencies:** Runs `npm install` for the frontend, backend, and cTrader layer in the correct order.
3.  **Build the cTrader Layer:** Compiles the necessary TypeScript files for the backend.
4.  **Start the Backend Server:** The Node.js backend will start automatically on port 8080.
5.  **Launch the Frontend Preview:** A Vite development server for the Svelte app will launch and be available in the IDX Previews panel.

## 🏛️ Project Architecture

This repository uses a monorepo architecture to keep concerns separated while maintaining tight integration:

-   **`neurosensefx` (Root):** The Svelte frontend application. It uses a performant, canvas-based rendering pipeline and includes a realistic simulation engine for robust testing and development.
-   **`services/tick-backend`:** The Node.js backend service that connects to the cTrader API, processes data, and streams ticks via WebSockets.
-   **`libs/cTrader-Layer`:** A shared library providing low-level interaction with the cTrader Open API.

This structure allows for coordinated development while maintaining clear separation of concerns.

## 📚 Documentation

This project includes detailed documentation for a deeper understanding of its design and architecture.

-   **[Front-End Documentation](./docs/Front_End_Documentation.md):** The primary technical guide to the frontend, covering architecture, state management, the rendering pipeline, and component structure.
-   **[Design Intent](./specs/NeuroSense%20FX_design%20intent.txt):** The core human-centric design philosophy and foundational principles.
-   **[Build Plan](./specs/Ground-Up%20Build%20Plan%20(Performant%20&%20Simple).txt):** The original technical specifications for the application.
-   **[Local Development Guide](./README_LOCAL_DEV.md):** Comprehensive guide for setting up and running the project locally with troubleshooting tips.

## 🚀 Front-End Quick Start

The front-end is a Svelte application built with Vite, featuring a modular architecture focused on performance.

-   **Rendering:** It uses the **Canvas 2D API** for all visualizations, rendered within a `requestAnimationFrame` loop for maximum performance and smooth updates.
-   **Component Structure:** Visual elements are not Svelte components themselves, but modular JavaScript drawing functions located in `src/lib/viz/`. These are orchestrated by the central `src/components/viz/Container.svelte` component.
-   **State Management:** State is managed centrally using Svelte stores and a web worker (`src/workers/dataProcessor.js`) to offload heavy computation from the UI thread.
-   **Simulation:** A realistic simulation engine in `src/data/wsClient.js` generates a continuous stream of tick data with trending behavior for development and testing.

To get started:
1. `./setup.sh` (or `./setup.sh --clean` for fresh install)
2. `npm start` (or `./run.sh start`)
3. Access app at http://localhost:5173

## 🛠️ Command Reference

This project provides a comprehensive set of commands for setup, development, and maintenance. All commands should be executed from the project root directory.

### 🧰 Project Setup
- [`./setup_project.sh`](setup_project.sh) - Configures the development environment
  - Standard setup: `./setup_project.sh`
  - Clean setup (removes existing dependencies first): `./setup_project.sh --clean`

### ⚙️ Service Management
- [`./run.sh`](run.sh) - Unified service management (primary interface)
  - Start all services: `./run.sh start`
  - Stop all services: `./run.sh stop`
  - Check service status: `./run.sh status`
  - View real-time logs: `./run.sh logs`

### 📦 npm Scripts
- `npm start` - Alias for `./run.sh start`
- `npm run dev` - Start development server directly
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run lint` - Run code linter

### 🖥️ Local Development
- [`./startup_local_dev.sh`](startup_local_dev.sh) - Alternative script for starting local development environment
- [`./run_neurosense.sh`](run_neurosense.sh) - Launch the NeuroSense application

> **Note**: The `cleanup_dev_env.sh` script mentioned in some documentation has been consolidated into `setup_project.sh --clean` and is no longer a separate file. Use `./setup_project.sh --clean` for a complete environment reset.

For detailed instructions on local development, please see [Local Development Guide](./README_LOCAL_DEV.md).
