# Tool API Documentation

## read-query Tool
Execute SELECT queries with comprehensive security validation.

**Input:**
- `query` (string): SELECT SQL statement (max 10,000 characters)
- `parameters` (array, optional): Query parameters (max 100 parameters)

**Example:**
```json
{
  "query": "SELECT * FROM users WHERE role = ? ORDER BY username LIMIT 10",
  "parameters": ["user"]
}
```

**Output:**
```
Query executed successfully

Found 2 row(s):

id | username | email               | role
---|----------|---------------------|------
1  | alice    | alice@example.com   | user
2  | bob      | bob@example.com     | user

Performance: 4ms, 2 returned
```

**Security Features:**
- SELECT-only enforcement
- System table access prevention (sqlite_master, etc.)
- Multi-statement query blocking
- UNION/comment injection prevention
- Query length and parameter limits

## write-query Tool
Execute INSERT, UPDATE, or DELETE operations with transaction support.

**Input:**
- `query` (string): Write SQL statement (max 10,000 characters)
- `parameters` (array, optional): Query parameters (max 100 parameters)
- `useTransaction` (boolean, optional): Enable transaction wrapper (default: true)

**Example:**
```json
{
  "query": "INSERT INTO users (username, email, role) VALUES (?, ?, ?)",
  "parameters": ["newuser", "newuser@example.com", "user"],
  "useTransaction": true
}
```

**Output:**
```
Write operation completed successfully

Operation: INSERT
Rows affected: 1
Last insert row ID: 3
Transaction: enabled

Performance: 8ms
```

**Security Features:**
- Write operation enforcement (INSERT/UPDATE/DELETE only)
- System table protection
- Automatic transaction rollback on errors
- Prohibited operation filtering

## create-table Tool
Create new tables with DDL security validation.

**Input:**
- `query` (string): CREATE TABLE statement (max 10,000 characters)
- `parameters` (array, optional): Parameters for DDL (max 100 parameters)
- `addIfNotExists` (boolean, optional): Add IF NOT EXISTS clause (default: false)
- `useTransaction` (boolean, optional): Enable transaction wrapper (default: true)

**Example:**
```json
{
  "query": "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price DECIMAL(10,2))",
  "addIfNotExists": true,
  "useTransaction": true
}
```

**Output:**
```
Table creation completed successfully

Operation: CREATE TABLE
Table name: products
IF NOT EXISTS: added
Transaction: enabled

Performance: 12ms
```

## alter-table Tool
Modify existing table structures.

**Input:**
- `query` (string): ALTER TABLE statement (max 10,000 characters)
- `parameters` (array, optional): Parameters for DDL (max 100 parameters)
- `useTransaction` (boolean, optional): Enable transaction wrapper (default: true)

**Example:**
```json
{
  "query": "ALTER TABLE users ADD COLUMN last_login DATETIME",
  "useTransaction": true
}
```

**Output:**
```
Table alteration completed successfully

Operation: ADD COLUMN
Table: users
Transaction: enabled

Performance: 6ms
```

**Supported Operations:**
- ADD COLUMN - Add new columns with data types
- RENAME TABLE - Rename entire tables
- RENAME COLUMN - Rename individual columns

## list-tables Tool
Browse database metadata and objects.

**Input:**
- `includeSystemTables` (boolean, optional): Include system tables (default: false)
- `pattern` (string, optional): Filter pattern using SQL LIKE syntax
- `includeViews` (boolean, optional): Include views in listing (default: true)
- `includeIndexes` (boolean, optional): Include indexes in listing (default: false)
- `outputFormat` (string, optional): Output format - "table", "list", or "json" (default: "table")

**Example:**
```json
{
  "includeSystemTables": false,
  "pattern": "user%",
  "outputFormat": "table"
}
```

**Output:**
```
Database objects found: 2 tables, 0 views, 0 indexes

Type  | Name         | Rows | Columns | Description
------|--------------|------|---------|------------------
table | users        | 3    | 4       | User account data
table | user_profiles| 3    | 3       | Extended user info

Performance: 5ms
```

## describe-table Tool
Inspect table schema and structure.

**Input:**
- `tableName` (string): Name of table to describe
- `outputFormat` (string, optional): Output format - "table" or "json" (default: "table")
- `includeIndexes` (boolean, optional): Include index information (default: false)
- `includeForeignKeys` (boolean, optional): Include foreign key information (default: false)

**Example:**
```json
{
  "tableName": "users",
  "outputFormat": "table",
  "includeIndexes": true,
  "includeForeignKeys": true
}
```

**Output:**
```
Table: users

Columns:
┌─────────┬─────────┬────────┬───────────┬─────────────┬──────┐
│ Column  │ Type    │ Null   │ Default   │ Primary Key │ Auto │
├─────────┼─────────┼────────┼───────────┼─────────────┼──────┤
│ id      │ INTEGER │ NO     │ NULL      │ YES         │ NO   │
│ username│ TEXT    │ NO     │ NULL      │ NO          │ NO   │
│ email   │ TEXT    │ YES    │ NULL      │ NO          │ NO   │
│ role    │ TEXT    │ YES    │ 'user'    │ NO          │ NO   │
└─────────┴─────────┴────────┴───────────┴─────────────┴──────┘

Performance: 3ms
```