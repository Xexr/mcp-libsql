import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AlterTableTool } from '../../tools/alter-table.js';
import type { ToolExecutionContext } from '../../lib/base-tool.js';
import type { DatabaseConnection } from '../../types/index.js';

// Mock the performance utils
vi.mock('../../utils/performance.js', () => ({
  formatPerformanceMetrics: vi.fn(() => '25ms, 1 affected')
}));

describe('AlterTableTool', () => {
  let tool: AlterTableTool;
  let mockConnection: DatabaseConnection;
  let mockTransaction: any;
  let context: ToolExecutionContext;

  beforeEach(() => {
    tool = new AlterTableTool();

    mockTransaction = {
      execute: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn()
    };

    mockConnection = {
      execute: vi.fn() as any,
      transaction: vi.fn() as any,
      close: vi.fn() as any,
      isHealthy: vi.fn() as any
    } as DatabaseConnection;

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
      expect(tool.name).toBe('alter-table');
      expect(tool.description).toContain('ALTER TABLE DDL');
      expect(tool.description).toContain('adding columns');
      expect(tool.description).toContain('transaction support');
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema).toBeDefined();
      // The schema should validate ALTER TABLE statements
      const validInput = {
        query: 'ALTER TABLE users ADD COLUMN email TEXT',
        parameters: [],
        useTransaction: true,
        ifExists: false
      };

      const result = tool.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should accept valid ALTER TABLE statements', () => {
      const validQueries = [
        'ALTER TABLE users ADD COLUMN email TEXT',
        'ALTER TABLE products ADD age INTEGER DEFAULT 0',
        'ALTER TABLE orders RENAME TO customer_orders',
        'ALTER TABLE users RENAME COLUMN name TO full_name',
        'ALTER TABLE products DROP COLUMN description'
      ];

      validQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(true);
      });
    });

    it('should reject non-ALTER TABLE statements', () => {
      const invalidQueries = [
        'SELECT * FROM users',
        'INSERT INTO users VALUES (1, "test")',
        'UPDATE users SET name = "test"',
        'DELETE FROM users',
        'DROP TABLE users',
        'CREATE TABLE users (id INTEGER)'
      ];

      invalidQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(false);
      });
    });

    it('should reject queries with prohibited operations', () => {
      const prohibitedQueries = [
        'ALTER TABLE users ADD COLUMN email TEXT; DROP TABLE sensitive;',
        'ALTER TABLE users ADD COLUMN age INT; PRAGMA table_info(users)',
        'ALTER TABLE users ADD COLUMN data TEXT; DELETE FROM sqlite_master;',
        'ALTER TABLE users ADD COLUMN info TEXT; ATTACH DATABASE "other.db" AS other;'
      ];

      prohibitedQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(false);
      });
    });

    it('should reject queries accessing system tables', () => {
      const systemTableQueries = [
        'ALTER TABLE sqlite_master ADD COLUMN test TEXT',
        'ALTER TABLE sqlite_sequence RENAME TO backup_sequence',
        'ALTER TABLE sqlite_temp_master ADD COLUMN backup TEXT'
      ];

      systemTableQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(false);
      });
    });

    it('should reject malformed ALTER TABLE statements', () => {
      const malformedQueries = [
        'ALTER TABLE', // No table name or operation
        'ALTER TABLE users', // No operation
        'ALTER TABLE users ADD', // Incomplete ADD operation
        'ALTER TABLE users RENAME', // Incomplete RENAME operation
        '' // Empty query
      ];

      malformedQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(false);
      });
    });

    it('should apply default values correctly', () => {
      const input = { query: 'ALTER TABLE users ADD COLUMN email TEXT' };
      const result = tool.inputSchema.parse(input);

      expect(result.parameters).toEqual([]);
      expect(result.useTransaction).toBe(true);
      expect(result.ifExists).toBe(false);
    });

    it('should validate parameter limits', () => {
      const tooManyParams = Array(101).fill('test');
      const result = tool.inputSchema.safeParse({
        query: 'ALTER TABLE users ADD COLUMN email TEXT',
        parameters: tooManyParams
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Too many parameters');
      }
    });
  });

  describe('Query Execution', () => {
    it('should execute ALTER TABLE with transaction by default', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'ALTER TABLE users ADD COLUMN email TEXT',
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(mockConnection.transaction).toHaveBeenCalledOnce();
      expect(mockTransaction.execute).toHaveBeenCalledWith(
        'ALTER TABLE users ADD COLUMN email TEXT'
      );
      expect(result.content[0].text).toContain('Table altered successfully (with transaction)');
      expect(result.content[0].text).toContain('Table: users');
      expect(result.content[0].text).toContain('Operation: ADD COLUMN');
    });

    it('should execute ALTER TABLE without transaction when disabled', async () => {
      const mockResult = { rowsAffected: 1 };
      (mockConnection.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'ALTER TABLE products RENAME TO items',
        useTransaction: false
      };

      const result = await tool.execute(context);

      expect(mockConnection.execute).toHaveBeenCalledWith('ALTER TABLE products RENAME TO items');
      expect(mockConnection.transaction).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Table altered successfully');
      expect(result.content[0].text).not.toContain('(with transaction)');
      expect(result.content[0].text).toContain('Table: products');
      expect(result.content[0].text).toContain('Operation: RENAME TABLE');
    });

    it('should execute ALTER TABLE with parameters', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'ALTER TABLE users ADD COLUMN data TEXT DEFAULT ?',
        parameters: ['default_value'],
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(mockTransaction.execute).toHaveBeenCalledWith({
        sql: 'ALTER TABLE users ADD COLUMN data TEXT DEFAULT ?',
        args: ['default_value']
      });
      expect(result.content[0].text).toContain('Table altered successfully');
    });

    it('should handle RENAME COLUMN operation', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'ALTER TABLE users RENAME COLUMN name TO full_name',
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('Operation: RENAME COLUMN');
      expect(result.content[0].text).toContain('Table: users');
    });

    it('should handle DROP COLUMN operation', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'ALTER TABLE products DROP COLUMN old_field',
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('Operation: DROP COLUMN');
      expect(result.content[0].text).toContain('Table: products');
    });

    it('should note SQLite limitation for DROP COLUMN with ifExists', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'ALTER TABLE users DROP COLUMN temp_field',
        ifExists: true,
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('SQLite does not support IF EXISTS for DROP COLUMN');
    });
  });

  describe('Error Handling', () => {
    it('should handle database execution errors with transaction', async () => {
      const error = new Error('Column already exists');
      (mockConnection.transaction as any) = vi.fn().mockRejectedValue(error);

      context.arguments = {
        query: 'ALTER TABLE users ADD COLUMN email TEXT',
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Error altering table: Column already exists (transaction rolled back)'
      );
    });

    it('should handle database execution errors without transaction', async () => {
      const error = new Error('Database connection failed');
      (mockConnection.execute as any).mockRejectedValue(error);

      context.arguments = {
        query: 'ALTER TABLE users ADD COLUMN email TEXT',
        useTransaction: false
      };

      const result = await tool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error altering table: Database connection failed');
      expect(result.content[0].text).not.toContain('transaction rolled back');
    });

    it('should handle runtime validation errors during execution', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      // Bypass schema validation by manually calling executeImpl
      context.arguments = {
        query: 'ALTER TABLE test ADD COLUMN col1 TEXT TRIGGER bad_trigger', // Should fail runtime validation
        useTransaction: true
      };

      // @ts-ignore - accessing protected method for testing
      const result = await tool.executeImpl(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error altering table:');
      expect(result.content[0].text).toContain('TRIGGER');
    });
  });

  describe('Output Formatting', () => {
    it('should include performance metrics in output', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'ALTER TABLE users ADD COLUMN email TEXT',
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('25ms, 1 affected'); // Mocked performance metrics
    });

    it('should extract and display table information correctly', async () => {
      const testCases = [
        {
          query: 'ALTER TABLE users ADD COLUMN email TEXT',
          expectedTable: 'users',
          expectedOperation: 'ADD COLUMN'
        },
        {
          query: 'ALTER TABLE "user_profiles" RENAME TO profiles',
          expectedTable: 'user_profiles',
          expectedOperation: 'RENAME TABLE'
        },
        {
          query: 'ALTER TABLE `orders` RENAME COLUMN status TO order_status',
          expectedTable: 'orders',
          expectedOperation: 'RENAME COLUMN'
        },
        {
          query: 'ALTER TABLE [products] DROP COLUMN old_field',
          expectedTable: 'products',
          expectedOperation: 'DROP COLUMN'
        }
      ];

      for (const testCase of testCases) {
        const mockResult = { rowsAffected: 1 };
        mockConnection.transaction = vi.fn(async callback => {
          return await callback(mockTransaction);
        });
        (mockTransaction.execute as any).mockResolvedValue(mockResult);

        context.arguments = {
          query: testCase.query,
          useTransaction: true
        };

        const result = await tool.execute(context);

        expect(result.content[0].text).toContain(`Table: ${testCase.expectedTable}`);
        expect(result.content[0].text).toContain(`Operation: ${testCase.expectedOperation}`);
        vi.clearAllMocks();
      }
    });

    it('should include rows affected in output when available', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'ALTER TABLE users ADD COLUMN email TEXT',
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('Rows affected: 1');
    });
  });
});
