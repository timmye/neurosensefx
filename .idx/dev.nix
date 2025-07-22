{ pkgs, ... }: {
  # Define packages to install
  packages = [
    pkgs.nodejs_20 # Install Node.js version 20, includes npm
  ];

  # Configure development environment variables
  env = {
    # Example environment variable
    # API_KEY = "your-secret-key";
  };

  # Configure Firebase Studio specific settings
  idx = {
    # Configure VS Code extensions to install
    extensions = [
      "dbaeumer.vscode-eslint" # Install ESLint extension
    ];

    # Enable previews
    previews = {
      enable = true;
      previews = {
        web = {
          # Command to start the web server for preview
          # Ensure node_modules/.bin is in PATH before running the dev script
          command = [
            "bash"
            "-c"
            ''
              export PATH=$PWD/node_modules/.bin:$PATH
              npm run dev -- --port $PORT --host 0.0.0.0
            ''
          ];
          manager = "web"; # Specify the preview manager as web
        };
      };
    };

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        # Install npm dependencies
        npm-install = "npm install";
        # Open these files when the workspace is created
        default.openFiles = [
          ".idx/dev.nix"
          "package.json"
          "README.md"
        ];
      };
      onStart = {
        # start the development server
        dev-server = ''bash -c "export PATH=$PWD/node_modules/.bin:$PATH && npm run dev"'';

      };
    };
  };
}