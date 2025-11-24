#!/usr/bin/env node

/**
 * Environment-Aware Configuration System
 * Handles cross-platform path resolution and environment-specific settings
 * Optimized for WSL2, Docker, and native filesystem performance
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

// Environment detection
const ENVIRONMENTS = {
    WINDOWS_NATIVE: 'windows-native',
    WSL2_NATIVE: 'wsl2-native',
    WSL2_MOUNTED: 'wsl2-mounted',
    DOCKER: 'docker',
    MACOS: 'macos',
    LINUX_NATIVE: 'linux-native',
    CI: 'ci'
};

class EnvironmentDetector {
    static detect() {
        // Check CI environment first
        if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI) {
            return ENVIRONMENTS.CI;
        }

        // Check Docker environment
        if (process.env.DOCKER_CONTAINER || existsSync('/.dockerenv')) {
            return ENVIRONMENTS.DOCKER;
        }

        // Check WSL2 environment
        if (existsSync('/proc/version')) {
            const procVersion = readFileSync('/proc/version', 'utf8').toLowerCase();
            if (procVersion.includes('microsoft') || procVersion.includes('wsl')) {
                // Check if we're on mounted Windows filesystem or native WSL2
                const cwd = process.cwd();
                if (cwd.startsWith('/mnt/')) {
                    return ENVIRONMENTS.WSL2_MOUNTED;
                } else {
                    return ENVIRONMENTS.WSL2_NATIVE;
                }
            }
        }

        // Check macOS
        if (process.platform === 'darwin') {
            return ENVIRONMENTS.MACOS;
        }

        // Check Windows native (non-WSL)
        if (process.platform === 'win32') {
            return ENVIRONMENTS.WINDOWS_NATIVE;
        }

        // Default to Linux native
        return ENVIRONMENTS.LINUX_NATIVE;
    }

    static isWSL2() {
        const env = this.detect();
        return env === ENVIRONMENTS.WSL2_NATIVE || env === ENVIRONMENTS.WSL2_MOUNTED;
    }

    static isDocker() {
        return this.detect() === ENVIRONMENTS.DOCKER;
    }

    static isWindows() {
        const env = this.detect();
        return env === ENVIRONMENTS.WINDOWS_NATIVE || env === ENVIRONMENTS.WSL2_MOUNTED;
    }
}

class PathResolver {
    constructor() {
        this.environment = EnvironmentDetector.detect();
        this.projectRoot = this.getProjectRoot();
        this.cache = new Map();
    }

    getProjectRoot() {
        // Use process.cwd() for current working directory
        // but handle Docker volume mounting scenarios
        if (this.environment === ENVIRONMENTS.DOCKER) {
            // In Docker, the app is typically in /app
            if (existsSync('/app')) {
                return '/app';
            }
        }

        return process.cwd();
    }

    resolvePath(...segments) {
        const cacheKey = `${this.environment}:${segments.join(':')}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        let resolvedPath;

        switch (this.environment) {
            case ENVIRONMENTS.WSL2_MOUNTED:
                resolvedPath = this.resolveWSL2MountedPath(...segments);
                break;

            case ENVIRONMENTS.WSL2_NATIVE:
                resolvedPath = this.resolveWSL2NativePath(...segments);
                break;

            case ENVIRONMENTS.DOCKER:
                resolvedPath = this.resolveDockerPath(...segments);
                break;

            case ENVIRONMENTS.WINDOWS_NATIVE:
                resolvedPath = this.resolveWindowsPath(...segments);
                break;

            default:
                resolvedPath = this.resolveNativePath(...segments);
                break;
        }

        this.cache.set(cacheKey, resolvedPath);
        return resolvedPath;
    }

    resolveWSL2MountedPath(...segments) {
        // For WSL2 mounted filesystem, we want to prefer native paths
        const firstSegment = segments[0];

        // If it's already an absolute path, just normalize it
        if (isAbsolute(firstSegment)) {
            return join(...segments);
        }

        // Check if this should be redirected to native filesystem
        if (this.shouldRedirectToNative(firstSegment)) {
            const nativeRoot = this.getNativeWSL2Root();
            return join(nativeRoot, ...segments);
        }

        // Default to current project location
        return join(this.projectRoot, ...segments);
    }

    resolveWSL2NativePath(...segments) {
        // Native WSL2 filesystem paths are straightforward
        const firstSegment = segments[0];
        if (isAbsolute(firstSegment)) {
            return join(...segments);
        }
        return join(this.projectRoot, ...segments);
    }

    resolveDockerPath(...segments) {
        // In Docker, paths should be resolved relative to the container filesystem
        const firstSegment = segments[0];
        if (isAbsolute(firstSegment)) {
            return join(...segments);
        }
        return join(this.projectRoot, ...segments);
    }

    resolveWindowsPath(...segments) {
        // Windows native path resolution
        const firstSegment = segments[0];
        if (isAbsolute(firstSegment)) {
            return join(...segments);
        }
        return join(this.projectRoot, ...segments);
    }

    resolveNativePath(...segments) {
        // Standard Unix-like path resolution
        const firstSegment = segments[0];
        if (isAbsolute(firstSegment)) {
            return join(...segments);
        }
        return join(this.projectRoot, ...segments);
    }

    shouldRedirectToNative(segment) {
        // Directories that benefit from native WSL2 filesystem performance
        const performanceCritical = [
            'node_modules',
            'dist',
            '.npm',
            '.cache',
            'coverage',
            '.nyc_output',
            'temp',
            'tmp'
        ];

        return performanceCritical.includes(segment);
    }

    getNativeWSL2Root() {
        // Default native WSL2 location for this project
        return join(homedir(), 'projects', 'neurosensefx-native');
    }

    getOptimalTempDir() {
        switch (this.environment) {
            case ENVIRONMENTS.WSL2_NATIVE:
            case ENVIRONMENTS.LINUX_NATIVE:
                return '/tmp/neurosensefx';

            case ENVIRONMENTS.WSL2_MOUNTED:
                // Prefer native temp for performance
                return '/tmp/neurosensefx';

            case ENVIRONMENTS.DOCKER:
                return '/tmp/neurosensefx';

            case ENVIRONMENTS.WINDOWS_NATIVE:
                return join(process.env.TEMP || process.env.TMP || 'C:\\temp', 'neurosensefx');

            case ENVIRONMENTS.MACOS:
                return join(homedir(), 'Library', 'Caches', 'neurosensefx');

            default:
                return join(homedir(), '.neurosensefx', 'temp');
        }
    }

    getOptimizedNodeModulesPath() {
        if (this.environment === ENVIRONMENTS.WSL2_MOUNTED) {
            // Place node_modules on native filesystem for performance
            return join(this.getNativeWSL2Root(), 'node_modules');
        }
        return join(this.projectRoot, 'node_modules');
    }
}

class EnvironmentConfig {
    constructor() {
        this.detector = new EnvironmentDetector();
        this.pathResolver = new PathResolver();
        this.config = this.loadConfiguration();
    }

    loadConfiguration() {
        const configPath = this.pathResolver.resolvePath('environment.config.json');
        const defaultConfig = this.getDefaultConfiguration();

        if (existsSync(configPath)) {
            try {
                const userConfig = JSON.parse(readFileSync(configPath, 'utf8'));
                return this.mergeConfigurations(defaultConfig, userConfig);
            } catch (error) {
                console.warn(`Failed to load configuration from ${configPath}:`, error.message);
            }
        }

        return defaultConfig;
    }

    getDefaultConfiguration() {
        const environment = this.detector.detect();

        const baseConfig = {
            environment,
            projectRoot: this.pathResolver.projectRoot,
            paths: {
                source: 'src',
                services: 'services',
                tests: 'tests',
                docs: 'docs',
                scripts: 'scripts',
                libs: 'libs',
                config: 'config',
                temp: this.pathResolver.getOptimalTempDir(),
                nodeModules: this.pathResolver.getOptimizedNodeModulesPath(),
                logs: 'logs',
                backups: 'backups'
            },
            ports: {
                frontend: 5173,
                backend: 8080,
                websocket: 8081,
                redis: 6379,
                database: 5432,
                debug: 9229
            },
            performance: {
                maxConcurrentProcesses: 4,
                buildTimeoutMs: 300000,
                testTimeoutMs: 120000,
                enableCaching: true,
                cacheDirectory: this.pathResolver.getOptimalTempDir()
            },
            features: {
                hotReload: true,
                debugging: false,
                profiling: false,
                mockData: false
            }
        };

        // Environment-specific optimizations
        switch (environment) {
            case ENVIRONMENTS.WSL2_MOUNTED:
                return {
                    ...baseConfig,
                    performance: {
                        ...baseConfig.performance,
                        maxConcurrentProcesses: 2, // Reduce for better performance
                        enableCaching: true,
                        preferNativeFilesystem: true
                    },
                    recommendations: [
                        'Consider migrating to native WSL2 filesystem for better performance',
                        'Use Docker for containerized development',
                        'Avoid heavy I/O operations on mounted filesystem'
                    ]
                };

            case ENVIRONMENTS.WSL2_NATIVE:
                return {
                    ...baseConfig,
                    performance: {
                        ...baseConfig.performance,
                        maxConcurrentProcesses: 6,
                        enableCaching: true
                    },
                    features: {
                        ...baseConfig.features,
                        hotReload: true,
                        debugging: true
                    }
                };

            case ENVIRONMENTS.DOCKER:
                return {
                    ...baseConfig,
                    paths: {
                        ...baseConfig.paths,
                        temp: '/tmp/neurosensefx',
                        nodeModules: '/app/node_modules'
                    },
                    performance: {
                        ...baseConfig.performance,
                        maxConcurrentProcesses: 4,
                        enableCaching: true
                    },
                    features: {
                        ...baseConfig.features,
                        hotReload: true,
                        debugging: true
                    }
                };

            case ENVIRONMENTS.CI:
                return {
                    ...baseConfig,
                    performance: {
                        ...baseConfig.performance,
                        maxConcurrentProcesses: 2, // Conservative for CI
                        enableCaching: true
                    },
                    features: {
                        ...baseConfig.features,
                        hotReload: false,
                        debugging: false,
                        mockData: true
                    }
                };

            default:
                return baseConfig;
        }
    }

    mergeConfigurations(defaultConfig, userConfig) {
        // Deep merge configuration objects
        const merged = { ...defaultConfig };

        for (const [key, value] of Object.entries(userConfig)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                merged[key] = { ...merged[key], ...value };
            } else {
                merged[key] = value;
            }
        }

        return merged;
    }

    get(key) {
        return this.getNestedValue(this.config, key);
    }

    getNestedValue(obj, key) {
        return key.split('.').reduce((current, k) => current?.[k], obj);
    }

    set(key, value) {
        this.setNestedValue(this.config, key, value);
    }

    setNestedValue(obj, key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, k) => {
            if (!current[k] || typeof current[k] !== 'object') {
                current[k] = {};
            }
            return current[k];
        }, obj);
        target[lastKey] = value;
    }

    save() {
        const configPath = this.pathResolver.resolvePath('environment.config.json');
        writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    }

    printEnvironmentInfo() {
        console.log('=== Environment Configuration ===');
        console.log(`Environment: ${this.config.environment}`);
        console.log(`Project Root: ${this.config.projectRoot}`);
        console.log(`Platform: ${process.platform}`);
        console.log(`Architecture: ${process.arch}`);
        console.log(`Node.js Version: ${process.version}`);

        if (this.detector.isWSL2()) {
            console.log('WSL2: Yes');
            console.log(`WSL2 Mode: ${this.config.environment}`);
        }

        if (this.detector.isDocker()) {
            console.log('Docker: Yes');
        }

        if (this.config.recommendations) {
            console.log('\nRecommendations:');
            this.config.recommendations.forEach(rec => console.log(`  - ${rec}`));
        }

        console.log('\nOptimized Paths:');
        console.log(`  Source: ${this.pathResolver.resolvePath(this.config.paths.source)}`);
        console.log(`  Node Modules: ${this.pathResolver.resolvePath(this.config.paths.nodeModules)}`);
        console.log(`  Temp: ${this.pathResolver.resolvePath(this.config.paths.temp)}`);
        console.log(`  Logs: ${this.pathResolver.resolvePath(this.config.paths.logs)}`);
    }

    createOptimalDirectories() {
        const directories = [
            this.config.paths.temp,
            this.config.paths.logs,
            this.config.paths.backups,
            this.config.paths.nodeModules
        ];

        directories.forEach(dir => {
            const fullPath = this.pathResolver.resolvePath(dir);
            if (!existsSync(fullPath)) {
                // Note: In a real implementation, you'd use fs.mkdirSync with recursive: true
                console.log(`Would create directory: ${fullPath}`);
            }
        });
    }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const config = new EnvironmentConfig();

    const command = process.argv[2];

    switch (command) {
        case 'info':
            config.printEnvironmentInfo();
            break;

        case 'get':
            if (process.argv[3]) {
                console.log(config.get(process.argv[3]));
            } else {
                console.error('Usage: environment-config.js get <key>');
                process.exit(1);
            }
            break;

        case 'set':
            if (process.argv[3] && process.argv[4]) {
                const key = process.argv[3];
                const value = process.argv[4];

                // Try to parse as JSON, fall back to string
                try {
                    const parsedValue = JSON.parse(value);
                    config.set(key, parsedValue);
                } catch {
                    config.set(key, value);
                }

                config.save();
                console.log(`Set ${key} = ${value}`);
            } else {
                console.error('Usage: environment-config.js set <key> <value>');
                process.exit(1);
            }
            break;

        case 'init':
            config.createOptimalDirectories();
            config.save();
            console.log('Environment configuration initialized');
            break;

        case 'path':
            if (process.argv[3]) {
                console.log(config.pathResolver.resolvePath(process.argv[3]));
            } else {
                console.error('Usage: environment-config.js path <segment>');
                process.exit(1);
            }
            break;

        default:
            console.log('Environment Configuration CLI');
            console.log('');
            console.log('Commands:');
            console.log('  info                - Show environment information');
            console.log('  get <key>           - Get configuration value');
            console.log('  set <key> <value>   - Set configuration value');
            console.log('  init                - Initialize environment');
            console.log('  path <segment>      - Resolve path');
            break;
    }
}

export { EnvironmentDetector, PathResolver, EnvironmentConfig };