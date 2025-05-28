import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../lib/logger.js';

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
    public readonly query?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public readonly params?: any[]
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError);
    this.name = 'ConnectionError';
  }
}

export class QueryValidationError extends DatabaseError {
  constructor(message: string, query?: string) {
    super(message, undefined, query);
    this.name = 'QueryValidationError';
  }
}

export class QueryTimeoutError extends DatabaseError {
  constructor(timeout: number, query?: string) {
    super(`Query timed out after ${timeout}ms`, undefined, query);
    this.name = 'QueryTimeoutError';
  }
}

export class ResultSizeError extends DatabaseError {
  constructor(resultSize: number, maxSize: number) {
    super(`Result set too large: ${resultSize} rows exceeds limit of ${maxSize}`);
    this.name = 'ResultSizeError';
  }
}

export function handleDatabaseError(error: Error, context?: Record<string, unknown>): McpError {
  logger.error('Database operation failed', context, error);

  if (error instanceof QueryValidationError) {
    return new McpError(ErrorCode.InvalidParams, error.message, { query: error.query });
  }

  if (error instanceof ConnectionError) {
    return new McpError(ErrorCode.InternalError, 'Database connection failed', {
      originalMessage: error.message
    });
  }

  if (error instanceof QueryTimeoutError) {
    return new McpError(ErrorCode.InternalError, 'Query execution timed out', {
      query: error.query
    });
  }

  if (error instanceof ResultSizeError) {
    return new McpError(ErrorCode.InvalidParams, error.message);
  }

  if (error instanceof DatabaseError) {
    return new McpError(ErrorCode.InternalError, error.message, {
      query: error.query,
      params: error.params,
      originalMessage: error.originalError?.message
    });
  }

  // Handle libSQL client errors
  if (error.message.includes('SQLITE_')) {
    return new McpError(ErrorCode.InvalidParams, `SQL error: ${error.message}`);
  }

  // Generic error fallback
  return new McpError(ErrorCode.InternalError, 'An unexpected database error occurred', {
    originalMessage: error.message
  });
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError?: Error
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(timeoutError || new QueryTimeoutError(timeoutMs));
      }, timeoutMs);
    })
  ]);
}
