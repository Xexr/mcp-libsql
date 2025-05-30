# Security Features

## Multi-Layer SQL Injection Prevention

- **Input Validation**: Comprehensive Zod schema validation with pattern detection
- **System Table Protection**: Blocks access to sqlite_master, sqlite_sequence, etc.
- **Multi-Statement Blocking**: Prevents stacked queries and command injection
- **Operation Restriction**: Tool-specific query type enforcement
- **Parameter Safety**: Full support for parameterized queries
- **Function Filtering**: Blocks dangerous functions like load_extension

## Security Test Coverage

67 comprehensive security tests covering:
- Multi-statement injection ('; DROP TABLE)
- System table access attempts
- UNION-based data exfiltration
- Comment-based evasion (/**/, --)
- DDL injection in data queries
- Time-based and boolean-based blind injection
- Whitespace normalization attacks

## Audit Trail

- Connection events (establish, fail, close)
- Query execution with parameters and timing
- Transaction lifecycle (start, commit, rollback)
- Security validation failures
- Performance metrics for compliance

## Security Architecture Example

```typescript
// Multi-layer validation example
const schema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .max(10000, 'Query too long')
    .refine(query => /^SELECT/i.test(query.trim()), 'Only SELECT queries allowed')
    .refine(query => !containsSystemTables(query), 'System table access denied')
    .refine(query => !containsMultiStatement(query), 'Multi-statement queries blocked')
});
```