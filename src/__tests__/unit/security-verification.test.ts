import { describe, it, expect } from 'vitest';
import { ReadQueryInputSchema } from '../../schemas/read-query.js';
import { WriteQueryInputSchema } from '../../schemas/write-query.js';
import { CreateTableInputSchema } from '../../schemas/create-table.js';
import { AlterTableInputSchema } from '../../schemas/alter-table.js';
import { DescribeTableInputSchema } from '../../schemas/describe-table.js';

/**
 * Security verification tests that validate our input schemas
 * properly reject SQL injection attempts at the validation layer
 */
describe('Security Verification - Input Validation', () => {
  describe('Read Query Schema Security', () => {
    const sqlInjectionAttempts = [
      // Multi-statement injection
      'SELECT * FROM users; DROP TABLE users; --',
      "SELECT * FROM users; INSERT INTO users VALUES (999, 'hacker', 'evil@test.com', 'admin')",

      // System table access
      'SELECT * FROM sqlite_master',
      'SELECT * FROM sqlite_sequence',
      "SELECT * FROM pragma_table_info('users')",

      // UNION-based injection
      'SELECT * FROM users UNION SELECT * FROM sqlite_master',
      'SELECT username FROM users UNION SELECT sql FROM sqlite_master',

      // Comment-based evasion
      'SELECT * FROM users/**/UNION/**/SELECT/**/sql/**/FROM/**/sqlite_master',
      'SELECT * FROM users --\\nUNION SELECT * FROM sqlite_master',

      // DDL injection attempts
      'SELECT * FROM users; CREATE TABLE evil (data TEXT)',
      'SELECT * FROM users; ALTER TABLE users ADD COLUMN evil TEXT',
      "SELECT * FROM users; UPDATE users SET role='admin'",
      'SELECT * FROM users; DELETE FROM users',

      // PRAGMA injection
      'SELECT * FROM users; PRAGMA foreign_keys=OFF',
      "SELECT * FROM users; ATTACH DATABASE ':memory:' AS temp",
      'SELECT * FROM users; DETACH DATABASE main',

      // Function-based attacks
      "SELECT load_extension('/etc/passwd')",
      'SELECT randomblob(1000000000)',
      'SELECT hex(randomblob(10000))',

      // Case variation evasion
      'SeLeCt * FrOm UsErS uNiOn SeLeCt * FrOm sQlItE_mAsTeR',
      'select * from users; DROP table users',

      // Classic injection patterns (Note: OR 1=1 is syntactically valid, should be prevented by parameterized queries)

      // Nested injection attempts
      "SELECT (SELECT sql FROM sqlite_master WHERE type='table')",
      'SELECT * FROM users WHERE username IN (SELECT name FROM sqlite_master)',

      // Whitespace variations
      'SELECT\t*\nFROM\rusers\fUNION\vSELECT\r\n*\tFROM\fsqlite_master'
    ];

    it.each(sqlInjectionAttempts)('should reject injection attempt: %s', maliciousQuery => {
      const result = ReadQueryInputSchema.safeParse({ query: maliciousQuery });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessage = result.error.errors[0].message;
        expect(errorMessage).toMatch(
          /Only SELECT queries are allowed|Query contains prohibited operations|Query attempts to access system tables|Multi-statement queries are not allowed/
        );
      }
    });

    it('should allow legitimate SELECT queries', () => {
      const legitimateQueries = [
        'SELECT * FROM users',
        "SELECT username, email FROM users WHERE role = 'user'",
        'SELECT COUNT(*) FROM users',
        'SELECT DISTINCT role FROM users',
        'SELECT * FROM users ORDER BY username LIMIT 10',
        'select * from users',
        'Select * From Users'
      ];

      for (const query of legitimateQueries) {
        const result = ReadQueryInputSchema.safeParse({ query });
        expect(result.success).toBe(true);
      }
    });

    it('should note that logic-based injections require parameterized queries for protection', () => {
      // These queries are syntactically valid but are classic SQL injection patterns
      // They should be prevented by using parameterized queries, not schema validation
      const logicBasedInjections = [
        'SELECT * FROM users WHERE id = 1 OR 1=1',
        "SELECT * FROM users WHERE username = '' OR '1'='1'"
      ];

      // These are syntactically valid SQL, so they pass schema validation
      // Protection against these requires parameterized queries at runtime
      for (const query of logicBasedInjections) {
        const result = ReadQueryInputSchema.safeParse({ query });
        expect(result.success).toBe(true); // Syntactically valid
      }
    });

    it('should enforce parameter limits', () => {
      // Too many parameters
      const tooManyParams = new Array(101).fill('param');
      const result = ReadQueryInputSchema.safeParse({
        query: 'SELECT * FROM users',
        parameters: tooManyParams
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toMatch(/Too many parameters/);
      }
    });

    it('should enforce query length limits', () => {
      const hugeQuery = 'SELECT * FROM users WHERE ' + 'x=1 OR '.repeat(10000) + '1=1';
      const result = ReadQueryInputSchema.safeParse({ query: hugeQuery });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toMatch(/Query too long/);
      }
    });
  });

  describe('Write Query Schema Security', () => {
    const writeInjectionAttempts = [
      // Multi-statement injections
      "INSERT INTO users (username) VALUES ('test'); DROP TABLE users; --",
      "UPDATE users SET username = 'test'; DROP TABLE users; --",
      'DELETE FROM users; DROP TABLE users; --',

      // System table manipulation
      "UPDATE sqlite_master SET sql = 'malicious'",
      "INSERT INTO sqlite_sequence VALUES ('users', 9999999)",
      'DELETE FROM sqlite_master',

      // DDL injection
      "INSERT INTO users VALUES (1, 'test', 'test@test.com', 'user'); CREATE TABLE evil (x TEXT)",
      "UPDATE users SET username = 'test'; ALTER TABLE users ADD COLUMN evil TEXT",

      // PRAGMA injections
      "INSERT INTO users VALUES (1, 'test', 'test@test.com', 'user'); PRAGMA foreign_keys=OFF",
      "UPDATE users SET username = 'test'; PRAGMA journal_mode=DELETE",

      // Subquery injections with system tables
      'INSERT INTO users SELECT * FROM sqlite_master',
      'UPDATE users SET username = (SELECT name FROM sqlite_master LIMIT 1)'
    ];

    it.each(writeInjectionAttempts)('should reject write injection: %s', maliciousQuery => {
      const result = WriteQueryInputSchema.safeParse({ query: maliciousQuery });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessage = result.error.errors[0].message;
        expect(errorMessage).toMatch(
          /Only INSERT, UPDATE, DELETE queries are allowed|Query contains prohibited operations|Query attempts to access system tables/
        );
      }
    });

    it('should allow legitimate write queries', () => {
      const legitimateQueries = [
        "INSERT INTO users (username, email) VALUES ('newuser', 'new@example.com')",
        "UPDATE users SET email = 'updated@example.com' WHERE id = 1",
        "DELETE FROM users WHERE username = 'test'",
        "insert into users (username) values ('test')",
        "Update Users Set Email = 'test@test.com' Where Id = 1"
      ];

      for (const query of legitimateQueries) {
        const result = WriteQueryInputSchema.safeParse({ query });
        expect(result.success).toBe(true);
      }
    });

    it('should reject SELECT queries in write tool', () => {
      const selectQueries = ['SELECT * FROM users', 'SELECT username FROM users WHERE id = 1'];

      for (const query of selectQueries) {
        const result = WriteQueryInputSchema.safeParse({ query });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toMatch(
            /Only INSERT, UPDATE, DELETE queries are allowed/
          );
        }
      }
    });
  });

  describe('DDL Schema Security', () => {
    const ddlInjectionAttempts = [
      // CREATE TABLE injections
      'CREATE TABLE test (id INT); DROP TABLE users; --',
      "CREATE TABLE test (id INT); INSERT INTO users VALUES (999, 'hacker', 'evil@test.com', 'admin')",
      'CREATE TABLE test AS SELECT * FROM sqlite_master',
      'CREATE TABLE test (id INT); PRAGMA foreign_keys=OFF',

      // ALTER TABLE injections
      'ALTER TABLE users ADD COLUMN test TEXT; DROP TABLE users; --',
      'ALTER TABLE users RENAME TO users_backup; CREATE TABLE users AS SELECT * FROM sqlite_master',
      "ALTER TABLE users ADD COLUMN evil TEXT; INSERT INTO users VALUES (999, 'hacker', 'evil@test.com', 'admin', 'evil')",
      'ALTER TABLE users ADD COLUMN test TEXT; PRAGMA foreign_keys=OFF'
    ];

    it.each(ddlInjectionAttempts.slice(0, 4))(
      'should reject CREATE TABLE injection: %s',
      maliciousStatement => {
        const result = CreateTableInputSchema.safeParse({ query: maliciousStatement });

        expect(result.success).toBe(false);
        if (!result.success) {
          const errorMessage = result.error.errors[0].message;
          expect(errorMessage).toMatch(
            /Only CREATE TABLE statements are allowed|Query contains prohibited operations|Multi-statement queries are not allowed|Query attempts to access system tables/
          );
        }
      }
    );

    it.each(ddlInjectionAttempts.slice(4))(
      'should reject ALTER TABLE injection: %s',
      maliciousStatement => {
        const result = AlterTableInputSchema.safeParse({ query: maliciousStatement });

        expect(result.success).toBe(false);
        if (!result.success) {
          const errorMessage = result.error.errors[0].message;
          expect(errorMessage).toMatch(
            /Only ALTER TABLE statements are allowed|Query contains prohibited operations|Multi-statement queries are not allowed|Query attempts to access system tables/
          );
        }
      }
    );

    it('should allow legitimate DDL statements', () => {
      // CREATE TABLE
      const createResult = CreateTableInputSchema.safeParse({
        query: 'CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)'
      });
      expect(createResult.success).toBe(true);

      // ALTER TABLE
      const alterResult = AlterTableInputSchema.safeParse({
        query: 'ALTER TABLE test_table ADD COLUMN email TEXT'
      });
      expect(alterResult.success).toBe(true);
    });
  });

  describe('Table Name Validation', () => {
    const maliciousTableNames = [
      "'; DROP TABLE users; --",
      "users'; INSERT INTO users VALUES (999, 'hacker', 'evil@test.com', 'admin'); --",
      'users UNION SELECT * FROM sqlite_master',
      '(SELECT sql FROM sqlite_master)',
      'users; PRAGMA foreign_keys=OFF',
      '../../../etc/passwd',
      "users\\'; EXEC xp_cmdshell('dir'); --",
      'users/**/UNION/**/SELECT/**/*/**/FROM/**/sqlite_master'
    ];

    it.each(maliciousTableNames)('should reject malicious table name: %s', maliciousName => {
      const result = DescribeTableInputSchema.safeParse({ tableName: maliciousName });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessage = result.error.errors[0].message;
        expect(errorMessage).toMatch(/Invalid table name/);
      }
    });

    it('should allow legitimate table names', () => {
      const legitimateNames = ['users', 'user_profiles', 'UserData', 'table123', 'my_table_2024'];

      for (const tableName of legitimateNames) {
        const result = DescribeTableInputSchema.safeParse({ tableName });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Parameter Type Validation', () => {
    it('should validate parameter types in read queries', () => {
      // Valid parameter types
      const validParams = [[1, 'string', true, null], ['test'], [42], [false]];

      for (const params of validParams) {
        const result = ReadQueryInputSchema.safeParse({
          query: 'SELECT * FROM users WHERE id = ?',
          parameters: params
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid parameter types', () => {
      const invalidParams = [
        [undefined],
        [{}],
        [[]],
        [new Date()],
        [Symbol('test')],
        [function () {}]
      ];

      for (const params of invalidParams) {
        const result = ReadQueryInputSchema.safeParse({
          query: 'SELECT * FROM users WHERE id = ?',
          parameters: params
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Resource Limits', () => {
    it('should enforce reasonable limits on all inputs', () => {
      // Empty query
      let result = ReadQueryInputSchema.safeParse({ query: '' });
      expect(result.success).toBe(false);

      // Very long query
      const longQuery = 'SELECT * FROM users WHERE ' + "column = 'value' AND ".repeat(1000) + '1=1';
      result = ReadQueryInputSchema.safeParse({ query: longQuery });
      expect(result.success).toBe(false);

      // Too many parameters
      const manyParams = new Array(150).fill('value');
      result = ReadQueryInputSchema.safeParse({
        query: 'SELECT * FROM users',
        parameters: manyParams
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Advanced Injection Techniques', () => {
    it('should prevent time-based blind injection attempts', () => {
      const timeBasedAttempts = [
        'SELECT * FROM users WHERE id = 1 AND (SELECT COUNT(*) FROM sqlite_master) > 0',
        "SELECT * FROM users WHERE id = 1 OR (SELECT COUNT(*) FROM pragma_table_info('users')) > 0",
        'SELECT * FROM users WHERE id = 1 UNION SELECT NULL,NULL,NULL,NULL'
      ];

      for (const query of timeBasedAttempts) {
        const result = ReadQueryInputSchema.safeParse({ query });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toMatch(
            /Query contains prohibited operations|Query attempts to access system tables|Multi-statement queries are not allowed/
          );
        }
      }
    });

    it('should prevent boolean-based blind injection', () => {
      const booleanAttempts = [
        'SELECT * FROM users WHERE id = 1 AND (ASCII(SUBSTR((SELECT sql FROM sqlite_master LIMIT 1),1,1))>64)',
        'SELECT * FROM users WHERE id = 1 OR (LENGTH((SELECT name FROM sqlite_master LIMIT 1))>5)',
        "SELECT * FROM users WHERE id = 1 AND (SELECT COUNT(*) FROM sqlite_master WHERE type='table')>0"
      ];

      for (const query of booleanAttempts) {
        const result = ReadQueryInputSchema.safeParse({ query });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toMatch(
            /Query contains prohibited operations|Query attempts to access system tables/
          );
        }
      }
    });

    it('should prevent stacked queries', () => {
      const stackedQueries = [
        "SELECT * FROM users; INSERT INTO log VALUES('accessed')",
        'SELECT * FROM users; UPDATE users SET lastAccess = datetime()',
        'SELECT * FROM users; DELETE FROM sessions WHERE expired = 1'
      ];

      for (const query of stackedQueries) {
        const result = ReadQueryInputSchema.safeParse({ query });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toMatch(
            /Multi-statement queries are not allowed|Query contains prohibited operations/
          );
        }
      }
    });
  });

  describe('Whitespace and Normalization', () => {
    it('should handle whitespace variations correctly', () => {
      const whitespaceVariations = [
        '   SELECT   *   FROM   users   ', // Extra spaces - should work
        'SELECT\t*\nFROM\rusers', // Tab/newline/return - should work
        'SELECT * FROM users' // Normal - should work
      ];

      for (const query of whitespaceVariations) {
        const result = ReadQueryInputSchema.safeParse({ query });
        expect(result.success).toBe(true);
      }

      // These should fail due to comments or union
      const maliciousWhitespace = [
        'SELECT/*comment*/*/*another*/FROM/**/users',
        '-- comment\nSELECT * FROM users\n-- another comment',
        'SELECT\t*\nFROM\rusers\fUNION\vSELECT\r\n*\tFROM\fsqlite_master'
      ];

      for (const query of maliciousWhitespace) {
        const result = ReadQueryInputSchema.safeParse({ query });
        expect(result.success).toBe(false);
      }
    });
  });
});
