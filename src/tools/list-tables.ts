import { z } from 'zod';
import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';

const ListTablesInputSchema = z.object({});

export class ListTablesTool extends BaseTool {
  readonly name = 'list-tables';
  readonly description = 'List all tables in the libSQL database';
  readonly inputSchema = ListTablesInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const startTime = Date.now();

      // Query to get all table names (excluding system tables)
      const query = `
        SELECT name as table_name 
        FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `;

      const result = await context.connection.execute(query);
      const executionTime = Date.now() - startTime;

      const metrics = formatPerformanceMetrics({
        executionTime,
        rowsReturned: result.rows.length
      });

      let output = 'Database tables:\n\n';

      if (result.rows.length === 0) {
        output += 'No tables found in the database.\n';
      } else {
        output += `Found ${result.rows.length} table(s):\n\n`;

        for (const row of result.rows) {
          output += `- ${row.table_name}\n`;
        }
      }

      output += `\n${metrics}`;

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
            text: `Error listing tables: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
}
