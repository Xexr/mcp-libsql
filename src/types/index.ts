export interface DatabaseConfig {
  url: string;
  minConnections?: number;
  maxConnections?: number;
  connectionTimeout?: number;
  retryInterval?: number;
  queryTimeout?: number;
  maxResultSize?: number;
}

export interface QueryMetrics {
  executionTime: number;
  rowsAffected?: number;
  rowsReturned?: number;
  queryPlan?: string;
}

export interface QueryResult<T = Record<string, unknown>> {
  data: T[];
  metrics: QueryMetrics;
}

export interface WriteResult {
  affectedRows: number;
  metrics: QueryMetrics;
}

export interface DatabaseConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (query: string, params?: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
  isHealthy: () => Promise<boolean>;
}

export interface ConnectionPool {
  getConnection: () => Promise<DatabaseConnection>;
  releaseConnection: (connection: DatabaseConnection) => void;
  close: () => Promise<void>;
  healthCheck: () => Promise<boolean>;
}

export interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

export interface LogEntry {
  timestamp: string;
  level: keyof LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}
