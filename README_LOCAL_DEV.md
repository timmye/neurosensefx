# Local Development Guide for NeuroSense FX

This guide outlines how to set up and run the NeuroSense FX project on your local machine using VS Code and Docker. The environment is configured to be a direct mirror of the Firebase Studio cloud environment, ensuring consistency and reproducibility.

## Prerequisites

- **VS Code:** You must have Visual Studio Code installed.
- **Docker:** You must have Docker Desktop installed and running.
- **VS Code Dev Containers Extension:** You must install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) from the VS Code Marketplace.

## 1. Initial Setup

1.  **Clone the Repository:**
    ```bash
    git clone [your-repository-url]
    cd neurosensefx
    ```

2.  **Create Your Environment File:**
    - The project uses a single `.env` file in the project root for all secrets and API keys.
    - Copy the example file to create your own local configuration:
    ```bash
    cp .env.example .env
    ```
    - **Crucially, you must now open the `.env` file and replace the placeholder values with your actual cTrader API credentials.**

## 2. Launching the Dev Container

The project is configured to run inside a standardized VS Code Development Container. This ensures that you have the exact same tools and dependencies as the cloud environment.

1.  **Open the Project in VS Code:**
    ```bash
    code .
    ```

2.  **Reopen in Container:**
    - After opening the project, VS Code will detect the `.devcontainer` configuration.
    - A pop-up will appear saying: *"Folder contains a Dev Container configuration file. Reopen folder to develop in a container."*
    - Click the **"Reopen in Container"** button.

3.  **Wait for the Build:**
    - The first time you do this, Docker will build the development image. This may take a few minutes. Subsequent launches will be much faster.
    - VS Code will start a new window connected to the containerized environment.

## 3. Running the Application (Automatic)

**Everything is now fully automatic and perfectly mirrors the cloud environment.**

The `postStartCommand` in the `devcontainer.json` configuration executes the `./run.sh start` command. This command automatically:
1.  **Cleans up** any old server processes.
2.  **Updates** the submodules to the latest version.
3.  **Starts the backend server** in the background.
4.  **Starts the frontend server** in the foreground.

A port will be forwarded, and you can access the application in your browser at the URL provided in the VS Code "Ports" tab (usually `http://localhost:5173` for the frontend and `http://localhost:8080` for the backend WebSocket).

## 4. Development Workflow

- You can now edit files in VS Code as you normally would. The Vite server will automatically hot-reload the frontend on any changes.
- To see the live output from the backend server, you can view its log file in a separate terminal:
  ```bash
  tail -f backend.log
  ```
- To stop the application, use `Ctrl+C` in the primary terminal. This will stop both the startup script and the frontend server.

## 5. Troubleshooting Common Issues

### Node Modules Issues
If you encounter issues with dependencies:
1. Run `./setup_project.sh` to clean and reinstall all dependencies
2. Check that all submodules are properly initialized

### Vite Server Issues
If the frontend server fails to start:
1. Ensure all dependencies are installed (`npm install`)
2. Check that the `node_modules/.bin/vite` file exists
3. Try running `./run.sh start` directly

### Backend Connection Issues
If the frontend cannot connect to the backend:
1. Check that the backend is running (`tail -f backend.log`)
2. Verify your `.env` file contains correct cTrader API credentials
3. Ensure the backend WebSocket server is listening on port 8080
### Debugging and Logging

The system now includes enhanced debugging capabilities:

1. **Backend Debugging:**
   - The backend server includes detailed DEBUG logging that traces the cTrader connection process
   - Logs are written to `backend.log` and can be monitored with `tail -f backend.log`
   - When cTrader connection fails, the backend will continue running in degraded mode and log detailed error information

2. **Frontend Debugging:**
   - The frontend Vite server logs startup information to `frontend.log`
   - Check this file if the frontend fails to start or is not accessible

3. **Service Health Checks:**
   - Use `./run.sh status` to check if services are running and listening on their expected ports
   - Use `./run.sh logs` to view live logs from both services

### Submodule Issues
If submodules are not updating correctly:
1. Run `git submodule update --init --recursive`
2. Check that both `services/tick-backend` and `libs/cTrader-Layer` directories exist

## 6. Clean Installation

To perform a completely clean installation:

```bash
./setup.sh --clean
```

This will:
1. Stop any running services
2. Remove all node_modules and package-lock.json files
3. Clean log files
4. Reinstall all dependencies

This approach ensures a completely fresh environment with all dependencies properly installed.
