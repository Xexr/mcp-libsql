import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Logger } from './logger.js';
import { LibSQLConnectionPool } from './database.js';
import { ToolRegistry } from './base-tool.js';
import type { DatabaseConfig } from '../types/index.js';

const logger = new Logger();

export interface ServerManagerOptions {
  config: DatabaseConfig;
  enableHotReload?: boolean;
  developmentMode?: boolean;
}

export class ServerManager {
  private server: Server | null = null;
  private pool: LibSQLConnectionPool | null = null;
  private toolRegistry: ToolRegistry | null = null;
  private transport: StdioServerTransport | null = null;
  private isRunning = false;
  private isShuttingDown = false;

  constructor(private options: ServerManagerOptions) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    if (this.isShuttingDown) {
      throw new Error('Server is shutting down, cannot start');
    }

    try {
      const mode = this.options.developmentMode ? 'development' : 'production';
      logger.info(`Starting server manager in ${mode} mode`);

      if (this.options.developmentMode) {
        logger.info('Development mode features enabled:', {
          enhancedLogging: true,
          hotReload: this.options.enableHotReload || false,
          nodeEnv: process.env['NODE_ENV'] || 'development'
        });
      }

      // Initialize database connection pool
      this.pool = new LibSQLConnectionPool(this.options.config);
      await this.pool.initialize();

      // Create and register tools
      this.toolRegistry = await this.createToolRegistry();

      // Create and configure MCP server
      this.server = await this.createMCPServer();

      // Set up transport and connect
      this.transport = new StdioServerTransport();

      // Add error handling
      this.server.onerror = (error): void => {
        logger.error('MCP Server error', {
          error: error instanceof Error ? error.message : String(error)
        });
      };

      await this.server.connect(this.transport);

      this.isRunning = true;
      logger.info('Server manager started successfully');

      if (this.options.developmentMode) {
        this.setupDevelopmentFeatures();
      }
    } catch (error) {
      logger.error('Failed to start server manager', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Clean up on failure
      await this.cleanup();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Server is not running, nothing to stop');
      return;
    }

    if (this.isShuttingDown) {
      logger.warn('Server is already shutting down');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Stopping server manager');

    await this.cleanup();

    this.isRunning = false;
    this.isShuttingDown = false;
    logger.info('Server manager stopped successfully');
  }

  async reload(newConfig?: DatabaseConfig): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Cannot reload: server is not running');
    }

    logger.info('Reloading server manager');

    // Update config if provided
    if (newConfig) {
      this.options.config = newConfig;
      logger.info('Updated configuration', { config: newConfig });
    }

    // Stop current server
    await this.stop();

    // Start with new configuration
    await this.start();

    logger.info('Server manager reloaded successfully');
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  getStatus(): {
    running: boolean;
    shuttingDown: boolean;
    poolConnections?: number;
    registeredTools?: number;
  } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status: any = {
      running: this.isRunning,
      shuttingDown: this.isShuttingDown
    };

    const poolConnections = this.pool?.getStatus?.()?.totalConnections;
    if (poolConnections !== undefined) {
      status.poolConnections = poolConnections;
    }

    const registeredTools = this.toolRegistry?.getAll().length;
    if (registeredTools !== undefined) {
      status.registeredTools = registeredTools;
    }

    return status;
  }

  private setupDevelopmentFeatures(): void {
    logger.info('Setting up development features');

    // Set up periodic status logging in development mode
    const statusInterval = setInterval(() => {
      if (this.isRunning && !this.isShuttingDown) {
        const status = this.getStatus();
        logger.info('Development status check', status);
      } else {
        clearInterval(statusInterval);
      }
    }, 30000); // Log status every 30 seconds

    // Log tool registration details
    if (this.toolRegistry) {
      const tools = this.toolRegistry.getAll();
      logger.info('Registered tools in development mode:', {
        count: tools.length,
        tools: tools.map(tool => tool.name)
      });
    }

    // Log pool status
    if (this.pool) {
      const poolStatus = this.pool.getStatus();
      logger.info('Connection pool status in development mode:', poolStatus);
    }
  }

  private async createToolRegistry(): Promise<ToolRegistry> {
    const { ToolRegistry } = await import('./base-tool.js');
    const { ReadQueryTool } = await import('../tools/read-query.js');
    const { WriteQueryTool } = await import('../tools/write-query.js');
    const { CreateTableTool } = await import('../tools/create-table.js');
    const { AlterTableTool } = await import('../tools/alter-table.js');
    const { ListTablesTool } = await import('../tools/list-tables.js');
    const { DescribeTableTool } = await import('../tools/describe-table.js');

    const registry = new ToolRegistry();
    registry.register(new ReadQueryTool());
    registry.register(new WriteQueryTool());
    registry.register(new CreateTableTool());
    registry.register(new AlterTableTool());
    registry.register(new ListTablesTool());
    registry.register(new DescribeTableTool());

    return registry;
  }

  private async createMCPServer(): Promise<Server> {
    if (!this.pool || !this.toolRegistry) {
      throw new Error('Pool and tool registry must be initialized first');
    }

    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    const { CallToolRequestSchema, ListToolsRequestSchema } = await import(
      '@modelcontextprotocol/sdk/types.js'
    );

    const server = new Server(
      {
        name: 'xexr-libsql',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Set up handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        logger.info('Handling list tools request');
        if (!this.toolRegistry) {
          throw new Error('Tool registry not initialized');
        }
        const tools = this.toolRegistry.getToolDefinitions();
        logger.info(`Returning ${tools.length} tool definitions`);

        return { tools };
      } catch (error) {
        logger.error('Failed to list tools', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    });

    server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let connection: any = null;

      try {
        logger.info(`Handling tool request: ${name}`, { arguments: args });

        if (!this.pool) {
          throw new Error('Database pool not initialized');
        }
        if (!this.toolRegistry) {
          throw new Error('Tool registry not initialized');
        }

        connection = await this.pool.getConnection();

        const result = await this.toolRegistry.execute(name, {
          connection,
          arguments: args || {}
        });

        logger.info(`Tool executed successfully: ${name}`, {
          hasError: result.isError || false
        });

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Tool execution failed: ${name}`, {
          error: errorMessage,
          arguments: args
        });

        return {
          content: [
            {
              type: 'text',
              text: `Error: Failed to execute tool ${name}: ${errorMessage}`
            }
          ],
          isError: true
        };
      } finally {
        if (connection) {
          try {
            if (this.pool) {
              this.pool.releaseConnection(connection);
            }
          } catch (releaseError) {
            logger.error('Failed to release connection', {
              error: releaseError instanceof Error ? releaseError.message : String(releaseError)
            });
          }
        }
      }
    });

    return server;
  }

  private async cleanup(): Promise<void> {
    const errors: string[] = [];

    // Close server
    if (this.server) {
      try {
        await this.server.close();
        logger.info('MCP server closed');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Error closing MCP server: ${errorMsg}`);
        logger.error('Error closing MCP server', { error: errorMsg });
      }
      this.server = null;
    }

    // Close database pool
    if (this.pool) {
      try {
        await this.pool.close();
        logger.info('Database pool closed');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Error closing database pool: ${errorMsg}`);
        logger.error('Error closing database pool', { error: errorMsg });
      }
      this.pool = null;
    }

    // Clear references
    this.toolRegistry = null;
    this.transport = null;

    if (errors.length > 0) {
      throw new Error(`Cleanup completed with errors: ${errors.join(', ')}`);
    }
  }
}
