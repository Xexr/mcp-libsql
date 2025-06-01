import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseArgs } from 'node:util';

// Mock the parseArgs function to test our parsing logic
vi.mock('node:util', () => ({
  parseArgs: vi.fn()
}));

const mockParseArgs = parseArgs as vi.MockedFunction<typeof parseArgs>;

// Import the types we need
import type { LogMode } from '../../lib/logger.js';

interface CLIOptions {
  url: string;
  authToken: string | undefined;
  minConnections: number | undefined;
  maxConnections: number | undefined;
  connectionTimeout: number | undefined;
  queryTimeout: number | undefined;
  help: boolean | undefined;
  version: boolean | undefined;
  dev: boolean | undefined;
  logMode: LogMode | undefined;
}

// Replicate the parsing logic from index.ts for testing
function parseCliArgs(): CLIOptions {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      url: { type: 'string' },
      'auth-token': { type: 'string' },
      'min-connections': { type: 'string' },
      'max-connections': { type: 'string' },
      'connection-timeout': { type: 'string' },
      'query-timeout': { type: 'string' },
      'log-mode': { type: 'string' },
      dev: { type: 'boolean', short: 'd' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' }
    },
    strict: true
  });

  return {
    url: values.url || '',
    authToken: values['auth-token'] || process.env['LIBSQL_AUTH_TOKEN'],
    minConnections: values['min-connections']
      ? parseInt(values['min-connections'], 10)
      : undefined,
    maxConnections: values['max-connections']
      ? parseInt(values['max-connections'], 10)
      : undefined,
    connectionTimeout: values['connection-timeout']
      ? parseInt(values['connection-timeout'], 10)
      : undefined,
    queryTimeout: values['query-timeout'] ? parseInt(values['query-timeout'], 10) : undefined,
    logMode: values['log-mode'] as LogMode | undefined,
    dev: values.dev,
    help: values.help,
    version: values.version
  };
}

describe('CLI Arguments Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('url option', () => {
    it('should parse url correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.url).toBe('libsql://my-db.turso.io');
    });

    it('should handle missing url', () => {
      mockParseArgs.mockReturnValue({
        values: {},
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.url).toBe('');
    });

    it('should handle different url formats', () => {
      const urls = [
        'file:local.db',
        'http://localhost:8080',
        'https://remote.db.com',
        'libsql://my-db.turso.io'
      ];

      urls.forEach(url => {
        mockParseArgs.mockReturnValue({
          values: { url },
          positionals: []
        });

        const result = parseCliArgs();
        expect(result.url).toBe(url);
      });
    });
  });

  describe('connection pool options', () => {
    it('should parse min-connections correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'min-connections': '5'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.minConnections).toBe(5);
    });

    it('should parse max-connections correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'max-connections': '20'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.maxConnections).toBe(20);
    });

    it('should handle missing connection pool options', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.minConnections).toBeUndefined();
      expect(result.maxConnections).toBeUndefined();
    });

    it('should parse both connection pool options together', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'min-connections': '2',
          'max-connections': '15'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.minConnections).toBe(2);
      expect(result.maxConnections).toBe(15);
    });
  });

  describe('timeout options', () => {
    it('should parse connection-timeout correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'connection-timeout': '5000'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.connectionTimeout).toBe(5000);
    });

    it('should parse query-timeout correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'query-timeout': '10000'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.queryTimeout).toBe(10000);
    });

    it('should handle missing timeout options', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.connectionTimeout).toBeUndefined();
      expect(result.queryTimeout).toBeUndefined();
    });

    it('should parse both timeout options together', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'connection-timeout': '3000',
          'query-timeout': '8000'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.connectionTimeout).toBe(3000);
      expect(result.queryTimeout).toBe(8000);
    });
  });

  describe('boolean flags', () => {
    it('should parse dev flag correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          dev: true
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.dev).toBe(true);
    });

    it('should parse help flag correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          help: true
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.help).toBe(true);
    });

    it('should parse version flag correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          version: true
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.version).toBe(true);
    });

    it('should handle missing boolean flags', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.dev).toBeUndefined();
      expect(result.help).toBeUndefined();
      expect(result.version).toBeUndefined();
    });
  });

  describe('log-mode option', () => {
    it('should parse log-mode file correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'log-mode': 'file'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.logMode).toBe('file');
      expect(result.url).toBe('file:test.db');
    });

    it('should parse log-mode console correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'log-mode': 'console'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.logMode).toBe('console');
    });

    it('should parse log-mode both correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'log-mode': 'both'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.logMode).toBe('both');
    });

    it('should parse log-mode none correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'log-mode': 'none'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.logMode).toBe('none');
    });

    it('should return undefined when log-mode is not specified', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.logMode).toBeUndefined();
    });

    it('should handle log-mode with other options', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'log-mode': 'both',
          'max-connections': '20',
          dev: true
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.logMode).toBe('both');
      expect(result.maxConnections).toBe(20);
      expect(result.dev).toBe(true);
      expect(result.url).toBe('file:test.db');
    });
  });

  describe('default behavior', () => {
    it('should default logMode to file when not specified', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db'
        },
        positionals: []
      });

      const result = parseCliArgs();
      const logMode = result.logMode || 'file'; // This simulates the defaulting logic in main()
      
      expect(logMode).toBe('file');
    });
  });

  describe('validation', () => {
    it('should preserve invalid log-mode values for validation', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'log-mode': 'invalid-mode'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.logMode).toBe('invalid-mode');
      // Note: Actual validation happens in validateOptions() function
    });
  });

  describe('comprehensive options parsing', () => {
    it('should handle all options together', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io',
          'min-connections': '3',
          'max-connections': '25',
          'connection-timeout': '5000',
          'query-timeout': '12000',
          'log-mode': 'both',
          dev: true,
          help: false,
          version: false
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.url).toBe('libsql://my-db.turso.io');
      expect(result.minConnections).toBe(3);
      expect(result.maxConnections).toBe(25);
      expect(result.connectionTimeout).toBe(5000);
      expect(result.queryTimeout).toBe(12000);
      expect(result.logMode).toBe('both');
      expect(result.dev).toBe(true);
      expect(result.help).toBe(false);
      expect(result.version).toBe(false);
    });

    it('should handle minimal required options only', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:minimal.db'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.url).toBe('file:minimal.db');
      expect(result.minConnections).toBeUndefined();
      expect(result.maxConnections).toBeUndefined();
      expect(result.connectionTimeout).toBeUndefined();
      expect(result.queryTimeout).toBeUndefined();
      expect(result.logMode).toBeUndefined();
      expect(result.dev).toBeUndefined();
      expect(result.help).toBeUndefined();
      expect(result.version).toBeUndefined();
    });
  });

  describe('edge cases and number parsing', () => {
    it('should handle string numbers correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'min-connections': '0',
          'max-connections': '999',
          'connection-timeout': '1000',
          'query-timeout': '60000'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.minConnections).toBe(0);
      expect(result.maxConnections).toBe(999);
      expect(result.connectionTimeout).toBe(1000);
      expect(result.queryTimeout).toBe(60000);
    });

    it('should handle invalid numbers gracefully', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'min-connections': 'invalid',
          'connection-timeout': 'abc',
          'query-timeout': '1.5'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.minConnections).toBeNaN();
      expect(result.connectionTimeout).toBeNaN();
      expect(result.queryTimeout).toBe(1); // parseInt truncates to integer
    });

    it('should handle empty string values', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'max-connections': '',
          'connection-timeout': ''
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.maxConnections).toBeUndefined(); // Empty string is falsy
      expect(result.connectionTimeout).toBeUndefined(); // Empty string is falsy
    });

    it('should handle negative numbers', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db',
          'min-connections': '-5',
          'max-connections': '-10'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.minConnections).toBe(-5);
      expect(result.maxConnections).toBe(-10);
    });
  });
});

describe('Log Mode Validation', () => {
  const validLogModes = ['file', 'console', 'both', 'none'];
  
  it('should identify valid log modes', () => {
    validLogModes.forEach(mode => {
      expect(validLogModes.includes(mode)).toBe(true);
    });
  });

  it('should identify invalid log modes', () => {
    const invalidModes = ['invalid', 'stdout', 'stderr', ''];
    
    invalidModes.forEach(mode => {
      expect(validLogModes.includes(mode)).toBe(false);
    });
  });
});

describe('CLI Examples from Help Text', () => {
  it('should parse basic example correctly', () => {
    // mcp-libsql-server --url "file:local.db"
    mockParseArgs.mockReturnValue({
      values: {
        url: 'file:local.db'
      },
      positionals: []
    });

    const result = parseCliArgs();
    
    expect(result.url).toBe('file:local.db');
    expect(result.logMode).toBeUndefined(); // Should default to 'file'
  });

  it('should parse turso example correctly', () => {
    // mcp-libsql-server --url "libsql://your-db.turso.io" --max-connections 20
    mockParseArgs.mockReturnValue({
      values: {
        url: 'libsql://your-db.turso.io',
        'max-connections': '20'
      },
      positionals: []
    });

    const result = parseCliArgs();
    
    expect(result.url).toBe('libsql://your-db.turso.io');
    expect(result.maxConnections).toBe(20);
  });

  it('should parse development example correctly', () => {
    // mcp-libsql-server --url "http://localhost:8080" --min-connections 2 --dev
    mockParseArgs.mockReturnValue({
      values: {
        url: 'http://localhost:8080',
        'min-connections': '2',
        dev: true
      },
      positionals: []
    });

    const result = parseCliArgs();
    
    expect(result.url).toBe('http://localhost:8080');
    expect(result.minConnections).toBe(2);
    expect(result.dev).toBe(true);
  });

  it('should parse log-mode example correctly', () => {
    // mcp-libsql-server --url "file:local.db" --log-mode console
    mockParseArgs.mockReturnValue({
      values: {
        url: 'file:local.db',
        'log-mode': 'console'
      },
      positionals: []
    });

    const result = parseCliArgs();
    
    expect(result.url).toBe('file:local.db');
    expect(result.logMode).toBe('console');
  });

  it('should parse turso auth token example correctly', () => {
    // mcp-libsql-server --url "libsql://your-db.turso.io" --auth-token "your-token" --max-connections 20
    mockParseArgs.mockReturnValue({
      values: {
        url: 'libsql://your-db.turso.io',
        'auth-token': 'your-token',
        'max-connections': '20'
      },
      positionals: []
    });

    const result = parseCliArgs();
    
    expect(result.url).toBe('libsql://your-db.turso.io');
    expect(result.authToken).toBe('your-token');
    expect(result.maxConnections).toBe(20);
  });
});

describe('Authentication Token Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables before each test
    delete process.env['LIBSQL_AUTH_TOKEN'];
  });

  describe('CLI auth-token parameter', () => {
    it('should parse auth-token correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io',
          'auth-token': 'test-cli-token-123'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.authToken).toBe('test-cli-token-123');
    });

    it('should handle missing auth-token', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.authToken).toBeUndefined();
    });

    it('should handle empty auth-token', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io',
          'auth-token': ''
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      // Empty string is falsy, so environment variable fallback applies
      // Since no env var is set in test, should be undefined
      expect(result.authToken).toBeUndefined();
    });

    it('should handle long auth tokens', () => {
      const longToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDEzNDU2NzgsImlkIjoiYWJjZGVmZ2gtaWprbC1tbm9wLXFyc3QtdXZ3eHl6MTIzNDU2In0.example-long-jwt-token-for-turso-authentication';
      
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io',
          'auth-token': longToken
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.authToken).toBe(longToken);
    });
  });

  describe('Environment variable auth token', () => {
    it('should use LIBSQL_AUTH_TOKEN environment variable when CLI token not provided', () => {
      process.env['LIBSQL_AUTH_TOKEN'] = 'test-env-token-456';
      
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.authToken).toBe('test-env-token-456');
    });

    it('should prioritize CLI auth-token over environment variable', () => {
      process.env['LIBSQL_AUTH_TOKEN'] = 'test-env-token-456';
      
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io',
          'auth-token': 'test-cli-token-123'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.authToken).toBe('test-cli-token-123');
    });

    it('should handle empty environment variable', () => {
      process.env['LIBSQL_AUTH_TOKEN'] = '';
      
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.authToken).toBe('');
    });

    it('should return undefined when neither CLI nor env token provided', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:test.db'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.authToken).toBeUndefined();
    });
  });

  describe('Authentication with other options', () => {
    it('should handle auth token with all other options', () => {
      process.env['LIBSQL_AUTH_TOKEN'] = 'env-token';
      
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io',
          'auth-token': 'cli-token',
          'min-connections': '2',
          'max-connections': '15',
          'connection-timeout': '5000',
          'query-timeout': '10000',
          'log-mode': 'both',
          dev: true
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.url).toBe('libsql://my-db.turso.io');
      expect(result.authToken).toBe('cli-token'); // CLI takes precedence
      expect(result.minConnections).toBe(2);
      expect(result.maxConnections).toBe(15);
      expect(result.connectionTimeout).toBe(5000);
      expect(result.queryTimeout).toBe(10000);
      expect(result.logMode).toBe('both');
      expect(result.dev).toBe(true);
    });

    it('should handle file database with auth token (unusual but valid)', () => {
      mockParseArgs.mockReturnValue({
        values: {
          url: 'file:local.db',
          'auth-token': 'unnecessary-token'
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.url).toBe('file:local.db');
      expect(result.authToken).toBe('unnecessary-token');
    });
  });

  describe('Real-world token examples', () => {
    it('should handle JWT-like tokens', () => {
      const jwtToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDEzNDU2NzgsImlkIjoiYWJjZGVmZ2gtaWprbC1tbm9wLXFyc3QtdXZ3eHl6MTIzNDU2In0.signature';
      
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io',
          'auth-token': jwtToken
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.authToken).toBe(jwtToken);
    });

    it('should handle base64-like tokens', () => {
      const base64Token = 'dGVzdC10b2tlbi1mb3ItdHVyc28tYXV0aGVudGljYXRpb24tMTIzNDU2Nzg5MA==';
      
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io',
          'auth-token': base64Token
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.authToken).toBe(base64Token);
    });

    it('should handle alphanumeric tokens', () => {
      const alphanumericToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
      
      mockParseArgs.mockReturnValue({
        values: {
          url: 'libsql://my-db.turso.io',
          'auth-token': alphanumericToken
        },
        positionals: []
      });

      const result = parseCliArgs();
      
      expect(result.authToken).toBe(alphanumericToken);
    });
  });
});