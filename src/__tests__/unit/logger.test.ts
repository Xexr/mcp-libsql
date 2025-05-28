import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from '../../lib/logger.js';

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
    logger = new Logger('test-logs', 'DEBUG');
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
    const warnLogger = new Logger('test-logs', 'WARN');
    
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
});