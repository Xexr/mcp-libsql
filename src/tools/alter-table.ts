import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';
import { AlterTableInputSchema, type AlterTableInput } from '../schemas/alter-table.js';

export class AlterTableTool extends BaseTool {
  readonly name = 'alter-table';
  readonly description =
    'Execute ALTER TABLE DDL statements on the libSQL database. Supports adding columns, renaming tables/columns, and dropping columns with transaction support for safety.';
  readonly inputSchema = AlterTableInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { query, parameters, useTransaction, ifExists } = context.arguments as AlterTableInput;

    try {
      const startTime = Date.now();

      // Process the query to add IF EXISTS if requested (for DROP COLUMN operations)
      const processedQuery = query;
      if (
        ifExists &&
        query.toLowerCase().includes('drop column') &&
        !query.toLowerCase().includes('if exists')
      ) {
        // Note: SQLite doesn't support IF EXISTS for DROP COLUMN, but we'll note this in output
        // The query remains unchanged but we'll mention the limitation
      }

      // Validate the processed query
      this.validateAlterTableQuery(processedQuery);

      let result;

      if (useTransaction) {
        // Use transaction for automatic rollback on errors
        result = await context.connection.transaction(async tx => {
          return parameters && parameters.length > 0
            ? await tx.execute({ sql: processedQuery, args: parameters })
            : await tx.execute(processedQuery);
        });
      } else {
        // Execute directly without transaction
        result =
          parameters && parameters.length > 0
            ? await context.connection.execute(processedQuery, parameters)
            : await context.connection.execute(processedQuery);
      }

      const executionTime = Date.now() - startTime;

      const metrics = formatPerformanceMetrics({
        executionTime,
        rowsAffected: result.rowsAffected
      });

      // Extract table name and operation from query for user feedback
      const { tableName, operation } = this.extractTableInfo(processedQuery);

      let output = `Table altered successfully${useTransaction ? ' (with transaction)' : ''}\n\n`;
      output += `Table: ${tableName}\n`;
      output += `Operation: ${operation}\n`;

      if (ifExists && query.toLowerCase().includes('drop column')) {
        output += 'Note: SQLite does not support IF EXISTS for DROP COLUMN operations\n';
      }

      if (result.rowsAffected !== undefined) {
        output += `Rows affected: ${result.rowsAffected}\n`;
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
            text: `Error altering table: ${errorMessage}${rollbackMessage}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Additional validation for ALTER TABLE statements
   */
  private validateAlterTableQuery(query: string): void {
    const lowerQuery = query.toLowerCase();

    // Check for dangerous patterns
    if (lowerQuery.includes('trigger') || lowerQuery.includes('view')) {
      throw new Error('ALTER TABLE cannot contain TRIGGER or VIEW clauses');
    }

    // Validate that we have a proper table name
    if (!lowerQuery.match(/alter\s+table\s+[\w"`[\]]+/)) {
      throw new Error('ALTER TABLE must specify a valid table name');
    }

    // Check for minimum required elements based on operation
    if (lowerQuery.includes('add column') || lowerQuery.includes('add ')) {
      if (!lowerQuery.match(/add\s+(column\s+)?[\w"`[\]]+/)) {
        throw new Error('ADD COLUMN must specify a valid column name and type');
      }
    }
  }

  /**
   * Extract table name and operation from ALTER TABLE statement
   */
  private extractTableInfo(query: string): { tableName: string; operation: string } {
    // Normalize whitespace
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();

    // Extract table name - handle quoted and unquoted names
    const tablePatterns = [
      /ALTER TABLE "([^"]+)"/i, // Double quotes
      /ALTER TABLE '([^']+)'/i, // Single quotes
      /ALTER TABLE `([^`]+)`/i, // Backticks
      /ALTER TABLE \[([^\]]+)\]/i, // Square brackets
      /ALTER TABLE (\w+)/i // Unquoted
    ];

    let tableName = 'unknown';
    for (const pattern of tablePatterns) {
      const match = normalizedQuery.match(pattern);
      if (match && match[1]) {
        tableName = match[1];
        break;
      }
    }

    // Determine operation type
    const lowerQuery = normalizedQuery.toLowerCase();
    let operation = 'unknown';

    if (
      lowerQuery.includes('add column') ||
      (lowerQuery.includes('add ') && !lowerQuery.includes('add constraint'))
    ) {
      operation = 'ADD COLUMN';
    } else if (lowerQuery.includes('rename to')) {
      operation = 'RENAME TABLE';
    } else if (lowerQuery.includes('rename column')) {
      operation = 'RENAME COLUMN';
    } else if (lowerQuery.includes('drop column')) {
      operation = 'DROP COLUMN';
    }

    return { tableName, operation };
  }
}
