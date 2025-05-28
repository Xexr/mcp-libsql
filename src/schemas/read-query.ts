import { z } from 'zod';

/**
 * Input schema for read-query tool
 * Validates SELECT queries with security measures
 */
export const ReadQueryInputSchema = z.object({
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(10000, 'Query too long (max 10,000 characters)')
    .refine(
      (query) => {
        const trimmed = query.trim().toLowerCase();
        return trimmed.startsWith('select');
      },
      {
        message: 'Only SELECT queries are allowed for read operations'
      }
    )
    .refine(
      (query) => {
        // Check for common dangerous patterns
        const dangerous = [
          'pragma',
          'attach',
          'detach',
          'drop',
          'delete',
          'update',
          'insert',
          'create',
          'alter',
          'truncate'
        ];
        const lowerQuery = query.toLowerCase();
        return !dangerous.some(pattern => lowerQuery.includes(pattern));
      },
      {
        message: 'Query contains prohibited operations'
      }
    ),
  parameters: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .default([])
    .refine(
      (params) => params.length <= 100,
      {
        message: 'Too many parameters (max 100)'
      }
    )
});

export type ReadQueryInput = z.infer<typeof ReadQueryInputSchema>;
