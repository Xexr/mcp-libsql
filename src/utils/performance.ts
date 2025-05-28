import type { QueryMetrics } from '../types/index.js';
import type { ResultSet } from '@libsql/client';

export class PerformanceMonitor {
  static createMetrics(startTime: number, endTime: number, result: ResultSet): QueryMetrics {
    const metrics: QueryMetrics = {
      executionTime: endTime - startTime,
      rowsAffected: result.rowsAffected,
      rowsReturned: result.rows.length
    };

    // libSQL doesn't provide query plans in the same way as SQLite
    // queryPlan is optional, so we don't include it if not available

    return metrics;
  }

  static async measureQuery<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();

    return {
      result,
      executionTime: endTime - startTime
    };
  }

  static formatMetrics(metrics: QueryMetrics): string {
    const parts = [`${metrics.executionTime}ms`];

    if (metrics.rowsAffected !== undefined && metrics.rowsAffected > 0) {
      parts.push(`${metrics.rowsAffected} affected`);
    }

    if (metrics.rowsReturned !== undefined && metrics.rowsReturned > 0) {
      parts.push(`${metrics.rowsReturned} returned`);
    }

    return parts.join(', ');
  }
}

export function formatPerformanceMetrics(params: {
  executionTime: number;
  rowsAffected?: number;
  rowsReturned?: number;
}): string {
  const metrics: QueryMetrics = {
    executionTime: params.executionTime,
    ...(params.rowsAffected !== undefined && { rowsAffected: params.rowsAffected }),
    ...(params.rowsReturned !== undefined && { rowsReturned: params.rowsReturned })
  };

  return PerformanceMonitor.formatMetrics(metrics);
}
