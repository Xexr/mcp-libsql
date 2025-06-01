import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  DatabaseError,
  ConnectionError,
  QueryValidationError,
  QueryTimeoutError,
  ResultSizeError,
  handleDatabaseError,
  withTimeout
} from '../../utils/error-handler.js';

// Mock the logger
vi.mock('../../lib/logger.js', () => ({
  logger: {
    error: vi.fn()
  }
}));

describe('Error Handler Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('DatabaseError', () => {
    it('should create a DatabaseError with message only', () => {
      const error = new DatabaseError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.name).toBe('DatabaseError');
      expect(error.message).toBe('Test error');
      expect(error.originalError).toBeUndefined();
      expect(error.query).toBeUndefined();
      expect(error.params).toBeUndefined();
    });

    it('should create a DatabaseError with all properties', () => {
      const originalError = new Error('Original error');
      const query = 'SELECT * FROM users';
      const params = ['param1', 123];

      const error = new DatabaseError('Test error', originalError, query, params);

      expect(error.name).toBe('DatabaseError');
      expect(error.message).toBe('Test error');
      expect(error.originalError).toBe(originalError);
      expect(error.query).toBe(query);
      expect(error.params).toBe(params);
    });
  });

  describe('ConnectionError', () => {
    it('should create a ConnectionError', () => {
      const originalError = new Error('Connection failed');
      const error = new ConnectionError('Database connection failed', originalError);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(ConnectionError);
      expect(error.name).toBe('ConnectionError');
      expect(error.message).toBe('Database connection failed');
      expect(error.originalError).toBe(originalError);
    });

    it('should create a ConnectionError without original error', () => {
      const error = new ConnectionError('Database connection failed');

      expect(error.name).toBe('ConnectionError');
      expect(error.message).toBe('Database connection failed');
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('QueryValidationError', () => {
    it('should create a QueryValidationError with query', () => {
      const query = 'INVALID SQL';
      const error = new QueryValidationError('Invalid query syntax', query);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(QueryValidationError);
      expect(error.name).toBe('QueryValidationError');
      expect(error.message).toBe('Invalid query syntax');
      expect(error.query).toBe(query);
      expect(error.originalError).toBeUndefined();
    });

    it('should create a QueryValidationError without query', () => {
      const error = new QueryValidationError('Invalid query syntax');

      expect(error.name).toBe('QueryValidationError');
      expect(error.message).toBe('Invalid query syntax');
      expect(error.query).toBeUndefined();
    });
  });

  describe('QueryTimeoutError', () => {
    it('should create a QueryTimeoutError with timeout and query', () => {
      const timeout = 5000;
      const query = 'SELECT * FROM large_table';
      const error = new QueryTimeoutError(timeout, query);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(QueryTimeoutError);
      expect(error.name).toBe('QueryTimeoutError');
      expect(error.message).toBe('Query timed out after 5000ms');
      expect(error.query).toBe(query);
    });

    it('should create a QueryTimeoutError without query', () => {
      const timeout = 3000;
      const error = new QueryTimeoutError(timeout);

      expect(error.name).toBe('QueryTimeoutError');
      expect(error.message).toBe('Query timed out after 3000ms');
      expect(error.query).toBeUndefined();
    });
  });

  describe('ResultSizeError', () => {
    it('should create a ResultSizeError', () => {
      const resultSize = 15000;
      const maxSize = 10000;
      const error = new ResultSizeError(resultSize, maxSize);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(ResultSizeError);
      expect(error.name).toBe('ResultSizeError');
      expect(error.message).toBe('Result set too large: 15000 rows exceeds limit of 10000');
    });
  });

  describe('handleDatabaseError', () => {
    it('should handle QueryValidationError', () => {
      const query = 'INVALID SQL';
      const error = new QueryValidationError('Invalid syntax', query);
      const context = { operation: 'query' };

      const mcpError = handleDatabaseError(error, context);

      expect(mcpError).toBeInstanceOf(McpError);
      expect(mcpError.code).toBe(ErrorCode.InvalidParams);
      expect(mcpError.message).toBe('MCP error -32602: Invalid syntax');
      expect(mcpError.data).toEqual({ query });
    });

    it('should handle ConnectionError', () => {
      const error = new ConnectionError('Connection failed');
      const context = { host: 'localhost' };

      const mcpError = handleDatabaseError(error, context);

      expect(mcpError.code).toBe(ErrorCode.InternalError);
      expect(mcpError.message).toBe('MCP error -32603: Database connection failed');
      expect(mcpError.data).toEqual({ originalMessage: 'Connection failed' });
    });

    it('should handle QueryTimeoutError', () => {
      const query = 'SELECT * FROM large_table';
      const error = new QueryTimeoutError(5000, query);

      const mcpError = handleDatabaseError(error);

      expect(mcpError.code).toBe(ErrorCode.InternalError);
      expect(mcpError.message).toBe('MCP error -32603: Query execution timed out');
      expect(mcpError.data).toEqual({ query });
    });

    it('should handle ResultSizeError', () => {
      const error = new ResultSizeError(15000, 10000);

      const mcpError = handleDatabaseError(error);

      expect(mcpError.code).toBe(ErrorCode.InvalidParams);
      expect(mcpError.message).toBe('MCP error -32602: Result set too large: 15000 rows exceeds limit of 10000');
    });

    it('should handle generic DatabaseError', () => {
      const originalError = new Error('Original error');
      const query = 'SELECT * FROM users';
      const params = ['param1'];
      const error = new DatabaseError('Database operation failed', originalError, query, params);

      const mcpError = handleDatabaseError(error);

      expect(mcpError.code).toBe(ErrorCode.InternalError);
      expect(mcpError.message).toBe('MCP error -32603: Database operation failed');
      expect(mcpError.data).toEqual({
        query,
        params,
        originalMessage: 'Original error'
      });
    });

    it('should handle libSQL SQLITE errors', () => {
      const error = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');

      const mcpError = handleDatabaseError(error);

      expect(mcpError.code).toBe(ErrorCode.InvalidParams);
      expect(mcpError.message).toBe('MCP error -32602: SQL error: SQLITE_CONSTRAINT: UNIQUE constraint failed');
    });

    it('should handle generic errors', () => {
      const error = new Error('Unknown error');

      const mcpError = handleDatabaseError(error);

      expect(mcpError.code).toBe(ErrorCode.InternalError);
      expect(mcpError.message).toBe('MCP error -32603: An unexpected database error occurred');
      expect(mcpError.data).toEqual({ originalMessage: 'Unknown error' });
    });

    it('should handle errors with context', async () => {
      const error = new Error('Test error');
      const context = { operation: 'test', user: 'testUser' };

      handleDatabaseError(error, context);

      // Verify logger was called with context
      const { logger } = await import('../../lib/logger.js');
      expect(logger.error).toHaveBeenCalledWith('Database operation failed', context, error);
    });
  });

  describe('withTimeout', () => {
    it('should resolve when promise resolves before timeout', async () => {
      vi.useFakeTimers();

      const result = 'success';
      const promise = new Promise<string>(resolve => {
        setTimeout(() => resolve(result), 100);
      });

      const timeoutPromise = withTimeout(promise, 1000);

      // Advance time to resolve the original promise
      vi.advanceTimersByTime(100);

      await expect(timeoutPromise).resolves.toBe(result);
    });

    it('should reject with QueryTimeoutError when timeout occurs', async () => {
      vi.useFakeTimers();

      const promise = new Promise<string>(resolve => {
        setTimeout(() => resolve('late'), 2000);
      });

      const timeoutPromise = withTimeout(promise, 1000);

      // Advance time to trigger timeout
      vi.advanceTimersByTime(1000);

      await expect(timeoutPromise).rejects.toThrow(QueryTimeoutError);
      await expect(timeoutPromise).rejects.toThrow('Query timed out after 1000ms');
    });

    it('should reject with custom timeout error when provided', async () => {
      vi.useFakeTimers();

      const promise = new Promise<string>(resolve => {
        setTimeout(() => resolve('late'), 2000);
      });

      const customError = new Error('Custom timeout error');
      const timeoutPromise = withTimeout(promise, 1000, customError);

      // Advance time to trigger timeout
      vi.advanceTimersByTime(1000);

      await expect(timeoutPromise).rejects.toBe(customError);
    });

    it('should reject when original promise rejects before timeout', async () => {
      vi.useFakeTimers();

      const originalError = new Error('Promise rejected');
      const promise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(originalError), 100);
      });

      const timeoutPromise = withTimeout(promise, 1000);

      // Advance time to reject the original promise
      vi.advanceTimersByTime(100);

      await expect(timeoutPromise).rejects.toBe(originalError);
    });

    it('should handle immediate promise resolution', async () => {
      const result = 'immediate';
      const promise = Promise.resolve(result);

      const timeoutPromise = withTimeout(promise, 1000);

      await expect(timeoutPromise).resolves.toBe(result);
    });

    it('should handle immediate promise rejection', async () => {
      const error = new Error('Immediate error');
      const promise = Promise.reject(error);

      const timeoutPromise = withTimeout(promise, 1000);

      await expect(timeoutPromise).rejects.toBe(error);
    });
  });
});
