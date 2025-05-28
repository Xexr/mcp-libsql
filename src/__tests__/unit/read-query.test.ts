import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReadQueryTool } from '../../tools/read-query.js';
import type { ToolExecutionContext } from '../../lib/base-tool.js';
import type { LibSQLConnection } from '../../lib/database.js';
import { DEFAULT_CONFIG } from '../../lib/constants.js';

// Mock the performance utils
vi.mock('../../utils/performance.js', () => ({
  formatPerformanceMetrics: vi.fn(() => '150ms, 5 returned')
}));

describe('ReadQueryTool', () => {
  let tool: ReadQueryTool;
  let mockConnection: LibSQLConnection;
  let context: ToolExecutionContext;

  beforeEach(() => {
    tool = new ReadQueryTool();
    mockConnection = {
      execute: vi.fn()
    } as any;
    
    context = {
      connection: mockConnection,
      arguments: {}
    } as ToolExecutionContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('tool metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('read-query');
      expect(tool.description).toBe('Execute SELECT queries on the libSQL database');
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('input validation', () => {
    it('should validate SELECT queries successfully', () => {
      const validInput = { query: 'SELECT * FROM users' };
      const result = tool.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept parameterized queries', () => {
      const validInput = { 
        query: 'SELECT * FROM users WHERE id = ?',
        parameters: [1]
      };
      const result = tool.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject empty queries', () => {
      const invalidInput = { query: '' };
      const result = tool.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject non-SELECT queries', () => {
      const invalidInput = { query: 'DELETE FROM users' };
      const result = tool.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject queries with dangerous operations', () => {
      const dangerousQueries = [
        'SELECT * FROM users; DROP TABLE users;',
        'SELECT * FROM pragma_table_info("users")',
        'SELECT * FROM users WHERE id = 1 UNION INSERT INTO users VALUES (1)',
      ];

      dangerousQueries.forEach(query => {
        const result = tool.inputSchema.safeParse({ query });
        expect(result.success).toBe(false);
      });
    });

    it('should reject queries that are too long', () => {
      const longQuery = 'SELECT ' + 'a'.repeat(10000) + ' FROM users';
      const result = tool.inputSchema.safeParse({ query: longQuery });
      expect(result.success).toBe(false);
    });

    it('should reject too many parameters', () => {
      const tooManyParams = Array(101).fill(1);
      const result = tool.inputSchema.safeParse({ 
        query: 'SELECT * FROM users',
        parameters: tooManyParams
      });
      expect(result.success).toBe(false);
    });
  });

  describe('query execution', () => {
    it('should execute simple SELECT query successfully', async () => {
      const mockResult = {
        rows: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ],
        columns: ['id', 'name', 'email'],
        rowsAffected: 0
      };

      mockConnection.execute = vi.fn().mockResolvedValue(mockResult);
      
      context.arguments = { query: 'SELECT * FROM users' };
      
      const result = await tool.execute(context);
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Query executed successfully');
      expect(result.content[0].text).toContain('Found 2 row(s)');
      expect(result.content[0].text).toContain('John');
      expect(result.content[0].text).toContain('jane@example.com');
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT * FROM users');
    });

    it('should execute parameterized query successfully', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'John' }],
        columns: ['id', 'name'],
        rowsAffected: 0
      };

      mockConnection.execute = vi.fn().mockResolvedValue(mockResult);
      
      context.arguments = { 
        query: 'SELECT * FROM users WHERE id = ?',
        parameters: [1]
      };
      
      const result = await tool.execute(context);
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Parameters: 1 parameter(s) used');
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
    });

    it('should handle empty result sets', async () => {
      const mockResult = {
        rows: [],
        columns: ['id', 'name'],
        rowsAffected: 0
      };

      mockConnection.execute = vi.fn().mockResolvedValue(mockResult);
      
      context.arguments = { query: 'SELECT * FROM users WHERE id = 999' };
      
      const result = await tool.execute(context);
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('No rows returned');
    });

    it('should handle query timeout', async () => {
      // Mock a query that never resolves to simulate a timeout scenario
      // Instead of actually timing out, we'll test the timeout logic by rejecting with timeout error
      mockConnection.execute = vi.fn().mockRejectedValue(
        new Error(`Query timeout after ${DEFAULT_CONFIG.queryTimeout}ms`)
      );
      
      context.arguments = { query: 'SELECT * FROM users' };
      
      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query timeout');
    });

    it('should handle result size limits', async () => {
      const largeResult = {
        rows: Array(DEFAULT_CONFIG.maxResultSize + 1).fill({ id: 1, name: 'test' }),
        columns: ['id', 'name'],
        rowsAffected: 0
      };

      mockConnection.execute = vi.fn().mockResolvedValue(largeResult);
      
      context.arguments = { query: 'SELECT * FROM users' };
      
      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query result too large');
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Table does not exist');
      mockConnection.execute = vi.fn().mockRejectedValue(dbError);
      
      context.arguments = { query: 'SELECT * FROM nonexistent_table' };
      
      const result = await tool.execute(context);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error executing query');
      expect(result.content[0].text).toContain('Table does not exist');
    });
  });

  describe('result formatting', () => {
    it('should format table results with proper alignment', async () => {
      const mockResult = {
        rows: [
          { id: 1, name: 'John Doe', status: 'active' },
          { id: 22, name: 'Jane', status: 'inactive' }
        ],
        columns: ['id', 'name', 'status'],
        rowsAffected: 0
      };

      mockConnection.execute = vi.fn().mockResolvedValue(mockResult);
      
      context.arguments = { query: 'SELECT * FROM users' };
      
      const result = await tool.execute(context);
      
      const output = result.content[0].text;
      expect(output).toContain('id  | name     | status');
      expect(output).toContain('----+----------+---------');
      expect(output).toContain('1   | John Doe | active');
      expect(output).toContain('22  | Jane     | inactive');
    });

    it('should handle NULL values properly', async () => {
      const mockResult = {
        rows: [
          { id: 1, name: 'John', email: null },
          { id: 2, name: null, email: 'test@example.com' }
        ],
        columns: ['id', 'name', 'email'],
        rowsAffected: 0
      };

      mockConnection.execute = vi.fn().mockResolvedValue(mockResult);
      
      context.arguments = { query: 'SELECT * FROM users' };
      
      const result = await tool.execute(context);
      
      expect(result.content[0].text).toContain('NULL');
    });

    it('should truncate large result sets for display', async () => {
      const largeResult = {
        rows: Array(150).fill({ id: 1, name: 'test' }),
        columns: ['id', 'name'],
        rowsAffected: 0
      };

      mockConnection.execute = vi.fn().mockResolvedValue(largeResult);
      
      context.arguments = { query: 'SELECT * FROM users' };
      
      const result = await tool.execute(context);
      
      const output = result.content[0].text;
      expect(output).toContain('Found 150 row(s)');
      expect(output).toContain('... and 50 more rows');
      expect(output).toContain('use LIMIT clause');
    });

    it('should fallback to JSON when no columns metadata', async () => {
      const mockResult = {
        rows: [{ data: 'test' }, { data: 'test2' }],
        columns: [],
        rowsAffected: 0
      };

      mockConnection.execute = vi.fn().mockResolvedValue(mockResult);
      
      context.arguments = { query: 'SELECT json_object() as data' };
      
      const result = await tool.execute(context);
      
      expect(result.content[0].text).toContain('"data": "test"');
    });

    it('should include performance metrics', async () => {
      const mockResult = {
        rows: [{ id: 1 }],
        columns: ['id'],
        rowsAffected: 0
      };

      mockConnection.execute = vi.fn().mockResolvedValue(mockResult);
      
      context.arguments = { query: 'SELECT 1 as id' };
      
      const result = await tool.execute(context);
      
      expect(result.content[0].text).toContain('Performance: 150ms, 5 returned');
    });
  });
});