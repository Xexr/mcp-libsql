# MCP libSQL Server

A Model Context Protocol (MCP) server for libSQL database operations, providing secure database access through Claude Desktop.

## 🚀 **Status: Production Ready**

✅ Successfully deployed and working with Claude Desktop  
✅ Read-query tool fully functional with beautiful table formatting  
✅ Comprehensive security validation and error handling  
✅ Well-tested with 39 passing unit tests  

## 🛠️ **Features**

### **Implemented Tools**
- **read-query**: Execute SELECT queries with secure validation
  - SELECT-only enforcement with dangerous operation detection
  - Query length limits (max 10,000 characters) 
  - Parameter validation (max 100 parameters)
  - Result size limits (max 10,000 rows)
  - Beautiful table formatting with proper alignment
  - Performance metrics display
  - NULL value handling

### **Planned Tools** (Task 4.2+)
- **write-query**: INSERT/UPDATE/DELETE operations with transaction support
- **create-table**: DDL operations for table creation
- **alter-table**: Table structure modifications
- **list-tables**: Database metadata browsing
- **describe-table**: Table schema inspection

## 📋 **Prerequisites**

- **Node.js** 20+ 
- **pnpm** package manager
- **libSQL database** (file-based or remote)
- **Claude Desktop** (for MCP integration)
- **WSL2** (for Windows users)

## 🔧 **Installation**

```bash
# Clone repository
git clone <repository-url>
cd mcp-libsql-server

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
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

1. **Create configuration file** at `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "globalShortcut": "Alt+Ctrl+Space",
  "mcpServers": {
    "libsql": {
      "command": "wsl.exe",
      "args": [
        "bash",
        "-c",
        "cd /home/user/projects/mcp/xexr-libsql/dist && source ~/.nvm/nvm.sh && node ./index.js --url http://127.0.0.1:8080"
      ]
    }
  }
}
```

2. **Restart Claude Desktop** completely

3. **Test the integration** by asking Claude to run SQL queries:
   ```
   Can you run this SQL query: SELECT 1 as test
   ```

## 📊 **Example Output**

```
Query executed successfully

Found 2 row(s):

id | name     | email
---|----------|------------------
1  | John Doe | john@example.com
2  | Jane     | jane@example.com

Performance: 4ms, 2 returned
```

## 🔒 **Security Features**

- **SELECT-only enforcement** for read operations
- **SQL injection prevention** through dangerous operation detection
- **Query length limits** to prevent resource exhaustion
- **Result size limits** for performance protection
- **Parameter validation** with type checking
- **Comprehensive input sanitization**

## 🧪 **Testing**

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint

# Type check
pnpm typecheck
```

**Test Coverage**: 39 tests covering all functionality including edge cases, error scenarios, and security validation.

## ⚠️ **Known Issues**

### **MCP SDK JSON Parsing Warnings**
You may see warnings like:
```
Expected ',' or ']' after array element in JSON at position 5 (line 1 column 6)
```

**These are harmless warnings** from the MCP TypeScript SDK and do not affect functionality:
- **Root Cause**: Known issue in MCP SDK's stdio message deserialization
- **Impact**: None - tools work perfectly despite the warnings
- **Status**: Tracked in [GitHub Issue #244](https://github.com/modelcontextprotocol/typescript-sdk/issues/244)
- **Action**: No action needed - will be fixed in future SDK releases

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
│   ├── read-query.ts        # SELECT query tool (implemented)
│   ├── write-query.ts       # Write operations (placeholder)
│   └── ...                  # Other tools (placeholders)
├── schemas/
│   └── read-query.ts        # Zod validation schemas
├── types/
│   └── index.ts             # TypeScript type definitions
└── __tests__/
    └── unit/                # Unit tests
```

## 🤝 **Contributing**

1. Follow existing code patterns and TypeScript strict mode
2. Write comprehensive tests for new features
3. Use the existing logging and error handling patterns
4. Update documentation for new tools or features

## 📄 **License**

[Add your license here]

## 🔗 **Links**

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [libSQL Documentation](https://docs.libsql.org/)
- [Claude Desktop](https://claude.ai/desktop)