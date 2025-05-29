import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WriteQueryTool } from '../../tools/write-query.js';
import type { ToolExecutionContext } from '../../lib/base-tool.js';
import type { DatabaseConnection } from '../../types/index.js';

// Mock the performance utils
vi.mock('../../utils/performance.js', () => ({
  formatPerformanceMetrics: vi.fn(() => '75ms, 3 affected')
}));

describe('WriteQueryTool', () => {
  let tool: WriteQueryTool;
  let mockConnection: DatabaseConnection;
  let mockTransaction: any;
  let context: ToolExecutionContext;

  beforeEach(() => {
    tool = new WriteQueryTool();
    
    mockTransaction = {
      execute: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn()
    };
    
    mockConnection = {
      execute: vi.fn(),
      transaction: vi.fn(),
      close: vi.fn(),
      isHealthy: vi.fn()
    } as any;
    
    context = {
      connection: mockConnection,
      arguments: {}
    } as ToolExecutionContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('write-query');
      expect(tool.description).toContain('INSERT, UPDATE, DELETE');
      expect(tool.description).toContain('performance metrics');
      expect(tool.description).toContain('parameterized queries');
    });

    it('should have proper input schema', () => {
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('Query Validation', () => {
    it('should accept valid INSERT query', async () => {
      mockConnection.transaction = vi.fn().mockImplementation(async (fn) => {
        mockTransaction.execute.mockResolvedValue({
          rowsAffected: 1,
          lastInsertRowid: 123
        });
        return await fn(mockTransaction);
      });

      context.arguments = {
        query: 'INSERT INTO users (name) VALUES (?)',
        parameters: ['John Doe'],
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Query executed successfully (with transaction)');
      expect(result.content[0].text).toContain('Rows affected: 1');
      expect(result.content[0].text).toContain('Last insert row ID: 123');
    });

    it('should accept valid UPDATE query', async () => {
      mockConnection.transaction = vi.fn().mockImplementation(async (fn) => {
        mockTransaction.execute.mockResolvedValue({
          rowsAffected: 2
        });
        return await fn(mockTransaction);
      });

      context.arguments = {
        query: 'UPDATE users SET name = ? WHERE id = ?',
        parameters: ['Jane Doe', 1],
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Rows affected: 2');
    });

    it('should accept valid DELETE query', async () => {
      mockConnection.transaction = vi.fn().mockImplementation(async (fn) => {
        mockTransaction.execute.mockResolvedValue({
          rowsAffected: 1
        });
        return await fn(mockTransaction);
      });

      context.arguments = {
        query: 'DELETE FROM users WHERE id = ?',
        parameters: [1],
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Rows affected: 1');
    });

    it('should reject SELECT queries', async () => {
      context.arguments = {
        query: 'SELECT * FROM users',
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Only INSERT, UPDATE, DELETE queries are allowed');
    });

    it('should reject DDL operations', async () => {
      context.arguments = {
        query: 'CREATE TABLE test (id INTEGER)',
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('prohibited operations');
    });

    it('should reject dangerous operations', async () => {
      context.arguments = {
        query: 'INSERT INTO users (name) VALUES (?); DROP TABLE users;',
        parameters: ['Evil'],
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('prohibited operations');
    });

    it('should reject system table access', async () => {
      context.arguments = {
        query: 'INSERT INTO sqlite_master VALUES (?)',
        parameters: ['evil'],
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('system tables');
    });

    it('should reject empty queries', async () => {
      context.arguments = {
        query: '',
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query cannot be empty');
    });

    it('should reject queries that are too long', async () => {
      context.arguments = {
        query: 'INSERT INTO users (name) VALUES ' + '(?)'.repeat(5000),
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query too long');
    });

    it('should reject too many parameters', async () => {
      context.arguments = {
        query: 'INSERT INTO users (name) VALUES (?)',
        parameters: new Array(101).fill('test'),
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Too many parameters');
    });
  });

  describe('Transaction Support', () => {
    it('should use transaction by default', async () => {
      mockConnection.transaction = vi.fn().mockImplementation(async (fn) => {
        mockTransaction.execute.mockResolvedValue({
          rowsAffected: 1
        });
        return await fn(mockTransaction);
      });

      context.arguments = {
        query: 'INSERT INTO users (name) VALUES (?)',
        parameters: ['John']
      };

      const result = await tool.execute(context);
      
      expect(mockConnection.transaction).toHaveBeenCalled();
      expect(result.content[0].text).toContain('(with transaction)');
    });

    it('should skip transaction when useTransaction is false', async () => {
      mockConnection.execute = vi.fn().mockResolvedValue({
        rowsAffected: 1
      });

      context.arguments = {
        query: 'INSERT INTO users (name) VALUES (?)',
        parameters: ['John'],
        useTransaction: false
      };

      const result = await tool.execute(context);
      
      expect(mockConnection.transaction).not.toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalled();
      expect(result.content[0].text).not.toContain('(with transaction)');
    });

    it('should handle transaction rollback on error', async () => {
      const error = new Error('SQL constraint violation');
      mockConnection.transaction = vi.fn().mockRejectedValue(error);

      context.arguments = {
        query: 'INSERT INTO users (name) VALUES (?)',
        parameters: ['John'],
        useTransaction: true
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('SQL constraint violation');
      expect(result.content[0].text).toContain('(transaction rolled back)');
    });

    it('should use correct transaction API with parameters', async () => {
      mockConnection.transaction = vi.fn().mockImplementation(async (fn) => {
        mockTransaction.execute.mockResolvedValue({
          rowsAffected: 1
        });
        return await fn(mockTransaction);
      });

      context.arguments = {
        query: 'INSERT INTO users (name, email) VALUES (?, ?)',
        parameters: ['John Doe', 'john@example.com'],
        useTransaction: true
      };

      await tool.execute(context);
      
      expect(mockConnection.transaction).toHaveBeenCalled();
      expect(mockTransaction.execute).toHaveBeenCalledWith({
        sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
        args: ['John Doe', 'john@example.com']
      });
    });

    it('should use correct transaction API without parameters', async () => {
      mockConnection.transaction = vi.fn().mockImplementation(async (fn) => {
        mockTransaction.execute.mockResolvedValue({
          rowsAffected: 1
        });
        return await fn(mockTransaction);
      });

      context.arguments = {
        query: 'DELETE FROM users WHERE active = 0',
        useTransaction: true
      };

      await tool.execute(context);
      
      expect(mockConnection.transaction).toHaveBeenCalled();
      expect(mockTransaction.execute).toHaveBeenCalledWith('DELETE FROM users WHERE active = 0');
    });
  });

  describe('Error Handling', () => {
    it('should handle database execution errors', async () => {
      const error = new Error('Table does not exist');
      mockConnection.execute = vi.fn().mockRejectedValue(error);

      context.arguments = {
        query: 'INSERT INTO nonexistent (name) VALUES (?)',
        parameters: ['test'],
        useTransaction: false
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Table does not exist');
      expect(result.content[0].text).not.toContain('(transaction rolled back)');
    });

    it('should handle non-Error exceptions', async () => {
      mockConnection.execute = vi.fn().mockRejectedValue('String error');

      context.arguments = {
        query: 'INSERT INTO users (name) VALUES (?)',
        parameters: ['test'],
        useTransaction: false
      };

      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('String error');
    });
  });

  describe('Output Formatting', () => {
    it('should include performance metrics', async () => {
      mockConnection.execute = vi.fn().mockResolvedValue({
        rowsAffected: 2
      });

      context.arguments = {
        query: 'UPDATE users SET active = 1',
        useTransaction: false
      };

      const result = await tool.execute(context);
      
      expect(result.content[0].text).toContain('75ms, 3 affected');
    });

    it('should show last insert row ID for INSERT operations', async () => {
      mockConnection.execute = vi.fn().mockResolvedValue({
        rowsAffected: 1,
        lastInsertRowid: 456
      });

      context.arguments = {
        query: 'INSERT INTO users (name) VALUES (?)',
        parameters: ['Alice'],
        useTransaction: false
      };

      const result = await tool.execute(context);
      
      expect(result.content[0].text).toContain('Last insert row ID: 456');
    });

    it('should not show last insert row ID for UPDATE operations', async () => {
      mockConnection.execute = vi.fn().mockResolvedValue({
        rowsAffected: 1
      });

      context.arguments = {
        query: 'UPDATE users SET name = ?',
        parameters: ['Bob'],
        useTransaction: false
      };

      const result = await tool.execute(context);
      
      expect(result.content[0].text).not.toContain('Last insert row ID');
    });
  });

  describe('Parameter Handling', () => {
    it('should handle queries without parameters', async () => {
      mockConnection.execute = vi.fn().mockResolvedValue({
        rowsAffected: 3
      });

      context.arguments = {
        query: 'DELETE FROM users WHERE active = 0',
        useTransaction: false
      };

      const result = await tool.execute(context);
      
      expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM users WHERE active = 0');
      expect(result.isError).toBeUndefined();
    });

    it('should handle empty parameters array', async () => {
      mockConnection.execute = vi.fn().mockResolvedValue({
        rowsAffected: 1
      });

      context.arguments = {
        query: 'INSERT INTO users (name) VALUES (\'test\')',
        parameters: [],
        useTransaction: false
      };

      const result = await tool.execute(context);
      
      expect(mockConnection.execute).toHaveBeenCalledWith('INSERT INTO users (name) VALUES (\'test\')');
      expect(result.isError).toBeUndefined();
    });

    it('should handle various parameter types', async () => {
      mockConnection.execute = vi.fn().mockResolvedValue({
        rowsAffected: 1
      });

      context.arguments = {
        query: 'INSERT INTO users (name, age, active, notes) VALUES (?, ?, ?, ?)',
        parameters: ['John', 30, true, null],
        useTransaction: false
      };

      const result = await tool.execute(context);
      
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT INTO users (name, age, active, notes) VALUES (?, ?, ?, ?)',
        ['John', 30, true, null]
      );
      expect(result.isError).toBeUndefined();
    });
  });
});