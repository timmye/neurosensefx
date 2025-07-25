# NeuroSense FX - Firebase Studio Environment Setup

Welcome to the NeuroSense FX project! This project is configured to run within a Firebase Studio environment using Nix to provide a reproducible and consistent development setup.

This README guides you through initializing a fresh Firebase Studio environment for this project.

## 1. Project Overview

NeuroSense FX is a real-time financial data visualization application. It consists of a Svelte frontend and a Node.js backend that connects to the cTrader Open API to stream tick data.

The development environment is defined declaratively using a `.idx/dev.nix` file.

Step 0: clone https://github.com/timmye/neurosensefx
then 
https://github.com/timmye/ctrader_tick_backend 
to
/home/user/neurosensefx/ctrader_tick_backend
then 
https://github.com/timmye/cTrader-Layer
into 
/home/user/neurosensefx/ctrader_tick_backend/cTrader-Layer
Then 
cd ctrader_tick_backend/cTrader-Layer && npm run lint -- --fix
then
cd ctrader_tick_backend/cTrader-Layer && npm run safe-build
then
Navigate to the backend directory: cd ctrader_tick_backend
Manually start the backend: npm start

Serve should start, then refresh front end and test

## 2. Initializing the Environment

Firebase Studio automatically handles the environment setup based on the `.idx/dev.nix` file. To initialize a fresh environment:

1.  **Open the project in Firebase Studio.**

Firebase Studio will detect the `.idx/dev.nix` file and start building the development environment. This process involves:

*   Installing the specified Nix packages (like Node.js).
*   Setting environment variables defined in `.idx/dev.nix`.
*   Installing VS Code extensions listed in `.idx/dev.nix`.
*   Running the `onCreate` lifecycle hook (installs npm dependencies for frontend, backend, and the `cTrader-Layer`).
*   Running the `onStart` lifecycle hook (starts the backend server in the background).

Allow Firebase Studio some time to complete the setup. You can monitor the process in the terminal panels.

## 3. Running the Application

Once the environment is initialized and started by Firebase Studio:

*   The backend WebSocket server will automatically start in the background via the `onStart` hook.
*   The frontend development server (Vite) will start, and a web preview will become available.

Open the web preview to interact with the application. The frontend will automatically attempt to connect to the backend WebSocket server.

## 4. Key Files and Configuration

*   **`.idx/dev.nix`**: Defines the core development environment (packages, environment variables, VS Code extensions, lifecycle hooks, previews).
*   **`ctrader_tick_backend/.env`**: Contains sensitive cTrader API credentials. **This file is ignored by Git and must be populated locally by each developer.** Ensure you add your cTrader API credentials here based on your access.
*   **`package.json` (root)**: Frontend dependencies and scripts.
*   **`ctrader_tick_backend/package.json`**: Backend dependencies and scripts.
*   **`vite.config.js`**: Frontend Vite configuration, including the proxy setup for the WebSocket connection to the backend.

## 5. Debugging the Backend

If you need to debug the backend:

1.  Open a terminal in Firebase Studio.
2.  Navigate to the backend directory: `cd ctrader_tick_backend`
3.  Manually start the backend: `npm start`

*Note: The `onStart` hook in `.idx/dev.nix` is configured to start the backend automatically. If you run `npm start` manually, you might see an `EADDRINUSE` error if the automatically started process is still running. You may need to identify and stop the background process or temporarily comment out the `backend-start` command in `.idx/dev.nix` for manual debugging.*

## 6. Troubleshooting

*   **Backend Connection Issues:** Check the backend terminal for errors related to cTrader API connection or authentication. Verify your credentials in `ctrader_tick_backend/.env`.
*   **Frontend Not Loading:** Check the frontend terminal for Vite compilation errors or runtime errors in the browser console.
*   **Port Conflicts:** Ensure only one process is trying to bind to the backend WebSocket port (default 8080). Temporarily disable the `onStart` backend command if debugging manually.

---

This README provides the basic steps to get the environment up and running. For more detailed information on the frontend or backend architecture and API, please refer to the respective documentation files in the `docs/` and `ctrader_tick_backend/docs/` directories.
