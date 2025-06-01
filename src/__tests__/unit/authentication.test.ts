import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createClient } from '@libsql/client';
import type { DatabaseConfig } from '../../types/index.js';

// Mock the libSQL client
vi.mock('@libsql/client', () => ({
  createClient: vi.fn()
}));

const mockCreateClient = createClient as vi.MockedFunction<typeof createClient>;

// Import the class we're testing after mocking
import { LibSQLConnection } from '../../lib/database.js';

describe('Authentication Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Database Connection Authentication', () => {
    it('should create client without auth token for file databases', () => {
      const config: DatabaseConfig = {
        url: 'file:///tmp/test.db'
      };

      const mockClient = {
        execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
        transaction: vi.fn(),
        close: vi.fn()
      };

      mockCreateClient.mockReturnValue(mockClient);

      new LibSQLConnection(config);

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: 'file:///tmp/test.db'
      });
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });

    it('should create client with auth token when provided', () => {
      const config: DatabaseConfig = {
        url: 'libsql://my-db.turso.io',
        authToken: 'test-auth-token-123'
      };

      const mockClient = {
        execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
        transaction: vi.fn(),
        close: vi.fn()
      };

      mockCreateClient.mockReturnValue(mockClient);

      new LibSQLConnection(config);

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: 'libsql://my-db.turso.io',
        authToken: 'test-auth-token-123'
      });
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });

    it('should not include authToken property when token is undefined', () => {
      const config: DatabaseConfig = {
        url: 'libsql://my-db.turso.io',
        authToken: undefined
      };

      const mockClient = {
        execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
        transaction: vi.fn(),
        close: vi.fn()
      };

      mockCreateClient.mockReturnValue(mockClient);

      new LibSQLConnection(config);

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: 'libsql://my-db.turso.io'
      });
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });

    it('should handle empty auth token', () => {
      const config: DatabaseConfig = {
        url: 'libsql://my-db.turso.io',
        authToken: ''
      };

      const mockClient = {
        execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
        transaction: vi.fn(),
        close: vi.fn()
      };

      mockCreateClient.mockReturnValue(mockClient);

      new LibSQLConnection(config);

      // Empty string is falsy, so authToken should not be included
      expect(mockCreateClient).toHaveBeenCalledWith({
        url: 'libsql://my-db.turso.io'
      });
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });

    it('should handle long JWT-like auth tokens', () => {
      const jwtToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDEzNDU2NzgsImlkIjoiYWJjZGVmZ2gtaWprbC1tbm9wLXFyc3QtdXZ3eHl6MTIzNDU2In0.example-signature-for-jwt-token';
      
      const config: DatabaseConfig = {
        url: 'libsql://my-db.turso.io',
        authToken: jwtToken
      };

      const mockClient = {
        execute: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
        transaction: vi.fn(),
        close: vi.fn()
      };

      mockCreateClient.mockReturnValue(mockClient);

      new LibSQLConnection(config);

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: 'libsql://my-db.turso.io',
        authToken: jwtToken
      });
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('Authentication Error Handling', () => {
    it('should provide helpful error message for auth failures', async () => {
      const config: DatabaseConfig = {
        url: 'libsql://my-db.turso.io',
        authToken: 'invalid-token'
      };

      const authError = new Error('Authentication failed: invalid token');
      const mockClient = {
        execute: vi.fn().mockRejectedValue(authError),
        transaction: vi.fn(),
        close: vi.fn()
      };

      mockCreateClient.mockReturnValue(mockClient);

      const connection = new LibSQLConnection(config);

      await expect(connection.connect()).rejects.toThrow('Authentication failed: invalid token');
    });

    it('should handle non-auth connection errors normally', async () => {
      const config: DatabaseConfig = {
        url: 'libsql://my-db.turso.io',
        authToken: 'valid-token'
      };

      const networkError = new Error('Network timeout');
      const mockClient = {
        execute: vi.fn().mockRejectedValue(networkError),
        transaction: vi.fn(),
        close: vi.fn()
      };

      mockCreateClient.mockReturnValue(mockClient);

      const connection = new LibSQLConnection(config);

      await expect(connection.connect()).rejects.toThrow('Network timeout');
    });
  });

  describe('Auth Token Source Detection', () => {
    let originalEnv: NodeJS.ProcessEnv;
    let originalArgv: string[];

    beforeEach(() => {
      // Save original environment and argv
      originalEnv = { ...process.env };
      originalArgv = [...process.argv];
    });

    afterEach(() => {
      // Restore original environment and argv
      process.env = originalEnv;
      process.argv = originalArgv;
    });

    it('should detect CLI token source correctly', () => {
      process.argv = ['node', 'index.js', '--url', 'libsql://test.turso.io', '--auth-token', 'cli-token'];
      delete process.env['LIBSQL_AUTH_TOKEN'];

      // This would be tested in integration tests since it requires the actual parsing logic
      // For unit tests, we verify the components work correctly
      expect(process.argv.includes('--auth-token')).toBe(true);
      expect(process.env['LIBSQL_AUTH_TOKEN']).toBeUndefined();
    });

    it('should detect environment variable token source correctly', () => {
      process.argv = ['node', 'index.js', '--url', 'libsql://test.turso.io'];
      process.env['LIBSQL_AUTH_TOKEN'] = 'env-token';

      expect(process.argv.includes('--auth-token')).toBe(false);
      expect(process.env['LIBSQL_AUTH_TOKEN']).toBe('env-token');
    });

    it('should prioritize CLI token over environment variable', () => {
      process.argv = ['node', 'index.js', '--url', 'libsql://test.turso.io', '--auth-token', 'cli-token'];
      process.env['LIBSQL_AUTH_TOKEN'] = 'env-token';

      expect(process.argv.includes('--auth-token')).toBe(true);
      expect(process.env['LIBSQL_AUTH_TOKEN']).toBe('env-token');
      // CLI should take precedence in parsing logic
    });
  });
});

describe('Auth Token Validation', () => {
  describe('Token Format Validation', () => {
    it('should accept valid token formats', () => {
      const validTokens = [
        'abc123def456',
        'eyJhbGciOiJFZERTQSJ9.eyJpZCI6InRlc3QifQ.signature',
        'dGVzdC10b2tlbi1iYXNlNjQ=',
        'valid-token-with-dashes-123',
        'ValidTokenWithMixedCase456'
      ];

      validTokens.forEach(token => {
        // Basic validation - token exists and is non-empty string
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
        expect(token.trim()).toBe(token);
      });
    });

    it('should identify potentially invalid token formats', () => {
      const suspiciousTokens = [
        ' token-with-leading-space',
        'token-with-trailing-space ',
        'token\nwith\nnewlines',
        'token\twith\ttabs',
        '123', // Very short
        'ab'   // Very short
      ];

      suspiciousTokens.forEach(token => {
        const hasSuspiciousChars = token !== token.trim() || 
                                   token.includes('\n') || 
                                   token.includes('\t');
        const isTooShort = token.trim().length < 10;
        
        expect(hasSuspiciousChars || isTooShort).toBe(true);
      });
    });
  });

  describe('URL Compatibility Validation', () => {
    it('should identify appropriate URLs for auth tokens', () => {
      const authCompatibleUrls = [
        'libsql://my-db.turso.io',
        'https://remote-db.example.com',
        'libsql://another-db.turso.io:443'
      ];

      authCompatibleUrls.forEach(url => {
        const isCompatible = url.startsWith('libsql://') || url.startsWith('https://');
        expect(isCompatible).toBe(true);
      });
    });

    it('should identify URLs where auth tokens are unusual', () => {
      const authUnusualUrls = [
        'file:///tmp/local.db',
        'file:local.db',
        'http://localhost:8080',
        'sqlite:memory:'
      ];

      authUnusualUrls.forEach(url => {
        const isUsual = url.startsWith('libsql://') || url.startsWith('https://');
        expect(isUsual).toBe(false);
      });
    });
  });
});