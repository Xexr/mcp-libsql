export const DEFAULT_CONFIG = {
  minConnections: 1,
  maxConnections: 10,
  connectionTimeout: 30000, // 30 seconds
  retryInterval: 5000, // 5 seconds
  queryTimeout: 30000, // 30 seconds
  maxResultSize: 10000 // 10,000 rows
} as const;

export const RESTRICTED_OPERATIONS = [
  'DROP DATABASE',
  'DROP TABLE',
  'DROP INDEX',
  'DROP TRIGGER',
  'DROP VIEW',
  'TRUNCATE',
  'DELETE FROM sqlite_master',
  'DELETE FROM sqlite_sequence',
  'UPDATE sqlite_master',
  'UPDATE sqlite_sequence',
  'INSERT INTO sqlite_master',
  'INSERT INTO sqlite_sequence',
  'PRAGMA case_sensitive_like',
  'PRAGMA foreign_keys',
  'PRAGMA journal_mode',
  'PRAGMA synchronous',
  'PRAGMA temp_store',
  'PRAGMA wal_autocheckpoint',
  'ATTACH DATABASE',
  'DETACH DATABASE'
] as const;

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
} as const;

export const QUERY_TYPES = {
  SELECT: 'SELECT',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  CREATE_TABLE: 'CREATE TABLE',
  ALTER_TABLE: 'ALTER TABLE',
  DROP: 'DROP',
  PRAGMA: 'PRAGMA'
} as const;

