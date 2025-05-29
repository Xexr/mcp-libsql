import { z } from 'zod';

/**
 * Input schema for describe-table tool
 * Validates table names and options for schema inspection
 */
export const DescribeTableInputSchema = z.object({
  tableName: z
    .string()
    .min(1, 'Table name cannot be empty')
    .max(128, 'Table name too long (max 128 characters)')
    .refine(
      name => {
        // Basic validation for table name format
        const validNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$|^"[^"]+"|^'[^']+'|^`[^`]+`|^\[[^\]]+\]$/;
        return validNamePattern.test(name);
      },
      {
        message: 'Invalid table name format - must be a valid SQL identifier'
      }
    )
    .refine(
      name => {
        // Prevent access to sensitive system tables
        const systemTables = ['sqlite_master', 'sqlite_temp_master', 'sqlite_sequence'];
        const cleanName = name.replace(/["`'[\]]/g, '').toLowerCase();
        return !systemTables.includes(cleanName);
      },
      {
        message: 'Cannot describe system tables'
      }
    ),
  includeIndexes: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to include index information in the output'),
  includeForeignKeys: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to include foreign key information in the output'),
  includeConstraints: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to include check constraints and other constraints'),
  format: z
    .enum(['table', 'json'])
    .optional()
    .default('table')
    .describe('Output format - table for human-readable, json for structured data')
});

export type DescribeTableInput = z.infer<typeof DescribeTableInputSchema>;
