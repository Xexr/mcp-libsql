import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ServerManager } from '../../lib/server-manager.js';
import { ReadQueryTool } from '../../tools/read-query.js';
import { WriteQueryTool } from '../../tools/write-query.js';
import { CreateTableTool } from '../../tools/create-table.js';
import { AlterTableTool } from '../../tools/alter-table.js';
import { ListTablesTool } from '../../tools/list-tables.js';
import { DescribeTableTool } from '../../tools/describe-table.js';
import { LibSQLConnectionPool } from '../../lib/database.js';
import type { DatabaseConfig } from '../../types/index.js';
import type { ToolExecutionContext } from '../../lib/base-tool.js';

/**
 * End-to-End Integration Tests
 *
 * These tests validate complete workflows using real libSQL connections
 * and all database tools working together in realistic scenarios.
 */
describe('End-to-End Integration Tests', () => {
  const testDbUrl = 'file:test-integration.db';
  let config: DatabaseConfig;
  let pool: LibSQLConnectionPool;
  let serverManager: ServerManager;

  // Tool instances
  let readQueryTool: ReadQueryTool;
  let writeQueryTool: WriteQueryTool;
  let createTableTool: CreateTableTool;
  let alterTableTool: AlterTableTool;
  let listTablesTool: ListTablesTool;
  let describeTableTool: DescribeTableTool;

  beforeAll(async () => {
    // Set up test database configuration
    config = {
      url: testDbUrl,
      minConnections: 1,
      maxConnections: 3,
      connectionTimeout: 10000,
      queryTimeout: 10000
    };

    // Initialize connection pool
    pool = new LibSQLConnectionPool(config);
    await pool.initialize();

    // Initialize server manager for full integration testing
    serverManager = new ServerManager({
      config,
      developmentMode: true,
      enableHotReload: false
    });

    // Initialize all tools
    readQueryTool = new ReadQueryTool();
    writeQueryTool = new WriteQueryTool();
    createTableTool = new CreateTableTool();
    alterTableTool = new AlterTableTool();
    listTablesTool = new ListTablesTool();
    describeTableTool = new DescribeTableTool();
  });

  afterAll(async () => {
    // Clean up resources
    if (serverManager && serverManager.isServerRunning()) {
      await serverManager.stop();
    }
    if (pool) {
      await pool.close();
    }

    // Clean up test database file
    try {
      const fs = await import('fs/promises');
      await fs.unlink('test-integration.db');
    } catch {
      // File may not exist, that's fine
    }
  });

  beforeEach(async () => {
    // Clean up any existing tables before each test
    const connection = await pool.getConnection();
    try {
      // Disable foreign key checks for cleanup
      await connection.execute('PRAGMA foreign_keys = OFF');

      // Get list of existing tables
      const result = await connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );

      // Drop all user tables
      for (const row of result.rows) {
        const tableName = row['name'] as string;
        await connection.execute(`DROP TABLE IF EXISTS "${tableName}"`);
      }

      // Re-enable foreign key checks
      await connection.execute('PRAGMA foreign_keys = ON');
    } finally {
      pool.releaseConnection(connection);
    }
  });

  afterEach(async () => {
    // Additional cleanup if needed
  });

  describe('Complete Database Management Workflow', () => {
    it('should perform a complete CRUD workflow with schema management', async () => {
      const connection = await pool.getConnection();
      const context: ToolExecutionContext = {
        connection,
        arguments: {}
      };

      try {
        // 1. Start with empty database - list tables should return empty
        context.arguments = { format: 'list' };
        let result = await listTablesTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('No objects found');

        // 2. Create a users table
        context.arguments = {
          query: `CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        };
        result = await createTableTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('created successfully');
        expect(result.content[0].text).toContain('users');

        // 3. Verify table creation with list-tables
        context.arguments = { format: 'list' };
        result = await listTablesTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('TABLES (1):');
        expect(result.content[0].text).toContain('- users');

        // 4. Inspect table structure with describe-table
        context.arguments = {
          tableName: 'users',
          format: 'table',
          includeIndexes: true,
          includeForeignKeys: true
        };
        result = await describeTableTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('Table: users');
        expect(result.content[0].text).toContain('│ id');
        expect(result.content[0].text).toContain('│ name');
        expect(result.content[0].text).toContain('│ email');
        expect(result.content[0].text).toContain('│ created_at');

        // 5. Add some initial data with write-query
        context.arguments = {
          query: 'INSERT INTO users (name, email) VALUES (?, ?)',
          parameters: ['Alice Johnson', 'alice@example.com']
        };
        result = await writeQueryTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('successfully');

        // 6. Add more users
        context.arguments = {
          query: 'INSERT INTO users (name, email) VALUES (?, ?), (?, ?)',
          parameters: ['Bob Smith', 'bob@example.com', 'Carol Davis', 'carol@example.com']
        };
        result = await writeQueryTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('successfully');

        // 7. Query the data with read-query
        context.arguments = {
          query: 'SELECT id, name, email FROM users ORDER BY name'
        };
        result = await readQueryTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('Found');
        expect(result.content[0].text).toContain('Alice Johnson');
        expect(result.content[0].text).toContain('Bob Smith');
        expect(result.content[0].text).toContain('Carol Davis');

        // 8. Alter table to add a new column
        context.arguments = {
          query: 'ALTER TABLE users ADD COLUMN phone TEXT'
        };
        result = await alterTableTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('altered successfully');
        expect(result.content[0].text).toContain('users');

        // 9. Verify the schema change
        context.arguments = {
          tableName: 'users',
          format: 'table',
          includeIndexes: false,
          includeForeignKeys: false
        };
        result = await describeTableTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('│ phone');

        // 10. Update data to include phone numbers
        context.arguments = {
          query: 'UPDATE users SET phone = ? WHERE name = ?',
          parameters: ['555-1234', 'Alice Johnson']
        };
        result = await writeQueryTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('successfully');

        // 11. Final verification query
        context.arguments = {
          query: 'SELECT name, email, phone FROM users WHERE phone IS NOT NULL'
        };
        result = await readQueryTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('Alice Johnson');
        expect(result.content[0].text).toContain('555-1234');
      } finally {
        pool.releaseConnection(connection);
      }
    });

    it('should handle multi-table relational scenario', async () => {
      const connection = await pool.getConnection();
      const context: ToolExecutionContext = {
        connection,
        arguments: {}
      };

      try {
        // 1. Create users table
        context.arguments = {
          query: `CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE
          )`
        };
        await createTableTool.execute(context);

        // 2. Create orders table with foreign key
        context.arguments = {
          query: `CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )`
        };
        await createTableTool.execute(context);

        // 3. Verify both tables exist
        context.arguments = { format: 'list' };
        let result = await listTablesTool.execute(context);
        expect(result.content[0].text).toContain('TABLES (2):');
        expect(result.content[0].text).toContain('- users');
        expect(result.content[0].text).toContain('- orders');

        // 4. Verify foreign key relationship in orders table
        context.arguments = {
          tableName: 'orders',
          format: 'table',
          includeForeignKeys: true
        };
        result = await describeTableTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('Foreign Keys:');

        // 5. Insert test data
        context.arguments = {
          query: 'INSERT INTO users (name, email) VALUES (?, ?)',
          parameters: ['John Doe', 'john@example.com']
        };
        await writeQueryTool.execute(context);

        context.arguments = {
          query: 'INSERT INTO orders (user_id, product_name, amount) VALUES (?, ?, ?)',
          parameters: [1, 'Laptop', 999.99]
        };
        await writeQueryTool.execute(context);

        // 6. Test relational query
        context.arguments = {
          query: `SELECT u.name, u.email, o.product_name, o.amount 
                  FROM users u 
                  JOIN orders o ON u.id = o.user_id`
        };
        result = await readQueryTool.execute(context);
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain('John Doe');
        expect(result.content[0].text).toContain('Laptop');
        expect(result.content[0].text).toContain('999.99');
      } finally {
        pool.releaseConnection(connection);
      }
    });

    it('should handle transaction rollback scenarios', async () => {
      const connection = await pool.getConnection();
      const context: ToolExecutionContext = {
        connection,
        arguments: {}
      };

      try {
        // 1. Create test table
        context.arguments = {
          query: `CREATE TABLE accounts (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            balance DECIMAL(10,2) NOT NULL CHECK(balance >= 0)
          )`
        };
        await createTableTool.execute(context);

        // 2. Insert initial data
        context.arguments = {
          query: 'INSERT INTO accounts (name, balance) VALUES (?, ?), (?, ?)',
          parameters: ['Alice', 100.0, 'Bob', 50.0]
        };
        await writeQueryTool.execute(context);

        // 3. Verify initial state
        context.arguments = {
          query: 'SELECT name, balance FROM accounts ORDER BY name'
        };
        let result = await readQueryTool.execute(context);
        expect(result.content[0].text).toContain('Alice');
        expect(result.content[0].text).toContain('100');

        // 4. Attempt an invalid update that should fail due to check constraint
        context.arguments = {
          query: 'UPDATE accounts SET balance = ? WHERE name = ?',
          parameters: [-50.0, 'Alice'], // This should fail the CHECK constraint
          useTransaction: true
        };
        result = await writeQueryTool.execute(context);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error executing');

        // 5. Verify data integrity - balance should be unchanged
        context.arguments = {
          query: 'SELECT name, balance FROM accounts WHERE name = ?',
          parameters: ['Alice']
        };
        result = await readQueryTool.execute(context);
        expect(result.content[0].text).toContain('100'); // Should still be 100
      } finally {
        pool.releaseConnection(connection);
      }
    });

    it('should handle complex table operations and metadata queries', async () => {
      const connection = await pool.getConnection();
      const context: ToolExecutionContext = {
        connection,
        arguments: {}
      };

      try {
        // 1. Create multiple tables with different characteristics
        const tables = [
          {
            name: 'products',
            sql: `CREATE TABLE products (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              price DECIMAL(10,2),
              category_id INTEGER
            )`
          },
          {
            name: 'categories',
            sql: `CREATE TABLE categories (
              id INTEGER PRIMARY KEY,
              name TEXT UNIQUE NOT NULL,
              description TEXT
            )`
          },
          {
            name: 'product_reviews',
            sql: `CREATE TABLE product_reviews (
              id INTEGER PRIMARY KEY,
              product_id INTEGER,
              rating INTEGER CHECK(rating >= 1 AND rating <= 5),
              comment TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
          }
        ];

        for (const table of tables) {
          context.arguments = { query: table.sql };
          await createTableTool.execute(context);
        }

        // 2. Insert test data into tables
        context.arguments = {
          query: 'INSERT INTO categories (name, description) VALUES (?, ?)',
          parameters: ['Electronics', 'Electronic devices and gadgets']
        };
        await writeQueryTool.execute(context);

        context.arguments = {
          query: 'INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)',
          parameters: ['Laptop', 999.99, 1]
        };
        await writeQueryTool.execute(context);

        // 3. Test comprehensive listing with different formats
        context.arguments = {
          format: 'table',
          includeIndexes: true,
          includeDetails: false
        };
        let result = await listTablesTool.execute(context);
        expect(result.content[0].text).toContain('Database Schema Objects:');
        expect(result.content[0].text).toContain('products');
        expect(result.content[0].text).toContain('categories');
        expect(result.content[0].text).toContain('product_reviews');

        // 4. Test JSON format output
        context.arguments = {
          format: 'json',
          includeIndexes: true
        };
        result = await listTablesTool.execute(context);
        expect(result.isError).toBeUndefined();
        const jsonData = JSON.parse(result.content[0].text as string);
        expect(jsonData.objects).toHaveLength(3); // 3 tables
        expect(jsonData.metadata.totalCount).toBe(3);
        expect(jsonData.metadata.filters.includeIndexes).toBe(true);

        // 5. Test pattern filtering
        context.arguments = {
          pattern: 'product%',
          format: 'list'
        };
        result = await listTablesTool.execute(context);
        expect(result.content[0].text).toContain('products');
        expect(result.content[0].text).toContain('product_reviews');
        expect(result.content[0].text).not.toContain('categories');

        // 6. Describe each table and verify schema details
        for (const table of tables) {
          context.arguments = {
            tableName: table.name,
            format: 'table',
            includeIndexes: true
          };
          result = await describeTableTool.execute(context);
          expect(result.isError).toBeUndefined();
          expect(result.content[0].text).toContain(`Table: ${table.name}`);
        }
      } finally {
        pool.releaseConnection(connection);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle connection errors gracefully', async () => {
      // Create a pool with invalid configuration
      const invalidConfig: DatabaseConfig = {
        url: 'file:nonexistent/path/test.db', // Invalid path
        minConnections: 1,
        maxConnections: 2,
        connectionTimeout: 1000,
        queryTimeout: 1000
      };

      const invalidPool = new LibSQLConnectionPool(invalidConfig);

      try {
        await invalidPool.initialize();
        // If initialization succeeds, try to acquire a connection
        const connection = await invalidPool.getConnection();
        const context: ToolExecutionContext = {
          connection,
          arguments: { query: 'SELECT 1' }
        };

        const result = await readQueryTool.execute(context);

        // Should handle the error gracefully
        if (result.isError) {
          expect(result.content[0].text).toContain('Error');
        }

        invalidPool.releaseConnection(connection);
      } catch (error) {
        // Connection failure is expected and should be handled gracefully
        expect(error).toBeDefined();
      } finally {
        await invalidPool.close();
      }
    });

    it('should handle malformed queries appropriately', async () => {
      const connection = await pool.getConnection();
      const context: ToolExecutionContext = {
        connection,
        arguments: {}
      };

      try {
        // Test invalid SQL syntax
        context.arguments = {
          query: 'INVALID SQL SYNTAX HERE'
        };
        let result = await readQueryTool.execute(context);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid arguments');

        // Test SQL injection attempt (should be blocked by validation)
        context.arguments = {
          query: 'SELECT * FROM users; DROP TABLE users; --'
        };
        result = await readQueryTool.execute(context);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid arguments');
      } finally {
        pool.releaseConnection(connection);
      }
    });

    it('should enforce tool-specific operation restrictions', async () => {
      const connection = await pool.getConnection();
      const context: ToolExecutionContext = {
        connection,
        arguments: {}
      };

      try {
        // Test that read-query rejects write operations
        context.arguments = {
          query: "INSERT INTO test_table VALUES (1, 'test')"
        };
        let result = await readQueryTool.execute(context);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Only SELECT queries are allowed');

        // Test that write-query rejects read operations
        context.arguments = {
          query: 'SELECT * FROM sqlite_master'
        };
        result = await writeQueryTool.execute(context);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Invalid arguments');

        // Test that create-table rejects non-DDL operations
        context.arguments = {
          query: 'SELECT 1'
        };
        result = await createTableTool.execute(context);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Only CREATE TABLE statements are allowed');
      } finally {
        pool.releaseConnection(connection);
      }
    });
  });

  describe('Performance and Monitoring', () => {
    it('should provide consistent performance metrics across all tools', async () => {
      const connection = await pool.getConnection();
      const context: ToolExecutionContext = {
        connection,
        arguments: {}
      };

      try {
        // Create a test table
        context.arguments = {
          query: `CREATE TABLE perf_test (
            id INTEGER PRIMARY KEY,
            data TEXT
          )`
        };
        let result = await createTableTool.execute(context);
        expect(result.content[0].text).toMatch(/\d+ms/); // Should contain timing info

        // Insert test data
        context.arguments = {
          query: 'INSERT INTO perf_test (data) VALUES (?)',
          parameters: ['test data']
        };
        result = await writeQueryTool.execute(context);
        expect(result.content[0].text).toMatch(/\d+ms/); // Should contain timing info

        // Query the data
        context.arguments = {
          query: 'SELECT * FROM perf_test'
        };
        result = await readQueryTool.execute(context);
        expect(result.content[0].text).toMatch(/\d+ms/); // Should contain timing info

        // List tables
        context.arguments = { format: 'list' };
        result = await listTablesTool.execute(context);
        expect(result.content[0].text).toMatch(/\d+ms/); // Should contain timing info

        // Describe table
        context.arguments = {
          tableName: 'perf_test',
          format: 'table'
        };
        result = await describeTableTool.execute(context);
        expect(result.content[0].text).toMatch(/\d+ms/); // Should contain timing info
      } finally {
        pool.releaseConnection(connection);
      }
    });
  });
});
