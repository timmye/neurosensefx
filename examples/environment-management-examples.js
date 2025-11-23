// Environment-aware development system examples
// Demonstrates port management, browser integration, and environment isolation

example_basicDevelopmentWorkflow:
    // Start development with HMR and auto-browser
    console.log("Starting development environment...");

    // This runs: ./run.sh dev
    // - Frontend: http://localhost:5174 (with HMR)
    // - Backend:  ws://localhost:8080
    // - Browser opens automatically with development config

    // Expected output:
    // "🌍 Development Environment:"
    // "   Frontend: http://localhost:5174"
    // "   Backend:  ws://localhost:8080"

example_productionDeployment:
    // Start production services with optimization
    console.log("Starting production environment...");

    // This runs: ./run.sh start
    // - Frontend: http://localhost:4173 (optimized build)
    // - Backend:  ws://localhost:8081
    // - No auto-browser (manual opening for production)

    // Expected output:
    // "🌍 Production Environment:"
    // "   Frontend: http://localhost:4173"
    // "   Backend:  ws://localhost:8081"

example_portIsolation:
    // Demonstrate environment port isolation
    const devConfig = {
        frontend: 5174,
        backend: 8080,
        hmr: true,
        logging: "verbose"
    };

    const prodConfig = {
        frontend: 4173,
        backend: 8081,
        hmr: false,
        logging: "minimal"
    };

    // Prevents conflicts between dev and prod environments
    // Allows simultaneous running of both environments if needed

    console.log("Development ports:", devConfig);
    console.log("Production ports:", prodConfig);

example_browserIntegration:
    // Environment-specific browser configuration
    function openBrowserForEnvironment(env) {
        const urls = {
            dev: "http://localhost:5174?env=dev&hmr=true",
            prod: "http://localhost:4173?env=prod"
        };

        return urls[env] || urls.dev;
    }

    // Auto-detects environment and opens appropriate URL
    const browserUrl = openBrowserForEnvironment(process.env.NODE_ENV || 'development');
    console.log("Browser URL:", browserUrl);

example_serviceStatus:
    // Environment-aware service status checking
    function checkEnvironmentStatus() {
        // This runs: ./run.sh env-status
        return {
            environment: process.env.NODE_ENV || "development",
            services: {
                frontend: "RUNNING" | "STOPPED" | "BUILDING",
                backend: "RUNNING" | "STOPPED"
            },
            ports: {
                frontend: process.env.NODE_ENV === "production" ? 4173 : 5174,
                backend: process.env.NODE_ENV === "production" ? 8081 : 8080
            }
        };
    }