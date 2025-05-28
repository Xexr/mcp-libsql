#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { Logger } from './lib/logger.js';
import { DatabaseConfig } from './types/index.js';
import { ServerManager } from './lib/server-manager.js';

const logger = new Logger();

interface CLIOptions {
  url: string;
  minConnections: number | undefined;
  maxConnections: number | undefined;
  connectionTimeout: number | undefined;
  queryTimeout: number | undefined;
  help: boolean | undefined;
  version: boolean | undefined;
  dev: boolean | undefined;
}

function showHelp(): void {
  console.log(`
MCP libSQL Server

Usage: mcp-libsql-server --url <DATABASE_URL> [options]

Options:
  --url <URL>                    libSQL database URL (required)
  --min-connections <number>     Minimum connections in pool (default: 1)
  --max-connections <number>     Maximum connections in pool (default: 10)
  --connection-timeout <number>  Connection timeout in ms (default: 30000)
  --query-timeout <number>       Query timeout in ms (default: 30000)
  --dev                          Enable development mode with enhanced logging
  --help                         Show this help message
  --version                      Show version information

Examples:
  mcp-libsql-server --url "file:local.db"
  mcp-libsql-server --url "libsql://your-db.turso.io" --max-connections 20
  mcp-libsql-server --url "http://localhost:8080" --min-connections 2 --dev

Development:
  Use --dev flag for enhanced logging and development features
  Use 'pnpm dev --url "file:test.db"' for hot reloading during development
`);
}

async function showVersion(): Promise<void> {
  const packageJson = await import('../package.json', { with: { type: 'json' } });
  console.log(`mcp-libsql-server v${packageJson.default.version}`);
}

function parseCliArgs(): CLIOptions {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        url: { type: 'string' },
        'min-connections': { type: 'string' },
        'max-connections': { type: 'string' },
        'connection-timeout': { type: 'string' },
        'query-timeout': { type: 'string' },
        dev: { type: 'boolean', short: 'd' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' }
      },
      strict: true
    });

    return {
      url: values.url || '',
      minConnections: values['min-connections'] ? parseInt(values['min-connections'], 10) : undefined,
      maxConnections: values['max-connections'] ? parseInt(values['max-connections'], 10) : undefined,
      connectionTimeout: values['connection-timeout'] ? parseInt(values['connection-timeout'], 10) : undefined,
      queryTimeout: values['query-timeout'] ? parseInt(values['query-timeout'], 10) : undefined,
      dev: values.dev,
      help: values.help,
      version: values.version
    };
  } catch (error) {
    logger.error('Failed to parse CLI arguments', { error: error instanceof Error ? error.message : String(error) });
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
  if (options.minConnections !== undefined && (options.minConnections < 1 || !Number.isInteger(options.minConnections))) {
    logger.error('min-connections must be a positive integer');
    process.exit(1);
  }

  if (options.maxConnections !== undefined && (options.maxConnections < 1 || !Number.isInteger(options.maxConnections))) {
    logger.error('max-connections must be a positive integer');
    process.exit(1);
  }

  if (options.minConnections !== undefined && options.maxConnections !== undefined && options.minConnections > options.maxConnections) {
    logger.error('min-connections cannot be greater than max-connections');
    process.exit(1);
  }

  if (options.connectionTimeout !== undefined && (options.connectionTimeout < 1000 || !Number.isInteger(options.connectionTimeout))) {
    logger.error('connection-timeout must be an integer >= 1000ms');
    process.exit(1);
  }

  if (options.queryTimeout !== undefined && (options.queryTimeout < 1000 || !Number.isInteger(options.queryTimeout))) {
    logger.error('query-timeout must be an integer >= 1000ms');
    process.exit(1);
  }

  const config: DatabaseConfig = {
    url: options.url,
    ...(options.minConnections !== undefined && { minConnections: options.minConnections }),
    ...(options.maxConnections !== undefined && { maxConnections: options.maxConnections }),
    ...(options.connectionTimeout !== undefined && { connectionTimeout: options.connectionTimeout }),
    ...(options.queryTimeout !== undefined && { queryTimeout: options.queryTimeout })
  };

  return config;
}


async function main(): Promise<void> {
  let serverManager: ServerManager | null = null;
  
  try {
    logger.info('Starting MCP libSQL Server');
    
    const options = parseCliArgs();
    const config = await validateOptions(options);
    
    const isDevelopment = options.dev || process.env['NODE_ENV'] === 'development';
    
    logger.info('Configuration validated', { 
      url: config.url,
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
    const gracefulShutdown = async (signal: string) => {
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
  main().catch((error) => {
    logger.error('Unhandled error in main', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}