import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ResultSet } from '@libsql/client';
import { PerformanceMonitor, formatPerformanceMetrics } from '../../utils/performance.js';
import type { QueryMetrics } from '../../types/index.js';

describe('Performance Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('PerformanceMonitor.createMetrics', () => {
    it('should create metrics for a SELECT query result', () => {
      const startTime = 1000;
      const endTime = 1250;
      const result: ResultSet = {
        rows: [
          { id: 1, name: 'John', length: 2 },
          { id: 2, name: 'Jane', length: 2 }
        ],
        rowsAffected: 0,
        lastInsertRowid: undefined,
        columns: ['id', 'name'],
        columnTypes: ['INTEGER', 'TEXT'],
        toJSON: () => ({})
      };

      const metrics = PerformanceMonitor.createMetrics(startTime, endTime, result);

      expect(metrics).toEqual({
        executionTime: 250,
        rowsAffected: 0,
        rowsReturned: 2
      });
    });

    it('should create metrics for an INSERT query result', () => {
      const startTime = 2000;
      const endTime = 2100;
      const result: ResultSet = {
        rows: [],
        rowsAffected: 1,
        lastInsertRowid: 5n,
        columns: [],
        columnTypes: [],
        toJSON: () => ({})
      };

      const metrics = PerformanceMonitor.createMetrics(startTime, endTime, result);

      expect(metrics).toEqual({
        executionTime: 100,
        rowsAffected: 1,
        rowsReturned: 0
      });
    });

    it('should create metrics for an UPDATE query result', () => {
      const startTime = 3000;
      const endTime = 3500;
      const result: ResultSet = {
        rows: [],
        rowsAffected: 3,
        lastInsertRowid: undefined,
        columns: [],
        columnTypes: [],
        toJSON: () => ({})
      };

      const metrics = PerformanceMonitor.createMetrics(startTime, endTime, result);

      expect(metrics).toEqual({
        executionTime: 500,
        rowsAffected: 3,
        rowsReturned: 0
      });
    });

    it('should create metrics for a DELETE query result', () => {
      const startTime = 4000;
      const endTime = 4075;
      const result: ResultSet = {
        rows: [],
        rowsAffected: 2,
        lastInsertRowid: undefined,
        columns: [],
        columnTypes: [],
        toJSON: () => ({})
      };

      const metrics = PerformanceMonitor.createMetrics(startTime, endTime, result);

      expect(metrics).toEqual({
        executionTime: 75,
        rowsAffected: 2,
        rowsReturned: 0
      });
    });

    it('should handle empty result set', () => {
      const startTime = 5000;
      const endTime = 5010;
      const result: ResultSet = {
        rows: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
        columns: [],
        columnTypes: [],
        toJSON: () => ({})
      };

      const metrics = PerformanceMonitor.createMetrics(startTime, endTime, result);

      expect(metrics).toEqual({
        executionTime: 10,
        rowsAffected: 0,
        rowsReturned: 0
      });
    });

    it('should handle large result sets', () => {
      const startTime = 6000;
      const endTime = 8000;
      const rows = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item${i}`, length: 2 }));
      const result: ResultSet = {
        rows,
        rowsAffected: 0,
        lastInsertRowid: undefined,
        columns: ['id', 'value'],
        columnTypes: ['INTEGER', 'TEXT'],
        toJSON: () => ({})
      };

      const metrics = PerformanceMonitor.createMetrics(startTime, endTime, result);

      expect(metrics).toEqual({
        executionTime: 2000,
        rowsAffected: 0,
        rowsReturned: 1000
      });
    });
  });

  describe('PerformanceMonitor.measureQuery', () => {
    it('should measure execution time of a successful operation', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(1000);

      const operation = vi.fn().mockImplementation(() => {
        vi.advanceTimersByTime(150);
        return Promise.resolve('success');
      });

      const promise = PerformanceMonitor.measureQuery(operation);

      const result = await promise;

      expect(result.result).toBe('success');
      expect(result.executionTime).toBe(150);
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should measure execution time of a failed operation', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(2000);

      const error = new Error('Operation failed');
      const operation = vi.fn().mockImplementation(() => {
        vi.advanceTimersByTime(75);
        return Promise.reject(error);
      });

      await expect(PerformanceMonitor.measureQuery(operation)).rejects.toBe(error);
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should measure execution time of an immediate operation', async () => {
      const operation = vi.fn().mockResolvedValue('immediate');

      const result = await PerformanceMonitor.measureQuery(operation);

      expect(result.result).toBe('immediate');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.executionTime).toBeLessThan(10); // Should be very fast
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should handle complex return types', async () => {
      const complexResult = {
        data: [1, 2, 3],
        metadata: { count: 3, source: 'test' }
      };
      const operation = vi.fn().mockResolvedValue(complexResult);

      const result = await PerformanceMonitor.measureQuery(operation);

      expect(result.result).toEqual(complexResult);
      expect(typeof result.executionTime).toBe('number');
      expect(operation).toHaveBeenCalledOnce();
    });
  });

  describe('PerformanceMonitor.formatMetrics', () => {
    it('should format metrics with execution time only', () => {
      const metrics: QueryMetrics = {
        executionTime: 150
      };

      const formatted = PerformanceMonitor.formatMetrics(metrics);

      expect(formatted).toBe('150ms');
    });

    it('should format metrics with execution time and rows affected', () => {
      const metrics: QueryMetrics = {
        executionTime: 250,
        rowsAffected: 3
      };

      const formatted = PerformanceMonitor.formatMetrics(metrics);

      expect(formatted).toBe('250ms, 3 affected');
    });

    it('should format metrics with execution time and rows returned', () => {
      const metrics: QueryMetrics = {
        executionTime: 180,
        rowsReturned: 5
      };

      const formatted = PerformanceMonitor.formatMetrics(metrics);

      expect(formatted).toBe('180ms, 5 returned');
    });

    it('should format metrics with all fields', () => {
      const metrics: QueryMetrics = {
        executionTime: 300,
        rowsAffected: 2,
        rowsReturned: 10
      };

      const formatted = PerformanceMonitor.formatMetrics(metrics);

      expect(formatted).toBe('300ms, 2 affected, 10 returned');
    });

    it('should not include zero values for rows affected', () => {
      const metrics: QueryMetrics = {
        executionTime: 120,
        rowsAffected: 0,
        rowsReturned: 5
      };

      const formatted = PerformanceMonitor.formatMetrics(metrics);

      expect(formatted).toBe('120ms, 5 returned');
    });

    it('should not include zero values for rows returned', () => {
      const metrics: QueryMetrics = {
        executionTime: 90,
        rowsAffected: 3,
        rowsReturned: 0
      };

      const formatted = PerformanceMonitor.formatMetrics(metrics);

      expect(formatted).toBe('90ms, 3 affected');
    });

    it('should handle undefined values', () => {
      const metrics: QueryMetrics = {
        executionTime: 200,
        rowsAffected: undefined,
        rowsReturned: undefined
      };

      const formatted = PerformanceMonitor.formatMetrics(metrics);

      expect(formatted).toBe('200ms');
    });

    it('should handle large numbers', () => {
      const metrics: QueryMetrics = {
        executionTime: 5500,
        rowsAffected: 1000000,
        rowsReturned: 50000
      };

      const formatted = PerformanceMonitor.formatMetrics(metrics);

      expect(formatted).toBe('5500ms, 1000000 affected, 50000 returned');
    });
  });

  describe('formatPerformanceMetrics', () => {
    it('should format metrics with execution time only', () => {
      const result = formatPerformanceMetrics({
        executionTime: 150
      });

      expect(result).toBe('150ms');
    });

    it('should format metrics with execution time and rows affected', () => {
      const result = formatPerformanceMetrics({
        executionTime: 250,
        rowsAffected: 3
      });

      expect(result).toBe('250ms, 3 affected');
    });

    it('should format metrics with execution time and rows returned', () => {
      const result = formatPerformanceMetrics({
        executionTime: 180,
        rowsReturned: 5
      });

      expect(result).toBe('180ms, 5 returned');
    });

    it('should format metrics with all fields', () => {
      const result = formatPerformanceMetrics({
        executionTime: 300,
        rowsAffected: 2,
        rowsReturned: 10
      });

      expect(result).toBe('300ms, 2 affected, 10 returned');
    });

    it('should handle zero values correctly', () => {
      const result = formatPerformanceMetrics({
        executionTime: 120,
        rowsAffected: 0,
        rowsReturned: 0
      });

      expect(result).toBe('120ms');
    });

    it('should handle undefined values', () => {
      const result = formatPerformanceMetrics({
        executionTime: 200,
        rowsAffected: undefined,
        rowsReturned: undefined
      });

      expect(result).toBe('200ms');
    });

    it('should handle mixed zero and undefined values', () => {
      const result = formatPerformanceMetrics({
        executionTime: 160,
        rowsAffected: 0,
        rowsReturned: undefined
      });

      expect(result).toBe('160ms');
    });
  });
});
