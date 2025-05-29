import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ListTablesTool } from '../../tools/list-tables.js';
import type { ToolExecutionContext } from '../../lib/base-tool.js';
import type { DatabaseConnection } from '../../types/index.js';

// Mock the performance utils
vi.mock('../../utils/performance.js', () => ({
  formatPerformanceMetrics: vi.fn(() => '20ms, 3 objects')
}));

describe('ListTablesTool', () => {
  let tool: ListTablesTool;
  let mockConnection: DatabaseConnection;
  let context: ToolExecutionContext;

  beforeEach(() => {
    tool = new ListTablesTool();

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
      expect(tool.name).toBe('list-tables');
      expect(tool.description).toContain('tables, views, and indexes');
      expect(tool.description).toContain('optional filtering');
      expect(tool.description).toContain('multiple output formats');
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema).toBeDefined();
      // The schema should validate the options
      const validInput = {
        includeSystemTables: false,
        includeViews: true,
        includeIndexes: true,
        includeDetails: false,
        pattern: 'user%',
        format: 'table'
      };

      const result = tool.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should apply default values correctly', () => {
      const input = {};
      const result = tool.inputSchema.parse(input);

      expect(result.includeSystemTables).toBe(false);
      expect(result.includeViews).toBe(false);
      expect(result.includeIndexes).toBe(false);
      expect(result.includeDetails).toBe(false);
      expect(result.pattern).toBeUndefined();
      expect(result.format).toBe('list');
    });

    it('should validate format options', () => {
      const validFormats = ['table', 'json', 'list'];
      const invalidFormats = ['xml', 'csv', 'yaml'];

      validFormats.forEach(format => {
        const result = tool.inputSchema.safeParse({ format });
        expect(result.success).toBe(true);
      });

      invalidFormats.forEach(format => {
        const result = tool.inputSchema.safeParse({ format });
        expect(result.success).toBe(false);
      });
    });

    it('should accept valid patterns', () => {
      const validPatterns = ['user%', '%_temp', 'prefix_%_suffix', 'exact_name', undefined];

      validPatterns.forEach(pattern => {
        const result = tool.inputSchema.safeParse({ pattern });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Query Execution', () => {
    it('should list tables only by default', async () => {
      // Mock query result
      (mockConnection.execute as any).mockResolvedValue({
        rows: [
          { name: 'users', type: 'table', sql: 'CREATE TABLE users (id INTEGER)' },
          { name: 'products', type: 'table', sql: 'CREATE TABLE products (id INTEGER)' }
        ]
      });

      context.arguments = {};

      const result = await tool.execute(context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('TABLES (2):');
      expect(result.content[0].text).toContain('- users');
      expect(result.content[0].text).toContain('- products');
      expect(result.content[0].text).not.toContain('VIEWS');
      expect(result.content[0].text).not.toContain('INDEXES');
    });

    it('should include system tables when requested', async () => {
      // Mock query result with system tables
      (mockConnection.execute as any).mockResolvedValue({
        rows: [
          { name: 'users', type: 'table', sql: 'CREATE TABLE users (id INTEGER)' },
          { name: 'sqlite_master', type: 'table', sql: 'CREATE TABLE sqlite_master (...)' }
        ]
      });

      context.arguments = {
        includeSystemTables: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('sqlite_master');

      // Check that the query doesn't exclude system tables
      const queryCall = (mockConnection.execute as any).mock.calls[0];
      expect(queryCall[0]).not.toContain("name NOT LIKE 'sqlite_%'");
    });

    it('should include views when requested', async () => {
      // Mock query result with views
      (mockConnection.execute as any).mockResolvedValue({
        rows: [
          { name: 'users', type: 'table', sql: 'CREATE TABLE users (id INTEGER)' },
          { name: 'user_view', type: 'view', sql: 'CREATE VIEW user_view AS SELECT * FROM users' }
        ]
      });

      context.arguments = {
        includeViews: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('VIEWS (1):');
      expect(result.content[0].text).toContain('- user_view');
    });

    it('should include indexes when requested', async () => {
      // Mock query result with indexes
      (mockConnection.execute as any).mockResolvedValue({
        rows: [
          { name: 'users', type: 'table', sql: 'CREATE TABLE users (id INTEGER)' },
          {
            name: 'idx_users_name',
            type: 'index',
            sql: 'CREATE INDEX idx_users_name ON users(name)'
          }
        ]
      });

      context.arguments = {
        includeIndexes: true
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('INDEXES (1):');
      expect(result.content[0].text).toContain('- idx_users_name');
    });

    it('should filter by pattern when provided', async () => {
      // Mock query result
      (mockConnection.execute as any).mockResolvedValue({
        rows: [
          { name: 'user_profiles', type: 'table', sql: 'CREATE TABLE user_profiles (id INTEGER)' },
          { name: 'user_sessions', type: 'table', sql: 'CREATE TABLE user_sessions (id INTEGER)' }
        ]
      });

      context.arguments = {
        pattern: 'user%'
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('user_profiles');
      expect(result.content[0].text).toContain('user_sessions');

      // Check that the query includes the pattern
      const queryCall = (mockConnection.execute as any).mock.calls[0];
      expect(queryCall[0]).toContain('name LIKE ?');
      expect(queryCall[1]).toContain('user%');
    });

    it('should return JSON format when requested', async () => {
      // Mock query result
      (mockConnection.execute as any).mockResolvedValue({
        rows: [{ name: 'users', type: 'table', sql: 'CREATE TABLE users (id INTEGER)' }]
      });

      context.arguments = {
        format: 'json'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBeUndefined();
      const jsonContent = result.content[0].text as string;
      expect(() => JSON.parse(jsonContent)).not.toThrow();

      const parsed = JSON.parse(jsonContent) as any;
      expect(parsed.objects).toHaveLength(1);
      expect(parsed.objects[0].name).toBe('users');
      expect(parsed.metadata.totalCount).toBe(1);
      expect(parsed.metadata.executionTime).toBeDefined();
    });

    it('should return table format with details', async () => {
      // Mock main query
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [
            {
              name: 'users',
              type: 'table',
              sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
            },
            {
              name: 'products',
              type: 'table',
              sql: 'CREATE TABLE products (id INTEGER, name TEXT)'
            }
          ]
        })
        // Mock row count queries
        .mockResolvedValueOnce({
          rows: [{ count: 150 }]
        })
        // Mock column count queries
        .mockResolvedValueOnce({
          rows: [
            { cid: 0, name: 'id', type: 'INTEGER' },
            { cid: 1, name: 'name', type: 'TEXT' }
          ]
        })
        // Mock row count for second table
        .mockResolvedValueOnce({
          rows: [{ count: 75 }]
        })
        // Mock column count for second table
        .mockResolvedValueOnce({
          rows: [
            { cid: 0, name: 'id', type: 'INTEGER' },
            { cid: 1, name: 'name', type: 'TEXT' }
          ]
        });

      context.arguments = {
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('Database Schema Objects:');
      expect(result.content[0].text).toContain(
        '┌─────────────────────┬─────────┬───────┬─────────┬──────────────────────────────────────┐'
      );
      expect(result.content[0].text).toContain(
        '│ Name                │ Type    │ Rows  │ Columns │ Description                          │'
      );
      expect(result.content[0].text).toContain('users');
      expect(result.content[0].text).toContain('products');
      expect(result.content[0].text).toContain('Summary: 2 tables, 0 views, 0 indexes');
    });

    it('should handle empty database', async () => {
      // Mock empty result
      (mockConnection.execute as any).mockResolvedValue({
        rows: []
      });

      context.arguments = {};

      const result = await tool.execute(context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No objects found matching the criteria');
    });

    it('should include row counts when available', async () => {
      // Mock main query
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'users', type: 'table', sql: 'CREATE TABLE users (id INTEGER)' }]
        })
        // Mock row count query
        .mockResolvedValueOnce({
          rows: [{ count: 42 }]
        })
        // Mock column count query
        .mockResolvedValueOnce({
          rows: [{ cid: 0, name: 'id', type: 'INTEGER' }]
        });

      context.arguments = {
        format: 'list'
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('- users (42 rows)');
    });

    it('should handle errors in row count queries gracefully', async () => {
      // Mock main query
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'users', type: 'table', sql: 'CREATE TABLE users (id INTEGER)' }]
        })
        // Mock row count query failure
        .mockRejectedValueOnce(new Error('Permission denied'))
        // Mock column count query failure
        .mockRejectedValueOnce(new Error('Permission denied'));

      context.arguments = {
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('users');
      // Should show N/A for counts when queries fail
      expect(result.content[0].text).toContain('N/A');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const error = new Error('Database connection failed');
      (mockConnection.execute as any).mockRejectedValue(error);

      context.arguments = {};

      const result = await tool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Error listing database objects: Database connection failed'
      );
    });

    it('should handle SQL errors gracefully', async () => {
      const error = new Error('SQL syntax error');
      (mockConnection.execute as any).mockRejectedValue(error);

      context.arguments = {
        pattern: 'invalid[pattern'
      };

      const result = await tool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error listing database objects');
    });
  });

  describe('Output Formatting', () => {
    it('should include performance metrics in output', async () => {
      // Mock query result
      (mockConnection.execute as any).mockResolvedValue({
        rows: [{ name: 'users', type: 'table', sql: 'CREATE TABLE users (id INTEGER)' }]
      });

      context.arguments = {};

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('20ms, 3 objects'); // Mocked performance metrics
    });

    it('should group objects by type in list format', async () => {
      // Mock query result with mixed types
      (mockConnection.execute as any).mockResolvedValue({
        rows: [
          { name: 'users', type: 'table', sql: 'CREATE TABLE users (id INTEGER)' },
          { name: 'products', type: 'table', sql: 'CREATE TABLE products (id INTEGER)' },
          { name: 'user_view', type: 'view', sql: 'CREATE VIEW user_view AS SELECT * FROM users' },
          { name: 'idx_users', type: 'index', sql: 'CREATE INDEX idx_users ON users(name)' }
        ]
      });

      context.arguments = {
        includeViews: true,
        includeIndexes: true,
        format: 'list'
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('TABLES (2):');
      expect(result.content[0].text).toContain('VIEWS (1):');
      expect(result.content[0].text).toContain('INDEXES (1):');
    });

    it('should extract descriptions from SQL in table format', async () => {
      // Mock main query with complex SQL
      (mockConnection.execute as any)
        .mockResolvedValueOnce({
          rows: [
            {
              name: 'users',
              type: 'table',
              sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE)'
            }
          ]
        })
        // Mock row count
        .mockResolvedValueOnce({
          rows: [{ count: 10 }]
        })
        // Mock column count
        .mockResolvedValueOnce({
          rows: [
            { cid: 0, name: 'id', type: 'INTEGER' },
            { cid: 1, name: 'name', type: 'TEXT' },
            { cid: 2, name: 'email', type: 'TEXT' }
          ]
        });

      context.arguments = {
        format: 'table'
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain('CREATE TABLE users');
    });

    it('should handle very long table names gracefully', async () => {
      const longTableName = 'very_long_table_name_that_exceeds_normal_length';

      // Mock query result
      (mockConnection.execute as any).mockResolvedValue({
        rows: [
          { name: longTableName, type: 'table', sql: `CREATE TABLE ${longTableName} (id INTEGER)` }
        ]
      });

      context.arguments = {
        format: 'list'
      };

      const result = await tool.execute(context);

      expect(result.content[0].text).toContain(longTableName);
    });
  });

  describe('Advanced Features', () => {
    it('should handle all options together', async () => {
      // Mock query result with all types and system tables
      (mockConnection.execute as any).mockResolvedValue({
        rows: [
          { name: 'user_profiles', type: 'table', sql: 'CREATE TABLE user_profiles (id INTEGER)' },
          {
            name: 'user_view',
            type: 'view',
            sql: 'CREATE VIEW user_view AS SELECT * FROM user_profiles'
          },
          {
            name: 'idx_user_profiles',
            type: 'index',
            sql: 'CREATE INDEX idx_user_profiles ON user_profiles(name)'
          },
          { name: 'sqlite_master', type: 'table', sql: 'CREATE TABLE sqlite_master (...)' }
        ]
      });

      context.arguments = {
        includeSystemTables: true,
        includeViews: true,
        includeIndexes: true,
        pattern: '%user%',
        format: 'json'
      };

      const result = await tool.execute(context);

      const parsed = JSON.parse(result.content[0].text as string) as any;
      expect(parsed.objects).toHaveLength(4);
      expect(parsed.metadata.filters.includeSystemTables).toBe(true);
      expect(parsed.metadata.filters.includeViews).toBe(true);
      expect(parsed.metadata.filters.includeIndexes).toBe(true);
      expect(parsed.metadata.filters.pattern).toBe('%user%');
    });
  });
});
