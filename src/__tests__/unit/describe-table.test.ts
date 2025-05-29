import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DescribeTableTool } from '../../tools/describe-table.js';
import type { ToolExecutionContext } from '../../lib/base-tool.js';
import type { DatabaseConnection } from '../../types/index.js';

// Mock the performance utils
vi.mock('../../utils/performance.js', () => ({
  formatPerformanceMetrics: vi.fn(() => '15ms')
}));

describe('DescribeTableTool', () => {
  let tool: DescribeTableTool;
  let mockConnection: DatabaseConnection;
  let context: ToolExecutionContext;

  beforeEach(() => {
    tool = new DescribeTableTool();

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
      expect(tool.name).toBe('describe-table');
      expect(tool.description).toContain('comprehensive schema information');
      expect(tool.description).toContain('columns, indexes, foreign keys');
      expect(tool.description).toContain('JSON output formats');
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema).toBeDefined();
      // The schema should validate table names
      const validInput = {
        tableName: 'users',
        includeIndexes: true,
        includeForeignKeys: true,
        includeConstraints: true,
        format: 'table'
      };

      const result = tool.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should accept valid table names', () => {
      const validNames = [
        'users',
        'user_profiles',
        'UserData',
        'table123',
        '_private_table',
        '"quoted table"',
        "'single quoted'",
        '`backtick quoted`',
        '[bracket quoted]'
      ];

      validNames.forEach(tableName => {
        const result = tool.inputSchema.safeParse({ tableName });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid table names', () => {
      const invalidNames = [
        '', // Empty
        '123invalid', // Starts with number
        'table-with-dashes', // Invalid character
        'table with spaces', // Unquoted spaces
        'a'.repeat(130) // Too long
      ];

      invalidNames.forEach(tableName => {
        const result = tool.inputSchema.safeParse({ tableName });
        expect(result.success).toBe(false);
      });
    });

    it('should reject system table names', () => {
      const systemTables = [
        'sqlite_master',
        'sqlite_temp_master',
        'sqlite_sequence',
        '"sqlite_master"',
        "'sqlite_sequence'"
      ];

      systemTables.forEach(tableName => {
        const result = tool.inputSchema.safeParse({ tableName });
        expect(result.success).toBe(false);
      });
    });

    it('should apply default values correctly', () => {
      const input = { tableName: 'users' };
      const result = tool.inputSchema.parse(input);

      expect(result.includeIndexes).toBe(true);
      expect(result.includeForeignKeys).toBe(true);
      expect(result.includeConstraints).toBe(true);
      expect(result.format).toBe('table');
    });

    it('should validate format options', () => {
      const validFormats = ['table', 'json'];
      const invalidFormats = ['xml', 'csv', 'yaml'];

      validFormats.forEach(format => {
        const result = tool.inputSchema.safeParse({ tableName: 'users', format });
        expect(result.success).toBe(true);
      });

      invalidFormats.forEach(format => {
        const result = tool.inputSchema.safeParse({ tableName: 'users', format });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Query Execution', () => {
    it('should handle existing table with complete information', async () => {
      // Mock table exists
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [
            {
              name: 'users',
              sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)'
            }
          ]
        })
        // Mock table_info
        .mockResolvedValueOnce({
          rows: [
            { cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 },
            { cid: 1, name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 }
          ]
        })
        // Mock index_list
        .mockResolvedValueOnce({
          rows: [{ seq: 0, name: 'idx_users_name', unique: 1, origin: 'c', partial: 0 }]
        })
        // Mock index_info
        .mockResolvedValueOnce({
          rows: [{ seqno: 0, cid: 1, name: 'name' }]
        })
        // Mock foreign_key_list
        .mockResolvedValueOnce({
          rows: []
        });

      context.arguments = {
        tableName: 'users',
        includeIndexes: true,
        includeForeignKeys: true,
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Table: users');
      expect(result.content[0].text).toContain('CREATE TABLE users');
      expect(result.content[0].text).toContain('│ id');
      expect(result.content[0].text).toContain('│ name');
      expect(result.content[0].text).toContain('idx_users_name');
    });

    it('should handle non-existent table', async () => {
      // Mock table doesn't exist
      (mockConnection.execute as any).mockResolvedValueOnce({
        rows: []
      });

      context.arguments = {
        tableName: 'nonexistent',
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Table 'nonexistent' does not exist");
    });

    it('should return JSON format when requested', async () => {
      // Mock table exists
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'users', sql: 'CREATE TABLE users (id INTEGER)' }]
        })
        // Mock table_info
        .mockResolvedValueOnce({
          rows: [{ cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 }]
        })
        // Mock index_list
        .mockResolvedValueOnce({
          rows: []
        })
        // Mock foreign_key_list
        .mockResolvedValueOnce({
          rows: []
        });

      context.arguments = {
        tableName: 'users',
        format: 'json'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBeUndefined();
      const jsonContent = result.content[0].text as string;
      expect(() => JSON.parse(jsonContent)).not.toThrow();

      const parsed = JSON.parse(jsonContent) as any;
      expect(parsed.table.name).toBe('users');
      expect(parsed.table.columns).toHaveLength(1);
      expect(parsed.metadata.executionTime).toBeDefined();
    });

    it('should handle table with foreign keys', async () => {
      // Mock table exists
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'orders', sql: 'CREATE TABLE orders (id INTEGER, user_id INTEGER)' }]
        })
        // Mock table_info
        .mockResolvedValueOnce({
          rows: [
            { cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 },
            { cid: 1, name: 'user_id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 }
          ]
        })
        // Mock index_list
        .mockResolvedValueOnce({
          rows: []
        })
        // Mock foreign_key_list
        .mockResolvedValueOnce({
          rows: [
            {
              id: 0,
              seq: 0,
              table: 'users',
              from: 'user_id',
              to: 'id',
              on_update: 'NO ACTION',
              on_delete: 'CASCADE'
            }
          ]
        });

      context.arguments = {
        tableName: 'orders',
        includeForeignKeys: true,
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Foreign Keys:');
      expect(result.content[0].text).toContain('user_id → users.id');
    });

    it('should handle quoted table names', async () => {
      // Mock table exists
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'user profiles', sql: 'CREATE TABLE "user profiles" (id INTEGER)' }]
        })
        // Mock table_info
        .mockResolvedValueOnce({
          rows: [{ cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 }]
        })
        // Mock index_list
        .mockResolvedValueOnce({
          rows: []
        })
        // Mock foreign_key_list
        .mockResolvedValueOnce({
          rows: []
        });

      context.arguments = {
        tableName: '"user profiles"',
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Table: user profiles');
    });

    it('should skip indexes when not requested', async () => {
      // Mock table exists
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'users', sql: 'CREATE TABLE users (id INTEGER)' }]
        })
        // Mock table_info
        .mockResolvedValueOnce({
          rows: [{ cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 }]
        })
        // Mock foreign_key_list
        .mockResolvedValueOnce({
          rows: []
        });

      context.arguments = {
        tableName: 'users',
        includeIndexes: false,
        includeForeignKeys: true,
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).not.toContain('Indexes:');
      // Should not call index_list
      expect(mockConnection.execute).toHaveBeenCalledTimes(3); // exists, table_info, foreign_key_list
    });

    it('should skip foreign keys when not requested', async () => {
      // Mock table exists
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'users', sql: 'CREATE TABLE users (id INTEGER)' }]
        })
        // Mock table_info
        .mockResolvedValueOnce({
          rows: [{ cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 }]
        })
        // Mock index_list
        .mockResolvedValueOnce({
          rows: []
        });

      context.arguments = {
        tableName: 'users',
        includeIndexes: true,
        includeForeignKeys: false,
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).not.toContain('Foreign Keys:');
      // Should not call foreign_key_list
      expect(mockConnection.execute).toHaveBeenCalledTimes(3); // exists, table_info, index_list
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const error = new Error('Database connection failed');
      (mockConnection.execute as any).mockRejectedValue(error);

      context.arguments = {
        tableName: 'users',
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Error describing table: Database connection failed'
      );
    });

    it('should handle PRAGMA query errors gracefully', async () => {
      // Mock table exists
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'users', sql: 'CREATE TABLE users (id INTEGER)' }]
        })
        // Mock table_info failure
        .mockRejectedValueOnce(new Error('PRAGMA error'));

      context.arguments = {
        tableName: 'users',
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error describing table');
    });
  });

  describe('Output Formatting', () => {
    it('should include performance metrics in output', async () => {
      // Mock table exists
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'users', sql: 'CREATE TABLE users (id INTEGER)' }]
        })
        // Mock table_info
        .mockResolvedValueOnce({
          rows: [{ cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 }]
        })
        // Mock index_list
        .mockResolvedValueOnce({
          rows: []
        })
        // Mock foreign_key_list
        .mockResolvedValueOnce({
          rows: []
        });

      context.arguments = {
        tableName: 'users',
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('15ms'); // Mocked performance metrics
    });

    it('should format table output with proper borders', async () => {
      // Mock table exists
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'users', sql: 'CREATE TABLE users (id INTEGER, name TEXT)' }]
        })
        // Mock table_info
        .mockResolvedValueOnce({
          rows: [
            { cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 },
            { cid: 1, name: 'name', type: 'TEXT', notnull: 1, dflt_value: 'Unknown', pk: 0 }
          ]
        })
        // Mock index_list
        .mockResolvedValueOnce({
          rows: []
        })
        // Mock foreign_key_list
        .mockResolvedValueOnce({
          rows: []
        });

      context.arguments = {
        tableName: 'users',
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain(
        '┌─────────────────┬─────────────────┬─────────┬─────────────┬─────────────┐'
      );
      expect(result.content[0].text).toContain(
        '│ Name            │ Type            │ Not Null│ Default     │ Primary Key │'
      );
      expect(result.content[0].text).toContain(
        '└─────────────────┴─────────────────┴─────────┴─────────────┴─────────────┘'
      );
    });
  });
});
