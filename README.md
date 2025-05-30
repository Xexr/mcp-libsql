# MCP libSQL Server

A Model Context Protocol (MCP) server for libSQL database operations, providing secure database access through Claude Desktop, Claude Code, Cursor, and other MCP-compatible clients.

Runs on Node, written in TypeScript

## 🚀 **Status**

✅ **Complete database management capabilities** - All 6 core tools implemented and tested  
✅ **Comprehensive security validation** - 67 security tests covering all injection vectors  
✅ **Extensive test coverage** - 244 total tests (177 unit + 67 security) with 100% pass rate  
✅ **Production deployment verified** - Successfully working with MCP clients  
✅ **Robust error handling** - Connection retry, graceful degradation, and audit logging  

## 🛠️ **Features**

### **Available Tools**
- **read-query**: Execute SELECT queries with comprehensive security validation
- **write-query**: INSERT/UPDATE/DELETE operations with transaction support
- **create-table**: DDL operations for table creation with security measures
- **alter-table**: Table structure modifications (ADD/RENAME/DROP operations)
- **list-tables**: Database metadata browsing with filtering options
- **describe-table**: Table schema inspection with multiple output formats

### **Security & Reliability**
- **Multi-layer SQL injection prevention** with 67 security tests covering all attack vectors
- **System table protection** (sqlite_master, sqlite_sequence, etc.)
- **Connection pooling** with health monitoring and automatic retry logic
- **Transaction support** with automatic rollback on errors
- **Comprehensive audit logging** for security compliance
- **Query limits** and resource protection

### **Developer Experience**
- **Beautiful table formatting** with proper alignment and NULL handling
- **Performance metrics** displayed for all operations
- **Clear error messages** with actionable context
- **Parameterized query support** for safe data handling
- **Development mode** with enhanced logging and hot reload

## 📋 **Prerequisites**

- **Node.js** 20+ 
- **pnpm** (or npm) package manager
- **libSQL database** (file-based or remote)
- **Claude Desktop** (for MCP integration)

### **Platform Requirements**
- **macOS**: Native Node.js installation
- **Linux**: Native Node.js installation  
- **Windows**: Native Node.js installation or WSL2 with Node.js installation

## 🔧 **Installation**

```bash
# Clone repository
git clone <repository-url>
cd mcp-libsql-server

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests to verify installation
pnpm test
```

## 🚀 **Usage**

### **Local Testing**
```bash
# Test with file database
node dist/index.js --url file:///tmp/test.db

# Test with HTTP database
node dist/index.js --url http://127.0.0.1:8080

# Development mode with hot reload
pnpm dev --url file:///tmp/test.db
```

### **Claude Desktop Integration**

Configure the MCP server in Claude Desktop based on your operating system:

#### **macOS Configuration**

1. **Create configuration file** at `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "libsql": {
      "command": "node",
      "args": [
        "/path/to/mcp-libsql-server/dist/index.js",
        "--url",
        "file:///Users/username/database.db"
      ],
      "cwd": "/path/to/mcp-libsql-server"
    }
  }
}
```

**Recommended configuration with explicit Node.js path:**
```json
{
  "mcpServers": {
    "libsql": {
      "command": "/Users/username/.nvm/versions/node/v20.13.1/bin/node",
      "args": [
        "/Users/username/projects/mcp-libsql-server/dist/index.js",
        "--url", 
        "file:///Users/username/database.db"
      ]
    }
  }
}
```

**Alternative system paths:**
- Homebrew (Intel): `/usr/local/bin/node`
- Homebrew (Apple Silicon): `/opt/homebrew/bin/node`
- Official installer: `/usr/local/bin/node`

**Important**: On macOS, Claude Desktop doesn't inherit your shell environment. If you use nvm, you must specify the full path to your Node.js installation. Use `which node` in terminal to find your current Node.js path.

#### **Linux Configuration**

1. **Create configuration file** at `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "libsql": {
      "command": "node",
      "args": [
        "/home/username/projects/mcp-libsql-server/dist/index.js",
        "--url",
        "file:///home/username/database.db"
      ],
      "cwd": "/home/username/projects/mcp-libsql-server"
    }
  }
}
```

**Alternative with npm/nvm setup:**
```json
{
  "mcpServers": {
    "libsql": {
      "command": "bash",
      "args": [
        "-c",
        "source ~/.nvm/nvm.sh && cd /home/username/projects/mcp-libsql-server && node dist/index.js --url file:///home/username/database.db"
      ]
    }
  }
}
```

#### **Windows (WSL2) Configuration**

1. **Create configuration file** at `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "libsql": {
      "command": "wsl.exe",
      "args": [
        "bash",
        "-c",
        "cd /home/username/projects/mcp-libsql-server && source ~/.nvm/nvm.sh && node dist/index.js --url file:///home/username/database.db"
      ]
    }
  }
}
```

**For HTTP databases (all platforms):**
```json
{
  "mcpServers": {
    "libsql": {
      "command": "node",
      "args": [
        "/path/to/mcp-libsql-server/dist/index.js",
        "--url",
        "http://127.0.0.1:8080"
      ]
    }
  }
}
```

#### **Configuration Notes**

- **File paths**: Use absolute paths to avoid path resolution issues
- **Database URLs**: 
  - File databases: `file:///absolute/path/to/database.db`
  - HTTP databases: `http://hostname:port`
  - libSQL/Turso: `libsql://your-database.turso.io`
- **Node.js path**: Use `which node` to find your Node.js installation path
- **Working directory**: Set `cwd` to ensure relative paths work correctly

2. **Restart Claude Desktop** completely after updating the configuration

3. **Test the integration** by asking Claude to run SQL queries:
   ```
   Can you run this SQL query: SELECT 1 as test
   ```

## 🔧 **Tool Documentation**

### **read-query Tool**
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

### **write-query Tool**
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

### **create-table Tool**
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

### **alter-table Tool**
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

### **list-tables Tool**
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

### **describe-table Tool**
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

## 🔒 **Security Features**

### **Multi-Layer SQL Injection Prevention**
- **Input Validation**: Comprehensive Zod schema validation with pattern detection
- **System Table Protection**: Blocks access to sqlite_master, sqlite_sequence, etc.
- **Multi-Statement Blocking**: Prevents stacked queries and command injection
- **Operation Restriction**: Tool-specific query type enforcement
- **Parameter Safety**: Full support for parameterized queries
- **Function Filtering**: Blocks dangerous functions like load_extension

### **Security Test Coverage**
67 comprehensive security tests covering:
- Multi-statement injection ('; DROP TABLE)
- System table access attempts
- UNION-based data exfiltration
- Comment-based evasion (/**/, --)
- DDL injection in data queries
- Time-based and boolean-based blind injection
- Whitespace normalization attacks

### **Audit Trail**
- Connection events (establish, fail, close)
- Query execution with parameters and timing
- Transaction lifecycle (start, commit, rollback)
- Security validation failures
- Performance metrics for compliance

## 🧪 **Testing**

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test security-verification

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type check
pnpm typecheck
```

**Test Coverage**: 244 tests covering all functionality including edge cases, error scenarios, and comprehensive security validation.

## ⚠️ **Troubleshooting**

### **Installation Issues**

1. **Node.js Version Error**
   ```
   Error: Node.js version 18.x.x is not supported
   ```
   **Solution**: Update to Node.js 20 or later
   ```bash
   # Using nvm
   nvm install 20
   nvm use 20
   ```

2. **pnpm Not Found**
   ```
   bash: pnpm: command not found
   ```
   **Solution**: Install pnpm globally
   ```bash
   npm install -g pnpm
   ```

3. **Build Failures**
   ```
   Error: TypeScript compilation failed
   ```
   **Solution**: Clean and rebuild
   ```bash
   rm -rf dist node_modules
   pnpm install
   pnpm build
   ```

### **MCP Integration Issues**

4. **Server Failed to Start in Claude Desktop**
   ```
   MCP server 'libsql' failed to start
   ```
   **Solutions by Platform**:
   
   **macOS**:
   - Ensure `pnpm build` was run and `dist/index.js` exists
   - Test locally: `node dist/index.js --url file:///tmp/test.db`
   - Verify configuration file path: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Check Node.js path: `which node` (common paths: `/usr/local/bin/node`, `/opt/homebrew/bin/node`)
   
   **Linux**:
   - Ensure `pnpm build` was run and `dist/index.js` exists
   - Test locally: `node dist/index.js --url file:///tmp/test.db`
   - Verify configuration file path: `~/.config/Claude/claude_desktop_config.json`
   - Check Node.js path: `which node` (common path: `/usr/bin/node`)
   
   **Windows (WSL2)**:
   - Ensure `pnpm build` was run and `dist/index.js` exists
   - Test locally: `node dist/index.js --url file:///tmp/test.db`
   - Check WSL2 is running: `wsl -l -v` in PowerShell
   - Verify configuration file path: `%APPDATA%\Claude\claude_desktop_config.json`

5. **Node.js Version Compatibility Issues (macOS)**
   ```
   SyntaxError: Unexpected token '??='
   ```
   **Problem**: Claude Desktop on macOS doesn't inherit your shell environment and may use an older Node.js version that doesn't support modern JavaScript syntax.
   
   **Diagnosis**: Check what Node.js version Claude Desktop is using by temporarily updating your config to run this command:
   ```json
   {
     "mcpServers": {
       "libsql": {
         "command": "node",
         "args": ["-e", "console.error(`Node.js version: ${process.version}`)"]
       }
     }
   }
   ```
   
   **Solutions**:
   - **Use explicit Node.js path** (Recommended):
     ```json
     {
       "mcpServers": {
         "libsql": {
           "command": "/Users/username/.nvm/versions/node/v20.13.1/bin/node",
           "args": ["/path/to/mcp-libsql-server/dist/index.js", "--url", "file:///path/to/database.db"]
         }
       }
     }
     ```
   - **Find your current Node.js path**: Run `which node` in terminal to get the full path
   - **Alternative system paths**: 
     - Homebrew Intel: `/usr/local/bin/node`
     - Homebrew Apple Silicon: `/opt/homebrew/bin/node`
     - Official installer: `/usr/local/bin/node`

6. **Tools Not Available in Claude Desktop**
   ```
   No database tools available
   ```
   **Solutions**:
   - Restart Claude Desktop completely after config changes
   - Check MCP logs in Claude Desktop for connection status
   - Verify database URL is accessible from your environment
   - Test with simple file database: `file:///tmp/test.db` (macOS/Linux) or `file:///mnt/c/temp/test.db` (WSL2)
   
   **Platform-specific checks**:
   - **macOS**: Verify file permissions and paths don't contain spaces
   - **Linux**: Check file permissions and ensure Claude Desktop has access to the file paths
   - **Windows/WSL2**: Ensure database path is accessible from WSL2 environment

7. **JSON Parsing Warnings (Expected and Harmless)**
   ```
   Expected ',' or ']' after array element in JSON at position 5
   ```
   **Status**: These are **harmless warnings** from the MCP TypeScript SDK
   - **Root Cause**: Known issue in MCP SDK's stdio message deserialization
   - **Impact**: None - tools work perfectly despite the warnings
   - **Tracking**: GitHub Issues TypeScript SDK #244, Python SDK #290
   - **Action**: No action needed - will be fixed in future SDK releases

### **Database Connection Issues**

8. **Connection Refused**
   ```
   Error: Connection refused to http://127.0.0.1:8080
   ```
   **Solutions**:
   - Verify database server is running
   - Check firewall settings for HTTP URLs
   - Test with file database: `file:///tmp/test.db`
   - Ensure database is accessible from WSL2 if using Windows

9. **File Database Permissions**
   ```
   Error: SQLITE_CANTOPEN: unable to open database file
   ```
   **Solutions**:
   - Check file permissions: `chmod 644 /path/to/database.db`
   - Ensure directory exists: `mkdir -p /path/to/directory`
   - Test with `/tmp/test.db` for quick verification

### **Query Execution Issues**

10. **Query Validation Errors**
   ```
   Error: Only SELECT queries are allowed
   ```
   **Solutions**:
   - Use correct tool for operation type:
     - `read-query`: SELECT statements only
     - `write-query`: INSERT/UPDATE/DELETE only
     - `create-table`: CREATE TABLE only
     - `alter-table`: ALTER TABLE only
   - Check for prohibited operations or system table access

11. **Transaction Failures**
    ```
    Error: Transaction rolled back due to constraint violation
    ```
    **Solutions**:
    - Check table constraints and foreign key relationships
    - Verify data types match column definitions
    - Use `useTransaction: false` to bypass transaction wrapper if needed

### **Performance Issues**

12. **Slow Query Performance**
    ```
    Query execution time > 30 seconds
    ```
    **Solutions**:
    - Add appropriate indexes for query patterns
    - Use LIMIT clauses for large result sets
    - Check database file size and consider optimization
    - Monitor connection pool health

13. **Memory Issues with Large Results**
    ```
    Error: Result set too large (> 10,000 rows)
    ```
    **Solutions**:
    - Add LIMIT clauses to queries
    - Use pagination for large datasets
    - Consider batch processing for bulk operations

### **Development Issues**

14. **Hot Reload Not Working**
    ```
    pnpm dev not detecting file changes
    ```
    **Solutions**:
    - Check nodemon configuration in `nodemon.json`
    - Restart development server: `Ctrl+C` then `pnpm dev`
    - Clear Node.js cache: `rm -rf node_modules/.cache`

15. **Test Failures**
    ```
    Tests failing with connection errors
    ```
    **Solutions**:
    - Ensure no other instances are running on test database
    - Clean test environment: `pnpm test:clean`
    - Check for proper test isolation and cleanup

### **Verification Commands**

#### **macOS**
```bash
# Test server locally
cd /path/to/mcp-libsql-server
node dist/index.js --url file:///tmp/test.db

# Check build output
ls -la dist/

# Test database connectivity
sqlite3 /tmp/test.db "SELECT 1"

# Find Node.js path
`which node` or `whereis node` or `locate node`

# Check Node.js version
node --version

# Verify pnpm installation
pnpm --version

# Find Claude Desktop config
ls -la ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

#### **Linux**
```bash
# Test server locally
cd /path/to/mcp-libsql-server
node dist/index.js --url file:///tmp/test.db

# Check build output
ls -la dist/

# Test database connectivity
sqlite3 /tmp/test.db "SELECT 1"

# Find Node.js path
`which node` or `whereis node` or `locate node`

# Check Node.js version
node --version

# Verify pnpm installation
pnpm --version

# Find Claude Desktop config
ls -la ~/.config/Claude/claude_desktop_config.json
```

#### **Windows (WSL2)**
```bash
# Test server locally (in WSL2)
cd /path/to/mcp-libsql-server
node dist/index.js --url file:///tmp/test.db

# Check build output
ls -la dist/

# Test database connectivity
sqlite3 /tmp/test.db "SELECT 1"

# Check Node.js version
node --version

# Verify WSL2 status (in PowerShell)
wsl -l -v

# Find Claude Desktop config (in Windows)
dir "%APPDATA%\Claude\claude_desktop_config.json"
```

#### **Platform-agnostic debugging**
```bash
# Check if Claude Desktop can access the files
# Run this from the directory containing your MCP server
ls -la dist/index.js
file dist/index.js

# Test with minimal database
echo "CREATE TABLE test (id INTEGER);" | sqlite3 /tmp/minimal.db
node dist/index.js --url file:///tmp/minimal.db

# Verify configuration syntax
cat claude_desktop_config.json | jq .  # Requires jq for JSON validation
```

## 🏗️ **Architecture**

### **Core Components**
- **ServerManager**: Lifecycle management and development features
- **BaseTool**: Abstract base class for consistent tool implementation
- **ToolRegistry**: Centralized tool management and registration
- **DatabaseConnection**: Connection pooling with health monitoring
- **Logger**: Structured logging with file and console output

### **Tool Implementation Pattern**
```typescript
export class MyTool extends BaseTool {
  readonly name = 'my-tool';
  readonly description = 'Tool description';
  readonly inputSchema = MyToolInputSchema;

  protected async executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    // Tool implementation
  }
}
```
x
### **Security Architecture**
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

## 📁 **Project Structure**

```
src/
├── index.ts                 # Main entry point with CLI
├── lib/
│   ├── base-tool.ts         # Abstract tool base class
│   ├── server-manager.ts    # Server lifecycle management
│   ├── database.ts          # Connection pooling
│   ├── logger.ts            # Structured logging
│   └── constants.ts         # Configuration constants
├── tools/
│   ├── read-query.ts        # SELECT query tool
│   ├── write-query.ts       # INSERT/UPDATE/DELETE tool
│   ├── create-table.ts      # CREATE TABLE tool
│   ├── alter-table.ts       # ALTER TABLE tool
│   ├── list-tables.ts       # Database metadata tool
│   └── describe-table.ts    # Table schema inspection tool
├── schemas/
│   └── *.ts                 # Zod validation schemas
├── types/
│   └── index.ts             # TypeScript type definitions
├── utils/
│   ├── error-handler.ts     # Error handling utilities
│   └── performance.ts       # Performance monitoring
└── __tests__/
    ├── unit/                # Unit tests (177 tests)
    └── integration/         # Integration tests (67 tests)
```

## 🤝 **Contributing**

1. Follow existing code patterns and TypeScript strict mode
2. Write comprehensive tests for new features
3. Use the existing logging and error handling patterns
4. Update documentation for new tools or features
5. Ensure all security measures are maintained

### **Development Commands**
```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build with tsc
pnpm build

# Run MCP server
pnpm start

# Code Quality
pnpm lint            # Run linter with eslint
pnpm lint:fix        # Fix linter errors
pnpm format          # Format code with prettier
pnpm format:check    # Check code formatting
pnpm typecheck       # Type check

# Testing
pnpm test            # Run all tests
pnpm test:watch      # Run all tests in watch mode
pnpm test:coverage   # Run all tests with coverage
pnpm test <filename> # Run tests for a specific file
```

## 📄 **License**

[Add your license here]

## 🔗 **Links**

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [libSQL Documentation](https://docs.libsql.org/)
- [Claude Desktop](https://claude.ai/desktop)