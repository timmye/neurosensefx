# NeuroSense FX - Local Development Setup (VS Code with Docker)

This guide provides instructions for setting up and running the NeuroSense FX project locally using Docker and the VS Code Remote - Containers extension. This approach ensures a consistent and reproducible development environment, regardless of your local machine's configuration.

## Prerequisites

Before you begin, make sure you have the following installed on your system:

1.  **Git:** You need Git to clone the project repository.
    *   Download from [https://git-scm.com/downloads](https://git-scm.com/downloads)
2.  **Visual Studio Code:** This is the IDE we will be using.
    *   Download from [https://code.visualstudio.com/](https://code.visualstudio.com/)
3.  **Docker Desktop:** Docker is required to build and run the development container.
    *   Download from [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
4.  **VS Code Extension: Remote - Containers:** This extension allows VS Code to connect to and work inside a Docker container.
    *   Install directly from the VS Code Extensions view or the marketplace.

## Setting up the `.devcontainer` Configuration

To enable VS Code to automatically set up your development environment using Docker, you need to add some configuration files to your project. These files tell VS Code how to build and run the Docker container for development.

1.  **Create the `.devcontainer` folder:** In the root of your project, create a new folder named `.devcontainer`. This is a standard location where VS Code looks for development container configurations.

2.  **Create `Dockerfile`:** Inside the `.devcontainer` folder, create a file named `Dockerfile` (/README_LOCAL_DEV.md#Dockerfile). This file defines the blueprint for your development container. It specifies the base operating system, installs necessary software, and sets up the environment.

    Here's the `Dockerfile` content tailored for this project:


## Step-by-Step Setup

Follow these steps to get the project running in your local VS Code environment:

1.  **Clone the Repository:**
    Open your terminal and clone the NeuroSense FX repository:

    
```
bash
    git clone <repository_url>
    
```
Replace `<repository_url>` with the actual URL of your Git repository.

2.  **Open Project in VS Code:**
    Navigate into the cloned project directory and open it with VS Code:
```
bash
    cd neurosense-fx
    code .
    
```
3.  **Reopen in Container:**
    VS Code will detect that the project is configured for development containers (this requires creating the `.devcontainer` folder and configuration files, which is covered in the next section). A notification should appear asking if you want to "Reopen in Container". Click this button.

    If you don't see the notification, open the VS Code Command Palette (Ctrl+Shift+P or Cmd+Shift+P) and select `Remote-Containers: Reopen in Container`.

4.  **Building the Development Container:**
    VS Code will now build the Docker image and start the development container based on the configuration files (which you will create in the next step). This might take a few minutes the first time as it downloads dependencies and builds the image. You can see the progress in the VS Code terminal.

5.  **Container Setup and Dependency Installation:**
    Once the container is running, VS Code will automatically execute the post-create command defined in the `.devcontainer/devcontainer.json` file. This command should ideally run the project's setup script to initialize submodules and install dependencies. Based on your project's `setup_project.sh`, the post-create command will likely be:

    
```
bash
    ./setup_project.sh
    
```
This script will:
    *   Initialize Git submodules (`ctrader_tick_backend` and `cTrader-Layer`).
    *   Install dependencies for `cTrader-Layer`.
    *   Build `cTrader-Layer`.
    *   Install dependencies for `ctrader_tick_backend`.
    *   Install dependencies for the frontend (`neurosense-fx`).

    Monitor the terminal in VS Code to ensure all steps of the `setup_project.sh` script complete successfully.

6.  **Verify Setup:**
    After the setup script finishes, you can verify that all dependencies are installed correctly within the container's terminal. Run these commands in the VS Code integrated terminal:
```
bash
    ls ctrader_tick_backend/cTrader-Layer/node_modules
    ls ctrader_tick_backend/node_modules
    ls node_modules
    
```
If the `node_modules` directories are listed for all three, the setup was successful.

7.  **Start the Development Servers:**
    Now you can start the backend and frontend development servers.

    *   **Start Backend:** Open a new terminal in VS Code (ensuring it's within the container environment) and run:
```
bash
        cd ctrader_tick_backend
        npm start
    
```
This will start the Node.js backend server, typically on port 8080 (as configured in your environment variables).

    *   **Start Frontend:** Open another new terminal in VS Code (within the container) and run:
```
bash
        npm run dev
    
```
This will start the Svelte frontend development server using Vite, typically on port 5173 (or another available port).

8.  **Access the Application:**
    Once both servers are running, you should be able to access the frontend application in your web browser. The VS Code Remote - Containers extension often automatically forwards ports, so you should be able to access the frontend at `http://localhost:5173` and the backend at `http://localhost:8080` from your host machine's browser.

## Setting up the `.devcontainer` Folder

To make the "Reopen in Container" option work, you need to create the `.devcontainer` folder and its contents in the root of your repository.

1.  **Create the folder:** In the root of your project, create a new folder named `.devcontainer`.

2.  **Create `Dockerfile`:** Inside the `.devcontainer` folder, create a file named `Dockerfile`. This file defines the container image. Here's a basic example based on your project's needs:
```
dockerfile
    # Use a base image with Node.js installed
    FROM node:20

    # Install git and other potential tools needed by your setup script
    RUN apt-get update && apt-get install -y git

    # Set the working directory
    WORKDIR /workspace

    # Copy the project files into the container
    COPY . /workspace

    # Expose ports for the backend and frontend servers
    EXPOSE 8080 5173

    # The command to run when the container starts (optional,
    # we'll use postCreateCommand in devcontainer.json instead)
    # CMD ["sleep", "infinity"]
    
```
*   **`FROM node:20`**: Starts from an official Node.js v20 image.
    *   **`RUN apt-get update && apt-get install -y git`**: Installs Git and updates package lists within the container, necessary for the submodule initialization in `setup_project.sh`. You might need to add other packages here if your setup script or project has other system dependencies.
    *   **`WORKDIR /workspace`**: Sets the working directory inside the container.
    *   **`COPY . /workspace`**: Copies all files from your project's root into the `/workspace` directory in the container.
    *   **`EXPOSE 8080 5173`**: Informs Docker that the container will listen on these ports. VS Code can use this information for port forwarding.

3.  **Create `devcontainer.json`:** Inside the `.devcontainer` folder, create a file named `devcontainer.json`. This file configures the development container for VS Code.

    
```
json
    {
      "name": "NeuroSense FX Development Container",
      "build": {
        "dockerfile": "Dockerfile"
      },
      "forwardPorts": [8080, 5173],
      "extensions": [
        "svelte.svelte-vscode",
        "dbaeumer.vscode-eslint"
        // Add any other VS Code extensions your team uses
      ],
      "postCreateCommand": "./setup_project.sh",
      "remoteUser": "node"
    }
    
```
*   **`name`**: A display name for your development container.
    *   **`build.dockerfile`**: Points to the `Dockerfile` to use for building the container image.
    *   **`forwardPorts`**: Automatically forwards these ports from the container to your local machine, allowing you to access the running applications in your browser.
    *   **`extensions`**: Specifies VS Code extensions that will be automatically installed inside the container. Include any extensions essential for development (Svelte, ESLint, etc.).
    *   **`postCreateCommand`**: This is crucial. This command runs automatically *after* the container is created and the project files are copied. We use this to run your `setup_project.sh` script.
    *   **`remoteUser`**: Sets the user inside the container that VS Code will connect as. Using `node` (which is the default user in the `node` Docker images) is common.

## Troubleshooting

*   **Port Conflicts:** If you have other applications running on ports 8080 or 5173 on your local machine, you might encounter issues. Close the conflicting applications or configure the `forwardPorts` in `devcontainer.json` to map to different local ports.
*   **Build Errors:** If the Docker image fails to build or the `setup_project.sh` script fails, check the output in the VS Code terminal for specific error messages. Ensure all necessary dependencies and tools are included in your `Dockerfile` and that the `setup_project.sh` script is executable (`chmod +x setup_project.sh`).
*   **Submodule Issues:** If you encounter issues with submodules, ensure your `.gitmodules` file is correct and that the `git submodule update --init --recursive` command ran successfully during the `postCreateCommand`.
*   **Container Not Starting:** Check the Docker Desktop application to see if the container is running. Review the container logs for errors.

*   **Submodule Detached HEAD:** If you see a Git error like "You are not currently on a branch..." when running `git submodule update --remote --merge`, it means the submodule is in a detached HEAD state.

    To fix this, navigate into the submodule directory (`cd ctrader_tick_backend/cTrader-Layer`) and checkout the desired branch (e.g., `git checkout master`). Then, navigate back to the root directory (`cd ../..`) and run `git submodule update --remote --merge` again.




By following these steps and using the provided `.devcontainer` configuration, local developers should be able to quickly and reliably set up their development environment for the NeuroSense FX project within VS Code.