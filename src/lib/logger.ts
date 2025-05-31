/* eslint-disable no-console */
import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { LogEntry, LogLevel } from '../types/index.js';

export type LogMode = 'file' | 'console' | 'both' | 'none';

class Logger {
  private logDir: string;
  private logFile: string;
  private currentLogLevel: keyof LogLevel;
  private directoryEnsured: boolean = false;
  private logMode: LogMode;

  constructor(logDir?: string, logLevel: keyof LogLevel = 'INFO', logMode: LogMode = 'file') {
    // Use temp directory by default for better cross-platform compatibility
    this.logDir = logDir || join(tmpdir(), 'mcp-libsql-logs');
    this.logFile = join(this.logDir, `mcp-libsql-${new Date().toISOString().split('T')[0]}.log`);
    this.currentLogLevel = logLevel;
    this.logMode = logMode;
  }

  private async ensureLogDirectory(): Promise<void> {
    if (this.directoryEnsured) {
      return;
    }

    try {
      if (!existsSync(this.logDir)) {
        await mkdir(this.logDir, { recursive: true });
      }
      this.directoryEnsured = true;
    } catch (error) {
      // If we can't create the directory, just log to console
      console.warn(`Could not create log directory ${this.logDir}:`, error);
      this.directoryEnsured = false;
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
    if (!this.shouldLog(entry.level) || this.logMode === 'none') {
      return;
    }

    const formattedEntry = this.formatLogEntry(entry);

    // Write to console based on log mode
    if (this.logMode === 'console' || this.logMode === 'both') {
      const consoleMethod =
        entry.level === 'ERROR'
          ? console.error
          : entry.level === 'WARN'
            ? console.warn
            : entry.level === 'DEBUG'
              ? console.debug
              : console.log;

      consoleMethod(formattedEntry.trim());
    }

    // Write to file based on log mode
    if (this.logMode === 'file' || this.logMode === 'both') {
      try {
        await this.ensureLogDirectory();
        if (this.directoryEnsured) {
          await appendFile(this.logFile, formattedEntry);
        }
      } catch (error) {
        // Silently fail file logging if we can't write - console logging still works
        if (process.env['NODE_ENV'] !== 'production') {
          console.warn('Failed to write to log file:', error);
        }
      }
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

  public getLogFilePath(): string {
    return this.logFile;
  }
}

export const logger = new Logger();
export { Logger };
