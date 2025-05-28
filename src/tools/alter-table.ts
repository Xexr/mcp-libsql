import { z } from 'zod';
import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';

const AlterTableInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty')
});

export class AlterTableTool extends BaseTool {
  readonly name = 'alter-table';
  readonly description = 'Alter existing table structure in the libSQL database';
  readonly inputSchema = AlterTableInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { query } = context.arguments as z.infer<typeof AlterTableInputSchema>;

    // Validate that this is an ALTER TABLE query
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('alter table')) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Only ALTER TABLE statements are allowed'
          }
        ],
        isError: true
      };
    }

    try {
      const startTime = Date.now();
      await context.connection.execute(query);
      const executionTime = Date.now() - startTime;

      const metrics = formatPerformanceMetrics({
        executionTime
      });

      let output = 'Table altered successfully\n\n';
      output += 'Query executed successfully\n';
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
            text: `Error altering table: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
}
