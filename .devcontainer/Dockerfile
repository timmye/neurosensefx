# Use an official Node.js 20 image as a base.
# This aligns with the `pkgs.nodejs_20` specified in the .idx/dev.nix file.
FROM mcr.microsoft.com/devcontainers/javascript-node:0-20

# The dev.nix file also installs `pkgs.killall`.
# The equivalent package in Debian/Ubuntu is `psmisc`.
# This command updates the package list and installs it.
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive && apt-get -y install --no-install-recommends psmisc

# Add Python and UV for Serena MCP
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive && \
    apt-get -y install --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl

# Install UV package manager for node user
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:/home/node/.local/bin:$PATH"

# Ensure node user can access UV
RUN mkdir -p /home/node/.local/bin && \
    cp -r /root/.local/bin/* /home/node/.local/bin/ && \
    chown -R node:node /home/node/.local
