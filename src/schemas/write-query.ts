import { z } from 'zod';

/**
 * Input schema for write-query tool
 * Validates INSERT, UPDATE, DELETE queries with security measures
 */
export const WriteQueryInputSchema = z.object({
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(10000, 'Query too long (max 10,000 characters)')
    .refine(
      query => {
        const trimmed = query.trim().toLowerCase();
        const writeOperations = ['insert', 'update', 'delete'];
        return writeOperations.some(op => trimmed.startsWith(op));
      },
      {
        message: 'Only INSERT, UPDATE, DELETE queries are allowed for write operations'
      }
    )
    .refine(
      query => {
        // Check for dangerous patterns that shouldn't be in write queries
        const prohibited = [
          'pragma',
          'attach',
          'detach',
          'drop database',
          'drop table',
          'create',
          'alter',
          'truncate',
          'vacuum',
          'reindex'
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
        // Prevent queries that try to read from sensitive system tables
        const systemTables = ['sqlite_master', 'sqlite_temp_master', 'sqlite_sequence', 'pragma_'];
        const lowerQuery = query.toLowerCase();
        return !systemTables.some(table => lowerQuery.includes(table));
      },
      {
        message: 'Query attempts to access system tables'
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
    .describe('Whether to wrap the query in a transaction for automatic rollback on errors')
});

export type WriteQueryInput = z.infer<typeof WriteQueryInputSchema>;
