import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerManager, type ServerManagerOptions } from '../../lib/server-manager.js';
import type { DatabaseConfig } from '../../types/index.js';

// Mock all the dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../lib/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }))
}));

vi.mock('../../lib/database.js', () => ({
  LibSQLConnectionPool: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getConnection: vi.fn().mockResolvedValue({}),
    getStatus: vi.fn().mockReturnValue({ totalConnections: 1 })
  }))
}));

vi.mock('../../lib/base-tool.js', () => ({
  ToolRegistry: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    getToolDefinitions: vi.fn().mockReturnValue([]),
    getAll: vi.fn().mockReturnValue([])
  }))
}));

// Mock all the tool imports
vi.mock('../../tools/read-query.js', () => ({
  ReadQueryTool: vi.fn().mockImplementation(() => ({ name: 'read-query' }))
}));

vi.mock('../../tools/write-query.js', () => ({
  WriteQueryTool: vi.fn().mockImplementation(() => ({ name: 'write-query' }))
}));

vi.mock('../../tools/create-table.js', () => ({
  CreateTableTool: vi.fn().mockImplementation(() => ({ name: 'create-table' }))
}));

vi.mock('../../tools/alter-table.js', () => ({
  AlterTableTool: vi.fn().mockImplementation(() => ({ name: 'alter-table' }))
}));

vi.mock('../../tools/list-tables.js', () => ({
  ListTablesTool: vi.fn().mockImplementation(() => ({ name: 'list-tables' }))
}));

vi.mock('../../tools/describe-table.js', () => ({
  DescribeTableTool: vi.fn().mockImplementation(() => ({ name: 'describe-table' }))
}));

describe('ServerManager', () => {
  let serverManager: ServerManager;
  let mockConfig: DatabaseConfig;
  let mockOptions: ServerManagerOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      url: 'file:///tmp/test.db'
    };

    mockOptions = {
      config: mockConfig,
      developmentMode: false,
      enableHotReload: false
    };

    serverManager = new ServerManager(mockOptions);
  });

  afterEach(async () => {
    // Clean up any running server
    if (serverManager.isServerRunning()) {
      await serverManager.stop();
    }
  });

  describe('constructor', () => {
    it('should create a ServerManager instance', () => {
      expect(serverManager).toBeInstanceOf(ServerManager);
    });

    it('should accept configuration options', () => {
      const devOptions: ServerManagerOptions = {
        config: mockConfig,
        developmentMode: true,
        enableHotReload: true
      };

      const devServerManager = new ServerManager(devOptions);
      expect(devServerManager).toBeInstanceOf(ServerManager);
    });
  });

  describe('isServerRunning', () => {
    it('should return false initially', () => {
      expect(serverManager.isServerRunning()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      const status = serverManager.getStatus();

      expect(status).toEqual({
        running: false,
        shuttingDown: false
      });
    });

    it('should return development mode status', () => {
      const devOptions: ServerManagerOptions = {
        config: mockConfig,
        developmentMode: true,
        enableHotReload: true
      };

      const devServerManager = new ServerManager(devOptions);
      const status = devServerManager.getStatus();

      expect(status.running).toBe(false);
      expect(status.shuttingDown).toBe(false);
    });
  });

  describe('start', () => {
    it('should throw error when starting already running server', async () => {
      // Mock as already running
      const runningManager = new ServerManager(mockOptions);
      // Start it first
      await runningManager.start();

      // Try to start again
      await expect(runningManager.start()).rejects.toThrow('Server is already running');
    });

    it('should initialize in production mode', async () => {
      await serverManager.start();

      const status = serverManager.getStatus();
      expect(status.running).toBe(true);
    });

    it('should initialize in development mode', async () => {
      const devOptions: ServerManagerOptions = {
        config: mockConfig,
        developmentMode: true,
        enableHotReload: true
      };

      const devServerManager = new ServerManager(devOptions);
      await devServerManager.start();

      const status = devServerManager.getStatus();
      expect(status.running).toBe(true);
    });
  });

  describe('stop', () => {
    it('should handle stopping when not running', async () => {
      // Should not throw
      await expect(serverManager.stop()).resolves.toBeUndefined();
    });

    it('should stop running server', async () => {
      await serverManager.start();
      expect(serverManager.isServerRunning()).toBe(true);

      await serverManager.stop();
      expect(serverManager.isServerRunning()).toBe(false);
    });
  });

  describe('reload', () => {
    it('should handle reload when not running', async () => {
      // Should throw error
      await expect(serverManager.reload()).rejects.toThrow('Cannot reload: server is not running');
    });

    it('should reload running server', async () => {
      await serverManager.start();

      // Should not throw
      await expect(serverManager.reload()).resolves.toBeUndefined();
      expect(serverManager.isServerRunning()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors', async () => {
      // Mock database initialization to fail
      const { LibSQLConnectionPool } = await import('../../lib/database.js');
      const mockPool = {
        initialize: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        close: vi.fn().mockResolvedValue(undefined)
      };
      vi.mocked(LibSQLConnectionPool).mockImplementation(() => mockPool as any);

      const errorManager = new ServerManager(mockOptions);

      await expect(errorManager.start()).rejects.toThrow('Database connection failed');
    });
  });
});
