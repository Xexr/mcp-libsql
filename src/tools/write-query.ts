import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';
import { WriteQueryInputSchema, type WriteQueryInput } from '../schemas/write-query.js';

export class WriteQueryTool extends BaseTool {
  readonly name = 'write-query';
  readonly description =
    'Execute INSERT, UPDATE, DELETE queries on the libSQL database. Returns affected row count and performance metrics. Supports parameterized queries for security.';
  readonly inputSchema = WriteQueryInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { query, parameters, useTransaction } = context.arguments as WriteQueryInput;

    try {
      const startTime = Date.now();

      let result;

      if (useTransaction) {
        // Use transaction for automatic rollback on errors
        result = await context.connection.transaction(async tx => {
          return parameters && parameters.length > 0
            ? await tx.execute({ sql: query, args: parameters })
            : await tx.execute(query);
        });
      } else {
        // Execute directly without transaction
        result =
          parameters && parameters.length > 0
            ? await context.connection.execute(query, parameters)
            : await context.connection.execute(query);
      }

      const executionTime = Date.now() - startTime;

      const metrics = formatPerformanceMetrics({
        executionTime,
        rowsAffected: result.rowsAffected
      });

      let output = `Query executed successfully${useTransaction ? ' (with transaction)' : ''}\n\n`;
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
      const rollbackMessage = useTransaction ? ' (transaction rolled back)' : '';
      return {
        content: [
          {
            type: 'text',
            text: `Error executing query: ${errorMessage}${rollbackMessage}`
          }
        ],
        isError: true
      };
    }
  }
}
