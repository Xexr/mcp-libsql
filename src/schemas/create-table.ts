import { z } from 'zod';

/**
 * Input schema for create-table tool
 * Validates CREATE TABLE DDL statements with security measures
 */
export const CreateTableInputSchema = z.object({
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(10000, 'Query too long (max 10,000 characters)')
    .refine(
      query => {
        const trimmed = query.trim().toLowerCase();
        return trimmed.startsWith('create table');
      },
      {
        message: 'Only CREATE TABLE statements are allowed'
      }
    )
    .refine(
      query => {
        // Check for dangerous patterns that shouldn't be in DDL
        const prohibited = [
          'pragma',
          'attach',
          'detach',
          'drop',
          'delete',
          'insert',
          'update',
          'truncate',
          'vacuum',
          'reindex',
          'exec',
          'execute'
        ];
        const lowerQuery = query.toLowerCase();
        return !prohibited.some(pattern => lowerQuery.includes(pattern));
      },
      {
        message: 'Query contains prohibited operations'
      }
    )
    .refine(
      query => {
        // Prevent queries that try to access sensitive system tables
        const systemTables = ['sqlite_master', 'sqlite_temp_master', 'sqlite_sequence'];
        const lowerQuery = query.toLowerCase();
        return !systemTables.some(table => lowerQuery.includes(table));
      },
      {
        message: 'Query attempts to access system tables'
      }
    )
    .refine(
      query => {
        // Basic CREATE TABLE syntax validation
        const lowerQuery = query.toLowerCase();
        // Must contain table name and column definitions
        const hasTableName = /create\s+table\s+(?:if\s+not\s+exists\s+)?[\w"`[\]]+\s*\(/i.test(
          query
        );
        const hasColumns = /\(\s*\w+/i.test(query);
        const hasClosingParen = lowerQuery.includes(')');
        return hasTableName && hasColumns && hasClosingParen;
      },
      {
        message: 'Invalid CREATE TABLE syntax - must include table name and column definitions'
      }
    ),
  parameters: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .default([])
    .refine(params => params.length <= 100, {
      message: 'Too many parameters (max 100)'
    }),
  useTransaction: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to wrap the DDL in a transaction for automatic rollback on errors'),
  ifNotExists: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to add IF NOT EXISTS clause to prevent errors if table already exists')
});

export type CreateTableInput = z.infer<typeof CreateTableInputSchema>;
