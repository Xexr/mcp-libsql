import { createClient, type Client, type ResultSet } from '@libsql/client';
import type {
  DatabaseConfig,
  DatabaseConnection,
  ConnectionPool
} from '../types/index.js';
import { DEFAULT_CONFIG } from './constants.js';
import { logger } from './logger.js';

class LibSQLConnection implements DatabaseConnection {
  private client: Client;
  private isConnected: boolean = false;

  constructor(private config: DatabaseConfig) {
    this.client = createClient({
      url: config.url
    });
  }

  async connect(): Promise<void> {
    try {
      // Test connection with a simple query
      await this.client.execute('SELECT 1');
      this.isConnected = true;
      logger.info('Database connection established', { url: this.config.url });
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to establish database connection', { url: this.config.url }, error as Error);
      throw error;
    }
  }

  async execute(query: string, params?: any[]): Promise<ResultSet> {
    if (!this.isConnected) {
      throw new Error('Database connection not established');
    }

    const startTime = Date.now();

    try {
      logger.debug('Executing query', { query, params });

      const result = params && params.length > 0
        ? await this.client.execute({ sql: query, args: params })
        : await this.client.execute(query);

      const executionTime = Date.now() - startTime;
      logger.debug('Query executed successfully', {
        query,
        executionTime,
        rowsAffected: result.rowsAffected,
        rowsReturned: result.rows.length
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Query execution failed', {
        query,
        params,
        executionTime
      }, error as Error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      this.client.close();
      this.isConnected = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection', {}, error as Error);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

class LibSQLConnectionPool implements ConnectionPool {
  private connections: LibSQLConnection[] = [];
  private availableConnections: LibSQLConnection[] = [];
  private config: Required<DatabaseConfig>;
  private isShuttingDown: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
  }

  async initialize(): Promise<void> {
    logger.info('Initializing connection pool', {
      minConnections: this.config.minConnections,
      maxConnections: this.config.maxConnections
    });

    // Create minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      await this.createConnection();
    }

    logger.info('Connection pool initialized', {
      activeConnections: this.connections.length
    });
  }

  private async createConnection(): Promise<LibSQLConnection> {
    if (this.connections.length >= this.config.maxConnections) {
      throw new Error('Maximum connection limit reached');
    }

    const connection = new LibSQLConnection(this.config);
    await this.retryWithBackoff(async () => {
      await connection.connect();
    });

    this.connections.push(connection);
    this.availableConnections.push(connection);

    return connection;
  }

  private async retryWithBackoff(operation: () => Promise<void>, maxRetries = 3): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        const delay = this.config.retryInterval * attempt;
        logger.warn(`Connection attempt ${attempt} failed, retrying in ${delay}ms`, {
          attempt,
          maxRetries,
          error: lastError.message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Unknown error occurred during retry');
  }

  async getConnection(): Promise<DatabaseConnection> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    // Try to get an available connection
    let connection = this.availableConnections.pop();

    // If no available connections and we haven't reached max, create a new one
    if (!connection && this.connections.length < this.config.maxConnections) {
      connection = await this.createConnection();
      this.availableConnections.pop(); // Remove it from available since we're using it
    }

    // If still no connection, wait for one to become available
    if (!connection) {
      connection = await this.waitForConnection();
    }

    // Verify connection health
    if (!(await connection.isHealthy())) {
      logger.warn('Unhealthy connection detected, creating new one');
      await this.removeConnection(connection);
      return this.getConnection(); // Recursive call to get a healthy connection
    }

    return connection;
  }

  private async waitForConnection(): Promise<LibSQLConnection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout: No connections available'));
      }, this.config.connectionTimeout);

      const checkForConnection = (): void => {
        const connection = this.availableConnections.pop();
        if (connection) {
          clearTimeout(timeout);
          resolve(connection);
        } else {
          setTimeout(checkForConnection, 100); // Check every 100ms
        }
      };

      checkForConnection();
    });
  }

  releaseConnection(connection: DatabaseConnection): void {
    const libsqlConnection = connection as LibSQLConnection;
    if (this.connections.includes(libsqlConnection) && !this.availableConnections.includes(libsqlConnection)) {
      this.availableConnections.push(libsqlConnection);
    }
  }

  private async removeConnection(connection: LibSQLConnection): Promise<void> {
    // Remove from both arrays
    const connectionIndex = this.connections.indexOf(connection);
    if (connectionIndex > -1) {
      this.connections.splice(connectionIndex, 1);
    }

    const availableIndex = this.availableConnections.indexOf(connection);
    if (availableIndex > -1) {
      this.availableConnections.splice(availableIndex, 1);
    }

    // Close the connection
    try {
      await connection.close();
    } catch (error) {
      logger.error('Error closing removed connection', {}, error as Error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const connection = await this.getConnection();
      const isHealthy = await connection.isHealthy();
      this.releaseConnection(connection);
      return isHealthy;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    logger.info('Shutting down connection pool');
    this.isShuttingDown = true;

    // Close all connections
    const closePromises = this.connections.map(connection => connection.close());
    await Promise.allSettled(closePromises);

    this.connections = [];
    this.availableConnections = [];

    logger.info('Connection pool shutdown complete');
  }
}

export { LibSQLConnection, LibSQLConnectionPool };
export type { DatabaseConnection, ConnectionPool };

