import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';
import { ReadQueryInputSchema, type ReadQueryInput } from '../schemas/read-query.js';
import { DEFAULT_CONFIG } from '../lib/constants.js';
import type { ResultSet } from '@libsql/client';

export class ReadQueryTool extends BaseTool {
  readonly name = 'read-query';
  readonly description = 'Execute SELECT queries on the libSQL database';
  readonly inputSchema = ReadQueryInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { query, parameters } = context.arguments as ReadQueryInput;

    try {
      const startTime = Date.now();

      // Execute query with timeout handling
      const result = await Promise.race([
        parameters && parameters.length > 0
          ? context.connection.execute(query, parameters)
          : context.connection.execute(query),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Query timeout after ${DEFAULT_CONFIG.queryTimeout}ms`)), DEFAULT_CONFIG.queryTimeout)
        )
      ]) as ResultSet;

      const executionTime = Date.now() - startTime;

      // Check result size limit
      if (result.rows.length > DEFAULT_CONFIG.maxResultSize) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Query result too large (${result.rows.length} rows, max ${DEFAULT_CONFIG.maxResultSize})`
            }
          ],
          isError: true
        };
      }

      const metrics = formatPerformanceMetrics({
        executionTime,
        rowsReturned: result.rows.length
      });

      // Format the results
      let output = 'Query executed successfully\n\n';

      if (result.rows.length === 0) {
        output += 'No rows returned.\n';
      } else {
        // Format as a table
        const columns = result.columns || [];
        output += `Found ${result.rows.length} row(s):\n\n`;

        if (columns.length > 0) {
          // Calculate column widths for better formatting
          const columnWidths = columns.map((col: string) => {
            const headerWidth = col.length;
            const maxDataWidth = Math.max(
              ...result.rows.slice(0, 100).map((row: Record<string, unknown>) => {
                const value = row[col];
                return value === null ? 4 : String(value).length; // 4 for 'NULL'
              })
            );
            return Math.max(headerWidth, maxDataWidth, 3); // Minimum 3 chars
          });

          // Add column headers with proper spacing
          const headerRow = columns.map((col: string, i: number) =>
            col.padEnd(columnWidths[i] || 0)
          ).join(' | ');
          output += `${headerRow}\n`;

          // Add separator
          const separator = columnWidths.map((width: number) => '-'.repeat(width)).join('-+-');
          output += `${separator}\n`;

          // Add rows (limit to first 100 rows for display)
          const displayRows = result.rows.slice(0, 100);
          for (const row of displayRows) {
            const rowValues = columns.map((col: string, i: number) => {
              const value = row[col];
              const displayValue = value === null ? 'NULL' : String(value);
              return displayValue.padEnd(columnWidths[i] || 0);
            });
            output += `${rowValues.join(' | ')}\n`;
          }

          if (result.rows.length > 100) {
            output += `\n... and ${result.rows.length - 100} more rows (use LIMIT clause to see more)\n`;
          }
        } else {
          // Fallback for queries without column metadata
          output += JSON.stringify(result.rows.slice(0, 10), null, 2);
          if (result.rows.length > 10) {
            output += `\n... and ${result.rows.length - 10} more rows\n`;
          }
        }
      }

      output += `\nPerformance: ${metrics}`;

      // Add query info if parameters were used
      if (parameters && parameters.length > 0) {
        output += `\nParameters: ${parameters.length} parameter(s) used`;
      }

      return {
        content: [
          {
            type: 'text',
            text: output
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing query: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
}
