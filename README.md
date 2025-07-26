# NeuroSense FX - cTrader Tick Backend and Layer Setup

This guide provides instructions for setting up the necessary backend services for NeuroSense FX, including the `ctrader_tick_backend` and the `cTrader-Layer`.

## Prerequisites

*   Node.js and npm installed.
*   Git installed.

## Setup Steps

Follow these steps to set up the backend and the cTrader Layer:

1.  **Clone the `ctrader_tick_backend` repository:**

    ```bash
    git clone https://github.com/timmye/ctrader_tick_backend /home/user/neurosensefx/ctrader_tick_backend
    ```

2.  **Clone the `cTrader-Layer` repository into the backend directory:**

    ```bash
    git clone https://github.com/timmye/cTrader-Layer /home/user/neurosensefx/ctrader_tick_backend/cTrader-Layer
    ```

3.  **Navigate to the `cTrader-Layer` directory and install dependencies:**

    ```bash
    cd /home/user/neurosensefx/ctrader_tick_backend/cTrader-Layer
    npm install
    ```

4.  **Run linting and fix issues in `cTrader-Layer`:**

    ```bash
    npm run lint -- --fix
    ```

5.  **Build the `cTrader-Layer` securely:**

    ```bash
    npm run safe-build
    ```

6.  **Navigate to the `ctrader_tick_backend` directory and install dependencies:**

    ```bash
    cd /home/user/neurosensefx/ctrader_tick_backend
    npm install
    ```

7.  **Start the backend server:**

    ```bash
    npm start
    ```

After the backend server starts successfully, you can refresh your frontend application and test the connection.

## Troubleshooting

*   If you encounter any issues during installation, try running `npm audit fix` or `npm audit fix --force` in the respective directories to resolve potential vulnerabilities.
*   Ensure you have the correct Node.js version installed as required by the projects.

---

This README provides a clear, step-by-step guide for setting up the backend components.
