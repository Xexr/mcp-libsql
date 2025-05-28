import { z } from 'zod';
import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';

const ReadQueryInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty')
});

export class ReadQueryTool extends BaseTool {
  readonly name = 'read-query';
  readonly description = 'Execute SELECT queries on the libSQL database';
  readonly inputSchema = ReadQueryInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { query } = context.arguments as z.infer<typeof ReadQueryInputSchema>;

    // Validate that this is a SELECT query
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select')) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Only SELECT queries are allowed for read operations'
          }
        ],
        isError: true
      };
    }

    try {
      const startTime = Date.now();
      const result = await context.connection.execute(query);
      const executionTime = Date.now() - startTime;

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
        const columns = result.columns;
        output += `Found ${result.rows.length} row(s):\n\n`;

        // Add column headers
        output += `${columns.join('\t')  }\n`;
        output += `${columns.map(() => '---').join('\t')  }\n`;

        // Add rows (limit to first 100 rows for display)
        const displayRows = result.rows.slice(0, 100);
        for (const row of displayRows) {
          const rowValues = columns.map((col: string) => {
            const value = row[col];
            return value === null ? 'NULL' : String(value);
          });
          output += `${rowValues.join('\t')  }\n`;
        }

        if (result.rows.length > 100) {
          output += `\n... and ${result.rows.length - 100} more rows\n`;
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
            text: `Error executing query: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
}
