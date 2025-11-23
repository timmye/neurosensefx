/**
 * Global setup for Playwright tests
 * Ensures the application is running before tests start
 */

async function globalSetup(config) {
  console.log('🚀 Setting up Playwright test environment...');

  // Check if application is running on expected port
  const baseURL = config.webServer?.url || 'http://localhost:5174';

  try {
    const response = await fetch(`${baseURL}`);
    if (!response.ok) {
      console.warn(`⚠️ Application not responding at ${baseURL}, attempting to start...`);

      // Try to start the development server if not running
      if (process.env.NODE_ENV !== 'production') {
        const { spawn } = await import('child_process');
        const devServer = spawn('npm', ['run', 'dev'], {
          stdio: 'inherit',
          shell: true,
          detached: false
        });

        // Wait for server to start
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Development server failed to start within 30 seconds'));
          }, 30000);

          let attempts = 0;
          const maxAttempts = 30;

          const checkServer = async () => {
            try {
              const response = await fetch(baseURL);
              if (response.ok) {
                clearTimeout(timeout);
                console.log(`✅ Development server ready at ${baseURL}`);
                resolve();
              } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkServer, 1000);
              } else {
                reject(new Error('Development server failed to respond'));
              }
            } catch (error) {
              if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkServer, 1000);
              } else {
                reject(error);
              }
            }
          };

          setTimeout(checkServer, 2000);
        });
      }
    } else {
      console.log(`✅ Application is running at ${baseURL}`);
    }
  } catch (error) {
    console.warn(`⚠️ Could not verify application status: ${error.message}`);
    console.log('ℹ️ Tests will proceed assuming the application is available');
  }

  // Set up test environment variables
  process.env.TEST_BASE_URL = baseURL;
  process.env.TEST_TIMEOUT = '30000';
  process.env.TEST_CONTAINER_MODE = 'true';

  console.log('✅ Playwright global setup complete');
}

export default globalSetup;