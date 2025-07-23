# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20 # Use Node.js version 20
  ];
  # Sets environment variables in the workspace
  env = {
    WEBSOCKET_PORT = "3003";
    # cTrader API Credentials - Loaded from user provided .env
    CTRADER_ACCOUNT_TYPE = "LIVE";
    CTRADER_CLIENT_ID = "12478_zC8lmMuDBZg1fPqKeZGWtieeqD3cfYaOWzEOKWSXYbaS5AkBw1";
    CTRADER_CLIENT_SECRET = "XwKO7QruJda6a6vswkY4CJuVJLnICPvEL6KAdbwxLcJITouvYQ";
    CTRADER_ACCESS_TOKEN = "av8FB2UqJR3YgUGMGMWL47nsExSEYEo_QUtL1UB6srg";
    CTRADER_REFRESH_TOKEN = "2ck79MQzfvobUMBZFVWOQDLOFaO9F_SIwO4MxEWbxAM";
    CTRADER_ACCOUNT_ID = "38998989";
    CTRADER_HOST_TYPE = "LIVE";
    CTRADER_SYMBOL_IDS = "1,2,3"; # Assuming this should be a string
    HOST = "live.ctraderapi.com";
    PORT = "5035";
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
        web = {
          # Command to start the web server for frontend preview (Vite)
          command = ["./node_modules/.bin/vite" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web";
        };
        backend = {
          # Command to start the web server for backend preview
          # Directly call node on server.js
          command = ["node" "ctrader_tick_backend/web/server.js" "--port" "$PORT"];
          manager = "web";
        };
      };
    };
    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        npm-install = ''
          npm cache clean --force
          npm install
        '';
        # Install dependencies for the cloned backend repository
        backend-npm-install = ''
          cd ctrader_tick_backend && npm install
          cd ctrader_tick_backend/web && npm install
        '';
        default.openFiles = [
          ".idx/dev.nix"
          "package.json"
          "README.md"
        ];
      };
      onStart = {
      };
    };
  };
}