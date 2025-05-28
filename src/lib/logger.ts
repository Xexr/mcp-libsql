import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { LogEntry, LogLevel } from '../types/index.js';

class Logger {
  private logDir: string;
  private logFile: string;
  private currentLogLevel: keyof LogLevel;

  constructor(logDir = 'logs', logLevel: keyof LogLevel = 'INFO') {
    this.logDir = logDir;
    this.logFile = join(logDir, `mcp-libsql-${new Date().toISOString().split('T')[0]}.log`);
    this.currentLogLevel = logLevel;
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory(): Promise<void> {
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true });
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const contextStr = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : '';
    const errorStr = entry.error ? ` | Error: ${entry.error.message}\n${entry.error.stack}` : '';
    return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}${errorStr}\n`;
  }

  private shouldLog(level: keyof LogLevel): boolean {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
    const currentIndex = levels.indexOf(this.currentLogLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formattedEntry = this.formatLogEntry(entry);

    // Write to console
    const consoleMethod = entry.level === 'ERROR' ? console.error :
                         entry.level === 'WARN' ? console.warn :
                         entry.level === 'DEBUG' ? console.debug : console.log;

    consoleMethod(formattedEntry.trim());

    // Write to file
    try {
      await appendFile(this.logFile, formattedEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  public error(message: string, context?: Record<string, unknown>, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      ...(context && { context }),
      ...(error && { error })
    };
    this.writeLog(entry).catch(err => console.error('Logger error:', err));
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      ...(context && { context })
    };
    this.writeLog(entry).catch(err => console.error('Logger error:', err));
  }

  public info(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      ...(context && { context })
    };
    this.writeLog(entry).catch(err => console.error('Logger error:', err));
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      message,
      ...(context && { context })
    };
    this.writeLog(entry).catch(err => console.error('Logger error:', err));
  }

  public setLogLevel(level: keyof LogLevel): void {
    this.currentLogLevel = level;
  }
}

export const logger = new Logger();
export { Logger };

