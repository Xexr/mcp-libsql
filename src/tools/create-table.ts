import { z } from 'zod';
import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';

const CreateTableInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty')
});

export class CreateTableTool extends BaseTool {
  readonly name = 'create-table';
  readonly description = 'Create a new table in the libSQL database';
  readonly inputSchema = CreateTableInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { query } = context.arguments as z.infer<typeof CreateTableInputSchema>;

    // Validate that this is a CREATE TABLE query
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('create table')) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Only CREATE TABLE statements are allowed'
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

      let output = 'Table created successfully\n\n';
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
            text: `Error creating table: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
}
