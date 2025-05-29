import { z } from 'zod';

/**
 * Input schema for alter-table tool
 * Validates ALTER TABLE DDL statements with security measures
 */
export const AlterTableInputSchema = z.object({
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(10000, 'Query too long (max 10,000 characters)')
    .refine(
      query => {
        const trimmed = query.trim().toLowerCase();
        return trimmed.startsWith('alter table');
      },
      {
        message: 'Only ALTER TABLE statements are allowed'
      }
    )
    .refine(
      query => {
        // Check for dangerous patterns that shouldn't be in DDL
        const prohibited = [
          'pragma',
          'attach',
          'detach',
          'drop table',
          'drop database',
          'drop view',
          'drop index',
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
        // Check for multi-statement patterns - semicolon is the key indicator
        return !query.includes(';');
      },
      {
        message: 'Multi-statement queries are not allowed'
      }
    )
    .refine(
      query => {
        // Basic ALTER TABLE syntax validation
        const lowerQuery = query.toLowerCase();
        // Must contain valid ALTER TABLE operations
        const hasAddColumn = lowerQuery.includes('add column') || /\badd\s+\w+\s+\w+/.test(lowerQuery);
        const hasRename = lowerQuery.includes('rename to') || lowerQuery.includes('rename column');
        const hasDropColumn = lowerQuery.includes('drop column');
        const hasTableName = /alter\s+table\s+[\w"`[\]]+\s+/i.test(query);
        return hasTableName && (hasAddColumn || hasRename || hasDropColumn);
      },
      {
        message:
          'Invalid ALTER TABLE syntax - must include table name and valid operation (ADD COLUMN, RENAME TO, RENAME COLUMN, DROP COLUMN)'
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
  ifExists: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to add IF EXISTS clause to prevent errors if table does not exist')
});

export type AlterTableInput = z.infer<typeof AlterTableInputSchema>;
