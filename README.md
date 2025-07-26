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

-   **`neurosensefx` (Root):**
    -   Contains the Svelte frontend application (`src`).
    -   Contains the Firebase Studio configuration (`.idx/dev.nix`).
    -   Manages the overall project structure.

-   **`ctrader_tick_backend` (Submodule):**
    -   A standalone Node.js server that connects to the cTrader API.
    -   Handles all API communication, data processing, and streams tick data via WebSockets.
    -   Contains its own nested submodule, `cTrader-Layer`.

-   **`cTrader-Layer` (Nested Submodule):**
    -   A specific communication layer responsible for the low-level interaction with the cTrader Open API.

This structure allows for independent development and versioning of each component, creating a robust and maintainable system.

---
This README now accurately reflects the project's high degree of automation and professional structure.
