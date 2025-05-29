import { BaseTool, type ToolExecutionContext, type ToolExecutionResult } from '../lib/base-tool.js';
import { formatPerformanceMetrics } from '../utils/performance.js';
import { CreateTableInputSchema, type CreateTableInput } from '../schemas/create-table.js';

export class CreateTableTool extends BaseTool {
  readonly name = 'create-table';
  readonly description =
    'Execute CREATE TABLE DDL statements on the libSQL database. Supports table creation with automatic IF NOT EXISTS handling and transaction support for safety.';
  readonly inputSchema = CreateTableInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { query, parameters, useTransaction, ifNotExists } =
      context.arguments as CreateTableInput;

    try {
      const startTime = Date.now();

      // Process the query to add IF NOT EXISTS if requested
      let processedQuery = query;
      if (ifNotExists && !query.toLowerCase().includes('if not exists')) {
        // Insert IF NOT EXISTS after CREATE TABLE
        processedQuery = query.replace(/create\s+table\s+/i, 'CREATE TABLE IF NOT EXISTS ');
      }

      // Validate the processed query
      this.validateCreateTableQuery(processedQuery);

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

      // Extract table name from query for user feedback
      const tableName = this.extractTableName(processedQuery);

      let output = `Table created successfully${useTransaction ? ' (with transaction)' : ''}\n\n`;
      output += `Table name: ${tableName}\n`;

      if (ifNotExists && !query.toLowerCase().includes('if not exists')) {
        output += 'Note: Added IF NOT EXISTS clause\n';
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
            text: `Error creating table: ${errorMessage}${rollbackMessage}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Additional validation for CREATE TABLE statements
   */
  private validateCreateTableQuery(query: string): void {
    const lowerQuery = query.toLowerCase();

    // Check for trigger or view patterns that don't belong in CREATE TABLE
    if (lowerQuery.includes(' trigger ') || lowerQuery.includes(' view ')) {
      throw new Error('CREATE TABLE cannot contain TRIGGER or VIEW clauses');
    }

    // Validate parentheses balance
    const openParens = (query.match(/\(/g) || []).length;
    const closeParens = (query.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      throw new Error('Unbalanced parentheses in CREATE TABLE statement');
    }

    // Check for minimum required elements
    if (!lowerQuery.includes('(') || !lowerQuery.includes(')')) {
      throw new Error('CREATE TABLE must include column definitions in parentheses');
    }
  }

  /**
   * Extract table name from CREATE TABLE statement
   */
  private extractTableName(query: string): string {
    // Remove IF NOT EXISTS and normalize whitespace
    const normalizedQuery = query
      .replace(/\s+/g, ' ')
      .replace(/create\s+table\s+if\s+not\s+exists\s+/i, 'CREATE TABLE ')
      .replace(/create\s+table\s+/i, 'CREATE TABLE ');

    // Extract table name - handle quoted and unquoted names
    const patterns = [
      /CREATE TABLE "([^"]+)"/i,  // Double quotes
      /CREATE TABLE '([^']+)'/i,  // Single quotes
      /CREATE TABLE `([^`]+)`/i,  // Backticks
      /CREATE TABLE \[([^\]]+)\]/i, // Square brackets
      /CREATE TABLE (\w+)/i       // Unquoted
    ];

    for (const pattern of patterns) {
      const match = normalizedQuery.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return 'unknown';
  }
}
