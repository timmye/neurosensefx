# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20 # Use Node.js version 20
    pkgs.killall # Add the killall package to use pkill for process management
  ];

  # Sets environment variables in the workspace
  env = {
    WEBSOCKET_PORT = "8080";
  };

  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      "svelte.svelte-vscode" # Svelte language support
      "dbaeumer.vscode-eslint" # ESLint for code linting
    ];

    # Enable previews for the frontend application
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web";
        };
      };
    };

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created.
      # We now use a single script to handle all setup steps for reliability.
      onCreate = {
        setup = "./setup_project.sh";
      };

      # Runs every time the workspace is (re)started
      onStart = {
        # Ensure any lingering backend process from a previous session is stopped
        "10-kill-backend" = "pkill -f 'node ctrader_tick_backend/server.js' || true";
        
        # Start the backend server and log its output for debugging.
        "20-backend-start" = "cd ctrader_tick_backend && npm start > ../backend.log 2>&1 &";
      };
    };
  };
}
