import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';
import { ListTablesInputSchema, type ListTablesInput } from '../schemas/list-tables.js';

export class ListTablesTool extends BaseTool {
  readonly name = 'list-tables';
  readonly description =
    'List all tables, views, and indexes in the libSQL database with optional filtering and detailed information. Supports multiple output formats and pattern matching.';
  readonly inputSchema = ListTablesInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { includeSystemTables, includeViews, includeIndexes, includeDetails, pattern, format } =
      context.arguments as ListTablesInput;

    try {
      const startTime = Date.now();

      // Build the query based on options
      const objects = await this.getSchemaObjects(context, {
        includeSystemTables,
        includeViews,
        includeIndexes,
        ...(pattern && { pattern })
      });

      const executionTime = Date.now() - startTime;

      if (format === 'json') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  objects,
                  metadata: {
                    totalCount: objects.length,
                    executionTime,
                    timestamp: new Date().toISOString(),
                    filters: {
                      includeSystemTables,
                      includeViews,
                      includeIndexes,
                      pattern
                    }
                  }
                },
                null,
                2
              )
            }
          ]
        };
      }

      const metrics = formatPerformanceMetrics({
        executionTime,
        rowsReturned: objects.length
      });

      if (format === 'table' || includeDetails) {
        return this.formatAsTable(objects, metrics);
      } else {
        return this.formatAsList(objects, metrics);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error listing database objects: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }

  private async getSchemaObjects(
    context: ToolExecutionContext,
    options: {
      includeSystemTables: boolean;
      includeViews: boolean;
      includeIndexes: boolean;
      pattern?: string;
    }
  ): Promise<unknown[]> {
    const types = ['table'];
    if (options.includeViews) types.push('view');
    if (options.includeIndexes) types.push('index');

    const whereConditions = [`type IN (${types.map(() => '?').join(', ')})`];
    const params = [...types];

    // System tables filter
    if (!options.includeSystemTables) {
      whereConditions.push("name NOT LIKE 'sqlite_%'");
    }

    // Pattern filter
    if (options.pattern) {
      whereConditions.push('name LIKE ?');
      params.push(options.pattern);
    }

    const query = `
      SELECT name, type, sql
      FROM sqlite_master 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY type, name
    `;

    const result = await context.connection.execute(query, params);

    const objects = [];
    for (const row of result.rows) {
      const rowRecord = row as Record<string, unknown>;
      const obj: Record<string, unknown> = {
        name: rowRecord['name'],
        type: rowRecord['type'],
        sql: rowRecord['sql'],
        rowCount: null,
        columnCount: null
      };

      // Get additional details for tables if requested
      if (rowRecord['type'] === 'table') {
        try {
          // Get row count
          const countQuery = `SELECT COUNT(*) as count FROM "${rowRecord['name']}"`;
          const countResult = await context.connection.execute(countQuery);
          obj['rowCount'] = (countResult.rows[0] as Record<string, unknown>)?.['count'] || 0;

          // Get column count
          const columnsQuery = `PRAGMA table_info("${rowRecord['name']}")`;
          const columnsResult = await context.connection.execute(columnsQuery);
          obj['columnCount'] = columnsResult.rows.length;
        } catch {
          // If we can't get details, continue without them
          obj['rowCount'] = null;
          obj['columnCount'] = null;
        }
      }

      objects.push(obj);
    }

    return objects;
  }

  private formatAsTable(objects: unknown[], metrics: string): ToolExecutionResult {
    let output = 'Database Schema Objects:\n\n';

    if (objects.length === 0) {
      output += 'No objects found matching the criteria.\n';
    } else {
      output +=
        '┌─────────────────────┬─────────┬───────┬─────────┬──────────────────────────────────────┐\n';
      output +=
        '│ Name                │ Type    │ Rows  │ Columns │ Description                          │\n';
      output +=
        '├─────────────────────┼─────────┼───────┼─────────┼──────────────────────────────────────┤\n';

      for (const obj of objects as Record<string, unknown>[]) {
        const name = String(obj['name'] || '').padEnd(19);
        const type = String(obj['type'] || '').padEnd(7);
        const rowCount = obj['rowCount'] !== null ? String(obj['rowCount']).padEnd(5) : 'N/A'.padEnd(5);
        const columnCount =
          obj['columnCount'] !== null ? String(obj['columnCount']).padEnd(7) : 'N/A'.padEnd(7);

        // Extract a brief description from SQL
        let description = '';
        const sqlValue = obj['sql'];
        if (sqlValue && typeof sqlValue === 'string') {
          const match = sqlValue.match(/CREATE\s+(TABLE|VIEW|INDEX)\s+[^(]+(\([^)]*\))?/i);
          if (match) {
            description = match[0].replace(/\s+/g, ' ').substring(0, 36);
          }
        }
        description = description.padEnd(36);

        output += `│ ${name} │ ${type} │ ${rowCount} │ ${columnCount} │ ${description} │\n`;
      }
      output +=
        '└─────────────────────┴─────────┴───────┴─────────┴──────────────────────────────────────┘\n\n';

      // Summary
      const objectArray = objects as Record<string, unknown>[];
      const tableCount = objectArray.filter(o => o['type'] === 'table').length;
      const viewCount = objectArray.filter(o => o['type'] === 'view').length;
      const indexCount = objectArray.filter(o => o['type'] === 'index').length;

      output += `Summary: ${tableCount} tables, ${viewCount} views, ${indexCount} indexes\n`;
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
  }

  private formatAsList(objects: unknown[], metrics: string): ToolExecutionResult {
    let output = 'Database Objects:\n\n';

    if (objects.length === 0) {
      output += 'No objects found matching the criteria.\n';
    } else {
      const groupedObjects = (objects as Record<string, unknown>[]).reduce(
        (acc, obj) => {
          const type = String(obj['type']);
          if (!acc[type]) acc[type] = [];
          (acc[type] as Record<string, unknown>[]).push(obj);
          return acc;
        },
        {} as Record<string, Record<string, unknown>[]>
      );

      for (const [type, items] of Object.entries(groupedObjects)) {
        const typedItems = items as Record<string, unknown>[];
        // Handle proper pluralization
        const pluralType = type === 'index' ? 'INDEXES' : `${type.toUpperCase()}S`;
        output += `${pluralType} (${typedItems.length}):\n`;
        for (const item of typedItems) {
          output += `- ${item['name']}`;
          if (item['rowCount'] !== null && item['rowCount'] !== undefined) {
            output += ` (${item['rowCount']} rows)`;
          }
          output += '\n';
        }
        output += '\n';
      }
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
  }
}
