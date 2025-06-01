#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { Logger, type LogMode } from './lib/logger.js';
import { DatabaseConfig } from './types/index.js';
import { ServerManager } from './lib/server-manager.js';

let logger = new Logger();

interface CLIOptions {
  url: string;
  authToken: string | undefined;
  minConnections: number | undefined;
  maxConnections: number | undefined;
  connectionTimeout: number | undefined;
  queryTimeout: number | undefined;
  help: boolean | undefined;
  version: boolean | undefined;
  dev: boolean | undefined;
  logMode: LogMode | undefined;
}

function showHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`
MCP libSQL Server

Usage: mcp-libsql-server --url <DATABASE_URL> [options]

Options:
  --url <URL>                    libSQL database URL (required)
  --auth-token <token>           Authentication token for Turso databases (optional)
                                 Can also be set via LIBSQL_AUTH_TOKEN environment variable
  --min-connections <number>     Minimum connections in pool (default: 1)
  --max-connections <number>     Maximum connections in pool (default: 10)
  --connection-timeout <number>  Connection timeout in ms (default: 30000)
  --query-timeout <number>       Query timeout in ms (default: 30000)
  --log-mode <mode>              Logging mode: file, console, both, none (default: file)
  --dev                          Enable development mode with enhanced logging
  --help                         Show this help message
  --version                      Show version information

Examples:
  mcp-libsql-server --url "file:local.db"
  mcp-libsql-server --url "libsql://your-db.turso.io" --auth-token "your-token" --max-connections 20
  LIBSQL_AUTH_TOKEN="your-token" mcp-libsql-server --url "libsql://your-db.turso.io"
  mcp-libsql-server --url "http://localhost:8080" --min-connections 2 --dev
  mcp-libsql-server --url "file:local.db" --log-mode console

Development:
  Use --dev flag for enhanced logging and development features
  Use 'pnpm dev --url "file:test.db"' for hot reloading during development
  For Turso development, set LIBSQL_AUTH_TOKEN env var to avoid exposing tokens in command history
`);
}

async function showVersion(): Promise<void> {
  try {
    // Use fs to read package.json for better compatibility
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, '..', 'package.json');

    const packageContent = await readFile(packagePath, 'utf-8');
    const packageJson = JSON.parse(packageContent);

    // eslint-disable-next-line no-console
    console.log(`mcp-libsql-server v${packageJson.version}`);
  } catch (error) {
    // Fallback if reading package.json fails
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line no-console
    console.log('mcp-libsql-server v1.0.0');
  }
}

function parseCliArgs(): CLIOptions {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        url: { type: 'string' },
        'auth-token': { type: 'string' },
        'min-connections': { type: 'string' },
        'max-connections': { type: 'string' },
        'connection-timeout': { type: 'string' },
        'query-timeout': { type: 'string' },
        'log-mode': { type: 'string' },
        dev: { type: 'boolean', short: 'd' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' }
      },
      strict: true
    });

    return {
      url: values.url || '',
      authToken: values['auth-token'] || process.env['LIBSQL_AUTH_TOKEN'],
      minConnections: values['min-connections']
        ? parseInt(values['min-connections'], 10)
        : undefined,
      maxConnections: values['max-connections']
        ? parseInt(values['max-connections'], 10)
        : undefined,
      connectionTimeout: values['connection-timeout']
        ? parseInt(values['connection-timeout'], 10)
        : undefined,
      queryTimeout: values['query-timeout'] ? parseInt(values['query-timeout'], 10) : undefined,
      logMode: values['log-mode'] as LogMode | undefined,
      dev: values.dev,
      help: values.help,
      version: values.version
    };
  } catch (error) {
    logger.error('Failed to parse CLI arguments', {
      error: error instanceof Error ? error.message : String(error)
    });
    showHelp();
    process.exit(1);
  }
}

async function validateOptions(options: CLIOptions): Promise<DatabaseConfig> {
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.version) {
    await showVersion();
    process.exit(0);
  }

  if (!options.url) {
    logger.error('Database URL is required');
    showHelp();
    process.exit(1);
  }

  // Validate numeric options
  if (
    options.minConnections !== undefined &&
    (options.minConnections < 1 || !Number.isInteger(options.minConnections))
  ) {
    logger.error('min-connections must be a positive integer');
    process.exit(1);
  }

  if (
    options.maxConnections !== undefined &&
    (options.maxConnections < 1 || !Number.isInteger(options.maxConnections))
  ) {
    logger.error('max-connections must be a positive integer');
    process.exit(1);
  }

  if (
    options.minConnections !== undefined &&
    options.maxConnections !== undefined &&
    options.minConnections > options.maxConnections
  ) {
    logger.error('min-connections cannot be greater than max-connections');
    process.exit(1);
  }

  if (
    options.connectionTimeout !== undefined &&
    (options.connectionTimeout < 1000 || !Number.isInteger(options.connectionTimeout))
  ) {
    logger.error('connection-timeout must be an integer >= 1000ms');
    process.exit(1);
  }

  if (
    options.queryTimeout !== undefined &&
    (options.queryTimeout < 1000 || !Number.isInteger(options.queryTimeout))
  ) {
    logger.error('query-timeout must be an integer >= 1000ms');
    process.exit(1);
  }

  // Validate log-mode
  if (
    options.logMode !== undefined &&
    !['file', 'console', 'both', 'none'].includes(options.logMode)
  ) {
    logger.error('log-mode must be one of: file, console, both, none');
    process.exit(1);
  }

  // Validate auth-token
  if (options.authToken !== undefined) {
    if (typeof options.authToken !== 'string' || options.authToken.trim().length === 0) {
      logger.error('auth-token must be a non-empty string');
      process.exit(1);
    }

    // Validate auth token format for Turso tokens (basic validation)
    // Turso tokens are typically JWT-like base64 encoded strings
    if (options.authToken.includes(' ') || options.authToken.includes('\n')) {
      logger.error('auth-token contains invalid characters (spaces or newlines)');
      process.exit(1);
    }

    // Warn if auth token looks suspicious (too short)
    if (options.authToken.length < 10) {
      logger.warn('auth-token appears to be very short, please ensure it is correct');
    }

    // Validate that auth token is used with appropriate URLs
    if (!options.url.startsWith('libsql://') && !options.url.startsWith('https://')) {
      logger.warn(
        'auth-token provided but URL does not appear to be a remote database (libsql:// or https://)'
      );
      logger.warn('Auth tokens are typically used with Turso or other remote libSQL databases');
    }
  }

  const config: DatabaseConfig = {
    url: options.url,
    ...(options.authToken !== undefined && { authToken: options.authToken }),
    ...(options.minConnections !== undefined && { minConnections: options.minConnections }),
    ...(options.maxConnections !== undefined && { maxConnections: options.maxConnections }),
    ...(options.connectionTimeout !== undefined && {
      connectionTimeout: options.connectionTimeout
    }),
    ...(options.queryTimeout !== undefined && { queryTimeout: options.queryTimeout })
  };

  return config;
}

async function main(): Promise<void> {
  let serverManager: ServerManager | null = null;

  try {
    const options = parseCliArgs();
    const config = await validateOptions(options);

    // Create logger with specified log mode (default to 'file')
    const logMode = options.logMode || 'file';
    logger = new Logger(undefined, 'INFO', logMode);

    logger.info('Starting MCP libSQL Server');
    logger.info(`Node.js version: ${process.version}`);
    logger.info(`Platform: ${process.platform} ${process.arch}`);
    logger.info(`Log mode: ${logMode}`);

    // Log where we're writing logs for easy access (only if file logging is enabled)
    if (logMode === 'file' || logMode === 'both') {
      // eslint-disable-next-line no-console
      console.error(`Log file location: ${logger.getLogFilePath()}`);
    }

    const isDevelopment = options.dev || process.env['NODE_ENV'] === 'development';

    // Determine auth token source for logging
    let authTokenSource = 'none';
    if (config.authToken) {
      const cliToken = parseArgs({
        args: process.argv.slice(2),
        options: { 'auth-token': { type: 'string' } },
        strict: false
      }).values['auth-token'];

      if (cliToken) {
        authTokenSource = 'CLI parameter';
      } else if (process.env['LIBSQL_AUTH_TOKEN']) {
        authTokenSource = 'environment variable';
      }
    }

    logger.info('Configuration validated', {
      url: config.url,
      authTokenProvided: !!config.authToken,
      authTokenSource,
      minConnections: config.minConnections,
      maxConnections: config.maxConnections,
      connectionTimeout: config.connectionTimeout,
      queryTimeout: config.queryTimeout,
      developmentMode: isDevelopment
    });

    // Create and start server manager
    serverManager = new ServerManager({
      config,
      developmentMode: isDevelopment,
      enableHotReload: isDevelopment
    });
    await serverManager.start();

    logger.info('MCP libSQL Server started successfully');

    // Log server status
    const status = serverManager.getStatus();
    logger.info('Server status', status);

    // Set up graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully`);

      if (serverManager && serverManager.isServerRunning()) {
        try {
          await serverManager.stop();
          logger.info('Server manager stopped successfully');
        } catch (error) {
          logger.error('Error stopping server manager', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      process.exit(0);
    };

    // Set up signal handlers
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Optional: Set up SIGUSR1 for reload (development feature)
    process.on('SIGUSR1', async () => {
      logger.info('Received SIGUSR1, reloading server');

      if (serverManager) {
        try {
          await serverManager.reload();
          logger.info('Server reloaded successfully');
        } catch (error) {
          logger.error('Error reloading server', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    });

    // Keep the process alive to handle MCP communication
    // The server is now running and will handle requests via stdio
    // We need to prevent the main function from exiting
    process.stdin.resume();
  } catch (error) {
    logger.error('Failed to start MCP libSQL Server', {
      error: error instanceof Error ? error.message : String(error)
    });

    // Clean up on startup failure
    if (serverManager) {
      try {
        await serverManager.stop();
      } catch (cleanupError) {
        logger.error('Error during cleanup', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        });
      }
    }

    process.exit(1);
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Unhandled error in main', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}
