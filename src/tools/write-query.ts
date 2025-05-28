import { z } from 'zod';
import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';

const WriteQueryInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty')
});

export class WriteQueryTool extends BaseTool {
  readonly name = 'write-query';
  readonly description = 'Execute INSERT, UPDATE, DELETE queries on the libSQL database';
  readonly inputSchema = WriteQueryInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { query } = context.arguments as z.infer<typeof WriteQueryInputSchema>;

    // Validate that this is a write query
    const trimmedQuery = query.trim().toLowerCase();
    const writeOperations = ['insert', 'update', 'delete'];
    const isWriteQuery = writeOperations.some(op => trimmedQuery.startsWith(op));

    if (!isWriteQuery) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Only INSERT, UPDATE, DELETE queries are allowed for write operations'
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
        rowsAffected: result.rowsAffected
      });

      let output = 'Query executed successfully\n\n';
      output += `Rows affected: ${result.rowsAffected}\n`;

      if (result.lastInsertRowid !== undefined && result.lastInsertRowid !== null) {
        output += `Last insert row ID: ${result.lastInsertRowid}\n`;
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
