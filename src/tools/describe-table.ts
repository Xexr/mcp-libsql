import { z } from 'zod';
import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';

const DescribeTableInputSchema = z.object({
  tableName: z.string().min(1, 'Table name cannot be empty')
});

export class DescribeTableTool extends BaseTool {
  readonly name = 'describe-table';
  readonly description = 'Get schema information for a specific table';
  readonly inputSchema = DescribeTableInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { tableName } = context.arguments as z.infer<typeof DescribeTableInputSchema>;

    try {
      const startTime = Date.now();

      // First check if table exists
      const tableExistsQuery = `
        SELECT name 
        FROM sqlite_master 
        WHERE type='table' AND name=?
      `;

      const tableExistsResult = await context.connection.execute(tableExistsQuery, [tableName]);

      if (tableExistsResult.rows.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Table '${tableName}' does not exist`
            }
          ],
          isError: true
        };
      }

      // Get table schema information
      const schemaQuery = `PRAGMA table_info(${tableName})`;
      const schemaResult = await context.connection.execute(schemaQuery);

      // Get table indexes
      const indexQuery = `PRAGMA index_list(${tableName})`;
      const indexResult = await context.connection.execute(indexQuery);

      const executionTime = Date.now() - startTime;

      const metrics = formatPerformanceMetrics({
        executionTime
      });

      let output = `Table: ${tableName}\n\n`;

      // Display columns
      output += 'Columns:\n';
      output += 'Name\tType\tNot Null\tDefault\tPrimary Key\n';
      output += '----\t----\t--------\t-------\t-----------\n';

      for (const row of schemaResult.rows) {
        const name = row.name || '';
        const type = row.type || '';
        const notNull = row.notnull ? 'YES' : 'NO';
        const defaultValue = row.dflt_value || '';
        const primaryKey = row.pk ? 'YES' : 'NO';

        output += `${name}\t${type}\t${notNull}\t${defaultValue}\t${primaryKey}\n`;
      }

      // Display indexes if any
      if (indexResult.rows.length > 0) {
        output += '\nIndexes:\n';
        for (const row of indexResult.rows) {
          const indexName = row.name || '';
          const unique = row.unique ? 'UNIQUE' : 'INDEX';
          output += `- ${indexName} (${unique})\n`;
        }
      } else {
        output += '\nNo indexes found.\n';
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
            text: `Error describing table: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
}
