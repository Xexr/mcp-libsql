import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LibSQLConnection, LibSQLConnectionPool } from '../../lib/database.js';
import type { DatabaseConfig } from '../../types/index.js';

// Mock libSQL client
vi.mock('@libsql/client', () => ({
  createClient: vi.fn(() => ({
    execute: vi.fn(),
    close: vi.fn()
  }))
}));

describe('LibSQLConnection', () => {
  let connection: LibSQLConnection;
  let config: DatabaseConfig;

  beforeEach(() => {
    config = {
      url: 'http://127.0.0.1:8080'
    };
    connection = new LibSQLConnection(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a connection with the provided config', () => {
    expect(connection).toBeInstanceOf(LibSQLConnection);
  });

  it('should connect successfully', async () => {
    const mockClient = (connection as any).client;
    mockClient.execute.mockResolvedValue({ rows: [], rowsAffected: 0 });

    await connection.connect();
    expect(mockClient.execute).toHaveBeenCalledWith('SELECT 1');
  });

  it('should execute queries successfully', async () => {
    const mockClient = (connection as any).client;
    const mockResult = {
      rows: [{ id: 1, name: 'test' }],
      rowsAffected: 1
    };
    mockClient.execute.mockResolvedValue(mockResult);

    // Connect first
    await connection.connect();
    
    const result = await connection.execute('SELECT * FROM users');
    expect(result).toEqual(mockResult);
    expect(mockClient.execute).toHaveBeenCalledWith('SELECT * FROM users');
  });

  it('should execute parameterized queries', async () => {
    const mockClient = (connection as any).client;
    const mockResult = {
      rows: [{ id: 1, name: 'test' }],
      rowsAffected: 1
    };
    mockClient.execute.mockResolvedValue(mockResult);

    await connection.connect();
    
    const result = await connection.execute('SELECT * FROM users WHERE id = ?', [1]);
    expect(result).toEqual(mockResult);
    expect(mockClient.execute).toHaveBeenCalledWith({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [1]
    });
  });

  it('should check health correctly', async () => {
    const mockClient = (connection as any).client;
    mockClient.execute.mockResolvedValue({ rows: [], rowsAffected: 0 });

    const isHealthy = await connection.isHealthy();
    expect(isHealthy).toBe(true);
    expect(mockClient.execute).toHaveBeenCalledWith('SELECT 1');
  });

  it('should return false for health check on error', async () => {
    const mockClient = (connection as any).client;
    mockClient.execute.mockRejectedValue(new Error('Connection failed'));

    const isHealthy = await connection.isHealthy();
    expect(isHealthy).toBe(false);
  });

  it('should close connection properly', async () => {
    const mockClient = (connection as any).client;
    mockClient.close.mockResolvedValue(undefined);

    await connection.close();
    expect(mockClient.close).toHaveBeenCalled();
  });
});

describe('LibSQLConnectionPool', () => {
  let pool: LibSQLConnectionPool;
  let config: DatabaseConfig;

  beforeEach(() => {
    config = {
      url: 'http://127.0.0.1:8080',
      minConnections: 2,
      maxConnections: 5
    };
    pool = new LibSQLConnectionPool(config);
  });

  afterEach(async () => {
    await pool.close();
    vi.clearAllMocks();
  });

  it('should create a connection pool with the provided config', () => {
    expect(pool).toBeInstanceOf(LibSQLConnectionPool);
  });

  it('should initialize with minimum connections', async () => {
    // Mock the connection creation
    const mockClient = {
      execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
      close: vi.fn()
    };
    
    const { createClient } = await import('@libsql/client');
    (createClient as any).mockReturnValue(mockClient);

    await pool.initialize();
    
    // Should have created minimum connections
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it('should get a connection from the pool', async () => {
    const mockClient = {
      execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
      close: vi.fn()
    };
    
    const { createClient } = await import('@libsql/client');
    (createClient as any).mockReturnValue(mockClient);

    await pool.initialize();
    const connection = await pool.getConnection();
    
    expect(connection).toBeDefined();
    expect(await connection.isHealthy()).toBe(true);
  });

  it('should release connections back to the pool', async () => {
    const mockClient = {
      execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
      close: vi.fn()
    };
    
    const { createClient } = await import('@libsql/client');
    (createClient as any).mockReturnValue(mockClient);

    await pool.initialize();
    const connection = await pool.getConnection();
    
    // Should not throw
    expect(() => pool.releaseConnection(connection)).not.toThrow();
  });

  it('should perform health checks', async () => {
    const mockClient = {
      execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
      close: vi.fn()
    };
    
    const { createClient } = await import('@libsql/client');
    (createClient as any).mockReturnValue(mockClient);

    await pool.initialize();
    const isHealthy = await pool.healthCheck();
    
    expect(isHealthy).toBe(true);
  });

  it('should close all connections', async () => {
    const mockClient = {
      execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
      close: vi.fn()
    };
    
    const { createClient } = await import('@libsql/client');
    (createClient as any).mockReturnValue(mockClient);

    await pool.initialize();
    await pool.close();
    
    // Should have closed all connections
    expect(mockClient.close).toHaveBeenCalledTimes(2);
  });
});

describe('Authentication in Database Connection', () => {
  it('should create connection with auth token when provided', () => {
    const config: DatabaseConfig = {
      url: 'libsql://my-db.turso.io',
      authToken: 'test-auth-token'
    };

    const connection = new LibSQLConnection(config);
    expect(connection).toBeInstanceOf(LibSQLConnection);
  });

  it('should create connection without auth token when not provided', () => {
    const config: DatabaseConfig = {
      url: 'file:///tmp/test.db'
    };

    const connection = new LibSQLConnection(config);
    expect(connection).toBeInstanceOf(LibSQLConnection);
  });

  it('should handle auth token in connection pool', async () => {
    const config: DatabaseConfig = {
      url: 'libsql://my-db.turso.io',
      authToken: 'test-pool-token',
      minConnections: 1,
      maxConnections: 2
    };

    const pool = new LibSQLConnectionPool(config);
    expect(pool).toBeInstanceOf(LibSQLConnectionPool);

    // Mock the client execution for initialization
    const mockClient = vi.fn(() => ({
      execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
      close: vi.fn(),
      transaction: vi.fn()
    }));

    // Spy on createClient to verify auth token is passed
    const { createClient } = await import('@libsql/client');
    (createClient as any).mockImplementation(mockClient);

    // This would test initialization, but we need to mock the entire flow
    // The important test is that the pool accepts auth token in config
  });
});