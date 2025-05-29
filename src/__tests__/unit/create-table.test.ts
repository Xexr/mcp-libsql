import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreateTableTool } from '../../tools/create-table.js';
import type { ToolExecutionContext } from '../../lib/base-tool.js';
import type { DatabaseConnection } from '../../types/index.js';

// Mock the performance utils
vi.mock('../../utils/performance.js', () => ({
  formatPerformanceMetrics: vi.fn(() => '25ms, 1 affected')
}));

describe('CreateTableTool', () => {
  let tool: CreateTableTool;
  let mockConnection: DatabaseConnection;
  let mockTransaction: any;
  let context: ToolExecutionContext;

  beforeEach(() => {
    tool = new CreateTableTool();

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
      expect(tool.name).toBe('create-table');
      expect(tool.description).toContain('CREATE TABLE DDL');
      expect(tool.description).toContain('IF NOT EXISTS');
      expect(tool.description).toContain('transaction support');
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema).toBeDefined();
      // The schema should validate CREATE TABLE statements
      const validInput = {
        query: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
        parameters: [],
        useTransaction: true,
        ifNotExists: false
      };

      const result = tool.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should accept valid CREATE TABLE statement', () => {
      const validQueries = [
        'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
        'CREATE TABLE IF NOT EXISTS products (id INT, name VARCHAR(100))',
        'CREATE TABLE orders (id BIGINT PRIMARY KEY, user_id INT, total DECIMAL(10,2))',
        'CREATE TABLE "user_profiles" (user_id INT, data JSON)'
      ];

      validQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(true);
      });
    });

    it('should reject non-CREATE TABLE statements', () => {
      const invalidQueries = [
        'SELECT * FROM users',
        'INSERT INTO users VALUES (1, "test")',
        'UPDATE users SET name = "test"',
        'DELETE FROM users',
        'DROP TABLE users',
        'CREATE VIEW user_view AS SELECT * FROM users'
      ];

      invalidQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(false);
      });
    });

    it('should reject queries with prohibited operations', () => {
      const prohibitedQueries = [
        'CREATE TABLE users (id INT); DROP TABLE sensitive;',
        'CREATE TABLE users (id INT) PRAGMA table_info(users)',
        'CREATE TABLE users (id INT); DELETE FROM sqlite_master;',
        'CREATE TABLE users (id INT); ATTACH DATABASE "other.db" AS other;'
      ];

      prohibitedQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(false);
      });
    });

    it('should reject queries accessing system tables', () => {
      const systemTableQueries = [
        'CREATE TABLE users AS SELECT * FROM sqlite_master',
        'CREATE TABLE test (id INT) FROM sqlite_sequence',
        'CREATE TABLE backup_master AS SELECT * FROM sqlite_temp_master'
      ];

      systemTableQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(false);
      });
    });

    it('should reject malformed CREATE TABLE statements', () => {
      const malformedQueries = [
        'CREATE TABLE users', // No column definitions
        'CREATE TABLE users (', // Unbalanced parentheses
        'CREATE TABLE users id INT)', // Missing opening parenthesis
        'CREATE TABLE', // No table name or columns
        '' // Empty query
      ];

      malformedQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(false);
      });
    });

    it('should apply default values correctly', () => {
      const input = { query: 'CREATE TABLE users (id INTEGER, name TEXT)' };
      const result = tool.inputSchema.parse(input);

      expect(result.parameters).toEqual([]);
      expect(result.useTransaction).toBe(true);
      expect(result.ifNotExists).toBe(false);
    });

    it('should validate parameter limits', () => {
      const tooManyParams = Array(101).fill('test');
      const result = tool.inputSchema.safeParse({
        query: 'CREATE TABLE users (id INTEGER, name TEXT)',
        parameters: tooManyParams
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Too many parameters');
      }
    });
  });

  describe('Query Execution', () => {
    it('should execute CREATE TABLE with transaction by default', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(mockConnection.transaction).toHaveBeenCalledOnce();
      expect(mockTransaction.execute).toHaveBeenCalledWith(
        'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
      );
      expect(result.content[0].text).toContain('Table created successfully (with transaction)');
      expect(result.content[0].text).toContain('Table name: users');
    });

    it('should execute CREATE TABLE without transaction when disabled', async () => {
      const mockResult = { rowsAffected: 1 };
      (mockConnection.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'CREATE TABLE products (id INTEGER, name TEXT)',
        useTransaction: false
      };

      const result = await tool.execute(context);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'CREATE TABLE products (id INTEGER, name TEXT)'
      );
      expect(mockConnection.transaction).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Table created successfully');
      expect(result.content[0].text).not.toContain('(with transaction)');
    });

    it('should execute CREATE TABLE with parameters', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'CREATE TABLE dynamic_table (id INTEGER, data TEXT)',
        parameters: ['test_value'],
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(mockTransaction.execute).toHaveBeenCalledWith({
        sql: 'CREATE TABLE dynamic_table (id INTEGER, data TEXT)',
        args: ['test_value']
      });
      expect(result.content[0].text).toContain('Table created successfully');
    });

    it('should automatically add IF NOT EXISTS when requested', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'CREATE TABLE users (id INTEGER, name TEXT)',
        ifNotExists: true,
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(mockTransaction.execute).toHaveBeenCalledWith(
        'CREATE TABLE IF NOT EXISTS users (id INTEGER, name TEXT)'
      );
      expect(result.content[0].text).toContain('Added IF NOT EXISTS clause');
    });

    it('should not duplicate IF NOT EXISTS clause', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      context.arguments = {
        query: 'CREATE TABLE IF NOT EXISTS users (id INTEGER, name TEXT)',
        ifNotExists: true,
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(mockTransaction.execute).toHaveBeenCalledWith(
        'CREATE TABLE IF NOT EXISTS users (id INTEGER, name TEXT)'
      );
      expect(result.content[0].text).not.toContain('Added IF NOT EXISTS clause');
    });
  });

  describe('Error Handling', () => {
    it('should handle database execution errors with transaction', async () => {
      const error = new Error('Table already exists');
      (mockConnection.transaction as any) = vi.fn().mockRejectedValue(error);

      context.arguments = {
        query: 'CREATE TABLE users (id INTEGER, name TEXT)',
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Error creating table: Table already exists (transaction rolled back)'
      );
    });

    it('should handle database execution errors without transaction', async () => {
      const error = new Error('Database connection failed');
      (mockConnection.execute as any).mockRejectedValue(error);

      context.arguments = {
        query: 'CREATE TABLE users (id INTEGER, name TEXT)',
        useTransaction: false
      };

      const result = await tool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error creating table: Database connection failed');
      expect(result.content[0].text).not.toContain('transaction rolled back');
    });

    it('should handle schema validation errors for malformed queries', async () => {
      // This should be caught by input validation before execution
      const invalidInput = {
        query: 'CREATE TABLE users (id INTEGER, name TEXT) DROP TABLE sensitive',
        useTransaction: true
      };

      const validationResult = tool.inputSchema.safeParse(invalidInput);
      expect(validationResult.success).toBe(false);

      if (!validationResult.success) {
        expect(validationResult.error.issues[0].message).toContain('prohibited operations');
      }
    });

    it('should handle schema validation errors for unbalanced parentheses', async () => {
      // This should be caught by input validation
      const invalidInput = {
        query: 'CREATE TABLE users (id INTEGER, name TEXT', // Missing closing parenthesis
        useTransaction: true
      };

      const validationResult = tool.inputSchema.safeParse(invalidInput);
      expect(validationResult.success).toBe(false);

      if (!validationResult.success) {
        expect(validationResult.error.issues[0].message).toContain('Invalid CREATE TABLE syntax');
      }
    });

    it('should handle runtime validation errors during execution', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      // Bypass schema validation by manually calling executeImpl
      context.arguments = {
        query: 'CREATE TABLE test (id INT) TRIGGER bad_trigger', // Should fail runtime validation
        useTransaction: true
      };

      // @ts-ignore - accessing protected method for testing
      const result = await tool.executeImpl(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error creating table:');
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
        query: 'CREATE TABLE users (id INTEGER, name TEXT)',
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('25ms, 1 affected'); // Mocked performance metrics
    });

    it('should extract and display table name correctly', async () => {
      const testCases = [
        { query: 'CREATE TABLE users (id INTEGER)', expected: 'users' },
        { query: 'CREATE TABLE "user_profiles" (id INTEGER)', expected: 'user_profiles' },
        { query: 'CREATE TABLE `orders` (id INTEGER)', expected: 'orders' },
        { query: 'CREATE TABLE [products] (id INTEGER)', expected: 'products' },
        { query: 'CREATE TABLE IF NOT EXISTS customers (id INTEGER)', expected: 'customers' }
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

        expect(result.content[0].text).toContain(`Table name: ${testCase.expected}`);
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
        query: 'CREATE TABLE users (id INTEGER, name TEXT)',
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('Rows affected: 1');
    });
  });

  describe('Complex Query Scenarios', () => {
    it('should handle CREATE TABLE with complex column definitions', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      const complexQuery = `
        CREATE TABLE complex_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER CHECK(age >= 0),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          data JSON,
          FOREIGN KEY (id) REFERENCES users(id)
        )
      `;

      context.arguments = {
        query: complexQuery,
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('Table created successfully');
      expect(result.content[0].text).toContain('Table name: complex_table');
    });

    it('should handle CREATE TABLE with various data types', async () => {
      const mockResult = { rowsAffected: 1 };
      mockConnection.transaction = vi.fn(async callback => {
        return await callback(mockTransaction);
      });
      (mockTransaction.execute as any).mockResolvedValue(mockResult);

      const dataTypesQuery = `
        CREATE TABLE data_types_test (
          int_col INTEGER,
          text_col TEXT,
          real_col REAL,
          blob_col BLOB,
          numeric_col NUMERIC,
          varchar_col VARCHAR(255),
          decimal_col DECIMAL(10,2),
          bool_col BOOLEAN,
          date_col DATE,
          datetime_col DATETIME,
          timestamp_col TIMESTAMP
        )
      `;

      context.arguments = {
        query: dataTypesQuery,
        useTransaction: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('Table created successfully');
      expect(result.content[0].text).toContain('Table name: data_types_test');
    });
  });
});
