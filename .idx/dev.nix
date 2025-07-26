# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20 # Use Node.js version 20
    pkgs.killall # Add the killall package to use pkill
  ];
  # Sets environment variables in the workspace
  env = {
    WEBSOCKET_PORT = "8080";
    # cTrader API Credentials are loaded from ctrader_tick_backend/.env
    # The .env file is used for local development and is not committed to git.
    # In a real production environment, these would be managed securely.
  };
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      "svelte.svelte-vscode" # Svelte language support
      "dbaeumer.vscode-eslint" # ESLint for code linting
    ];
    # Enable previews
    previews = {
      enable = true;
      previews = {
        # The 'web' preview is for the Svelte frontend, served by Vite.
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web";
        };
        # The backend preview has been removed to prevent port conflicts.
      };
    };
    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        # Install all npm dependencies
        npm-installs = ''
          set -e
          echo "Installing root dependencies..."
          npm install
          echo "Installing backend dependencies..."
          cd ctrader_tick_backend && npm install
          echo "Installing and building cTrader-Layer..."
          cd ctrader_tick_backend/cTrader-Layer && npm install && npm run build
        '';
        default.openFiles = [
          ".idx/dev.nix"
          "README.md"
        ];
      };
      # Runs every time the workspace is (re)started
      onStart = {
        # Ensure no other node processes are running on the port
        kill-process = "pkill -f 'node ctrader_tick_backend/server.js' || true";
        # Temporarily commented out to prevent port conflict when running manually.
        # backend-start = "cd ctrader_tick_backend && npm start"
      };
    };
  };
}
