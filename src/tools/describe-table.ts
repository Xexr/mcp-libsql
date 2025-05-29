import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';
import { DescribeTableInputSchema, type DescribeTableInput } from '../schemas/describe-table.js';

export class DescribeTableTool extends BaseTool {
  readonly name = 'describe-table';
  readonly description =
    'Get comprehensive schema information for a specific table including columns, indexes, foreign keys, and constraints. Supports both human-readable and JSON output formats.';
  readonly inputSchema = DescribeTableInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { tableName, includeIndexes, includeForeignKeys, format } =
      context.arguments as DescribeTableInput;

    try {
      const startTime = Date.now();

      // Sanitize table name for PRAGMA queries
      const sanitizedTableName = this.sanitizeTableName(tableName);

      // First check if table exists
      const tableExistsQuery = `
        SELECT name, sql
        FROM sqlite_master 
        WHERE type='table' AND name=?
      `;

      const tableExistsResult = await context.connection.execute(tableExistsQuery, [
        sanitizedTableName
      ]);

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
      const schemaQuery = `PRAGMA table_info("${sanitizedTableName}")`;
      const schemaResult = await context.connection.execute(schemaQuery);

      const tableInfo = {
        name: sanitizedTableName,
        sql: tableExistsResult.rows[0].sql as string,
        columns: schemaResult.rows,
        indexes: [] as Array<Record<string, unknown>>,
        foreignKeys: [] as Array<Record<string, unknown>>
      };

      // Get table indexes if requested
      if (includeIndexes) {
        const indexQuery = `PRAGMA index_list("${sanitizedTableName}")`;
        const indexResult = await context.connection.execute(indexQuery);

        for (const index of indexResult.rows) {
          const indexInfoQuery = `PRAGMA index_info("${index.name}")`;
          const indexInfoResult = await context.connection.execute(indexInfoQuery);

          tableInfo.indexes.push({
            name: index.name,
            unique: index.unique,
            origin: index.origin,
            partial: index.partial,
            columns: indexInfoResult.rows
          });
        }
      }

      // Get foreign keys if requested
      if (includeForeignKeys) {
        const foreignKeyQuery = `PRAGMA foreign_key_list("${sanitizedTableName}")`;
        const foreignKeyResult = await context.connection.execute(foreignKeyQuery);
        tableInfo.foreignKeys = foreignKeyResult.rows;
      }

      const executionTime = Date.now() - startTime;

      const metrics = formatPerformanceMetrics({
        executionTime
      });

      if (format === 'json') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  table: tableInfo,
                  metadata: {
                    executionTime,
                    timestamp: new Date().toISOString()
                  }
                },
                null,
                2
              )
            }
          ]
        };
      }

      // Format as human-readable table
      let output = `Table: ${sanitizedTableName}\n\n`;

      // Display CREATE statement if available
      if (tableInfo.sql) {
        output += 'CREATE Statement:\n';
        output += `${tableInfo.sql}\n\n`;
      }

      // Display columns
      output += 'Columns:\n';
      output += '┌─────────────────┬─────────────────┬─────────┬─────────────┬─────────────┐\n';
      output += '│ Name            │ Type            │ Not Null│ Default     │ Primary Key │\n';
      output += '├─────────────────┼─────────────────┼─────────┼─────────────┼─────────────┤\n';

      for (const row of schemaResult.rows) {
        const name = String(row.name || '').padEnd(15);
        const type = String(row.type || '').padEnd(15);
        const notNull = (row.notnull ? 'YES' : 'NO').padEnd(7);
        const defaultValue = String(row.dflt_value || '').padEnd(11);
        const primaryKey = (row.pk ? 'YES' : 'NO').padEnd(11);

        output += `│ ${name} │ ${type} │ ${notNull} │ ${defaultValue} │ ${primaryKey} │\n`;
      }
      output += '└─────────────────┴─────────────────┴─────────┴─────────────┴─────────────┘\n\n';

      // Display indexes if requested and available
      if (includeIndexes && tableInfo.indexes.length > 0) {
        output += 'Indexes:\n';
        for (const index of tableInfo.indexes) {
          const indexRecord = index as Record<string, unknown>;
          const indexType = indexRecord['unique'] ? 'UNIQUE INDEX' : 'INDEX';
          const columns = indexRecord['columns'] as Array<Record<string, unknown>>;
          const columnNames = columns.map(col => col['name']).join(', ');
          output += `- ${indexRecord['name']} (${indexType}) on (${columnNames})\n`;
        }
        output += '\n';
      } else if (includeIndexes) {
        output += 'No indexes found.\n\n';
      }

      // Display foreign keys if requested and available
      if (includeForeignKeys && tableInfo.foreignKeys.length > 0) {
        output += 'Foreign Keys:\n';
        for (const fk of tableInfo.foreignKeys) {
          const fkRecord = fk as Record<string, unknown>;
          output += `- ${fkRecord['from']} → ${fkRecord['table']}.${fkRecord['to']} (${fkRecord['on_update']}/${fkRecord['on_delete']})\n`;
        }
        output += '\n';
      } else if (includeForeignKeys) {
        output += 'No foreign keys found.\n\n';
      }

      output += `${metrics}`;

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

  /**
   * Sanitize table name for safe use in PRAGMA queries
   */
  private sanitizeTableName(tableName: string): string {
    // Remove quotes if present and validate
    return tableName.replace(/^["'`[]|["'`]]$/g, '');
  }
}
