import { z } from 'zod';

/**
 * Input schema for list-tables tool
 * Validates options for database table listing
 */
export const ListTablesInputSchema = z.object({
  includeSystemTables: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include SQLite system tables (sqlite_*) in the output'),
  includeViews: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include database views in the output'),
  includeIndexes: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include database indexes in the output'),
  includeDetails: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include detailed information like row counts and CREATE statements'),
  pattern: z
    .string()
    .optional()
    .describe(
      'SQL LIKE pattern to filter table names (e.g., "user%" for tables starting with "user")'
    ),
  format: z
    .enum(['table', 'json', 'list'])
    .optional()
    .default('list')
    .describe(
      'Output format - table for detailed view, json for structured data, list for simple names'
    )
});

export type ListTablesInput = z.infer<typeof ListTablesInputSchema>;
