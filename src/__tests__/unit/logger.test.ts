import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, type LogMode } from '../../lib/logger.js';

// Mock fs operations
vi.mock('fs/promises', () => ({
  appendFile: vi.fn(),
  mkdir: vi.fn()
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true)
}));

// Mock console methods
const consoleMocks = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  debug: vi.spyOn(console, 'debug').mockImplementation(() => {})
};

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test-logs', 'DEBUG', 'both'); // Use 'both' mode for existing tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.values(consoleMocks).forEach(mock => mock.mockClear());
  });

  it('should create a logger instance', () => {
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should log error messages', () => {
    const message = 'Test error message';
    const context = { userId: 123 };
    const error = new Error('Test error');

    logger.error(message, context, error);

    expect(consoleMocks.error).toHaveBeenCalled();
    // File system operations are mocked and tested indirectly through console output
  });

  it('should log warn messages', () => {
    const message = 'Test warning message';
    const context = { action: 'test' };

    logger.warn(message, context);

    expect(consoleMocks.warn).toHaveBeenCalled();
    // File system operations are mocked and tested indirectly through console output
  });

  it('should log info messages', () => {
    const message = 'Test info message';

    logger.info(message);

    expect(consoleMocks.log).toHaveBeenCalled();
    // File system operations are mocked and tested indirectly through console output
  });

  it('should log debug messages', () => {
    const message = 'Test debug message';

    logger.debug(message);

    expect(consoleMocks.debug).toHaveBeenCalled();
    // File system operations are mocked and tested indirectly through console output
  });

  it('should respect log level settings', () => {
    const warnLogger = new Logger('test-logs', 'WARN', 'both');
    
    warnLogger.debug('This should not be logged');
    warnLogger.info('This should not be logged');
    warnLogger.warn('This should be logged');
    warnLogger.error('This should be logged');

    // Debug and info should not be called, warn and error should be
    expect(consoleMocks.debug).not.toHaveBeenCalled();
    expect(consoleMocks.log).not.toHaveBeenCalled();
    expect(consoleMocks.warn).toHaveBeenCalled();
    expect(consoleMocks.error).toHaveBeenCalled();
  });

  it('should change log level dynamically', () => {
    logger.setLogLevel('ERROR');
    
    logger.debug('Should not log');
    logger.info('Should not log');
    logger.warn('Should not log');
    logger.error('Should log');

    expect(consoleMocks.debug).not.toHaveBeenCalled();
    expect(consoleMocks.log).not.toHaveBeenCalled();
    expect(consoleMocks.warn).not.toHaveBeenCalled();
    expect(consoleMocks.error).toHaveBeenCalled();
  });

  describe('Log Mode Tests', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should log to console only in console mode', () => {
      const consoleLogger = new Logger('test-logs', 'INFO', 'console');
      
      consoleLogger.info('Test message');
      
      expect(consoleMocks.log).toHaveBeenCalled();
    });

    it('should not log to console in file mode', () => {
      const fileLogger = new Logger('test-logs', 'INFO', 'file');
      
      fileLogger.info('Test message');
      
      expect(consoleMocks.log).not.toHaveBeenCalled();
    });

    it('should log to console in both mode', () => {
      const bothLogger = new Logger('test-logs', 'INFO', 'both');
      
      bothLogger.info('Test message');
      
      expect(consoleMocks.log).toHaveBeenCalled();
    });

    it('should not log anything in none mode', () => {
      const noneLogger = new Logger('test-logs', 'INFO', 'none');
      
      noneLogger.info('Test message');
      noneLogger.warn('Test warning');
      noneLogger.error('Test error');
      noneLogger.debug('Test debug');
      
      expect(consoleMocks.log).not.toHaveBeenCalled();
      expect(consoleMocks.warn).not.toHaveBeenCalled();
      expect(consoleMocks.error).not.toHaveBeenCalled();
      expect(consoleMocks.debug).not.toHaveBeenCalled();
    });

    it('should default to file mode when no mode specified', () => {
      const defaultLogger = new Logger('test-logs', 'INFO');
      
      defaultLogger.info('Test message');
      
      expect(consoleMocks.log).not.toHaveBeenCalled();
    });
  });
});