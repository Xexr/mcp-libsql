# MCP libSQL by xexr

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
- **Multi-layer SQL injection prevention** with comprehensive security validation
- **Connection pooling** with health monitoring and automatic retry logic  
- **Transaction support** with automatic rollback on errors
- **Comprehensive audit logging** for security compliance

> 🔐 **Security details:** See [docs/SECURITY.md](docs/SECURITY.md) for comprehensive security features and testing.

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
# Install from npm
npm install -g @xexr/mcp-libsql

# Or clone repository
git clone <repository-url>
cd mcp-libsql

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
# Test with file database (default: file-only logging)
node dist/index.js --url file:///tmp/test.db

# Test with HTTP database
node dist/index.js --url http://127.0.0.1:8080

# Test with Turso database (environment variable)
LIBSQL_AUTH_TOKEN="your-token" node dist/index.js --url "libsql://your-db.turso.io"

# Test with Turso database (CLI parameter)
node dist/index.js --url "libsql://your-db.turso.io" --auth-token "your-token"

# Development mode with console logging
pnpm dev --url file:///tmp/test.db --log-mode console

# Test with different logging modes
node dist/index.js --url file:///tmp/test.db --log-mode both
```

### **Claude Desktop Integration**

Configure the MCP server in Claude Desktop based on your operating system:

#### **macOS Configuration**

1. **Create configuration file** at `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "libsql": {
      "command": "mcp-libsql",
      "args": [
        "--url",
        "file:///Users/username/database.db"
      ]
    }
  }
}
```

**Alternative configuration with local installation:**
```json
{
  "mcpServers": {
    "libsql": {
      "command": "node",
      "args": [
        "/Users/username/projects/mcp-libsql/dist/index.js",
        "--url", 
        "file:///Users/username/database.db"
      ],
      "cwd": "/Users/username/projects/mcp-libsql"
    }
  }
}
```

**Alternative system paths:**
- Homebrew (Intel): `/usr/local/bin/node`
- Homebrew (Apple Silicon): `/opt/homebrew/bin/node`
- Official installer: `/usr/local/bin/node`

**Important**: The global installation method is recommended as it handles PATH automatically. For local installations, Claude Desktop doesn't inherit your shell environment, so you may need to specify full paths.

#### **Linux Configuration**

1. **Create configuration file** at `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "libsql": {
      "command": "mcp-libsql",
      "args": [
        "--url",
        "file:///home/username/database.db"
      ]
    }
  }
}
```

**Alternative with local installation:**
```json
{
  "mcpServers": {
    "libsql": {
      "command": "node",
      "args": [
        "/home/username/projects/mcp-libsql/dist/index.js",
        "--url",
        "file:///home/username/database.db"
      ],
      "cwd": "/home/username/projects/mcp-libsql"
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
        "-e",
        "mcp-libsql",
        "--url",
        "file:///home/username/database.db"
      ]
    }
  }
}
```

**Important**: Use `wsl.exe -e` (not just `wsl.exe`) to ensure proper command handling and avoid issues with server command reception on Windows.

**For HTTP databases (all platforms):**
```json
{
  "mcpServers": {
    "libsql": {
      "command": "mcp-libsql",
      "args": [
        "--url",
        "http://127.0.0.1:8080"
      ]
    }
  }
}
```

### **Turso Authentication**

For Turso databases, you'll need an authentication token. There are two secure ways to provide it:

#### **Method 1: Environment Variable (Recommended)**

**Configure Claude Desktop with environment variable** (macOS example):
```json
{
  "mcpServers": {
    "libsql": {
      "command": "mcp-libsql",
      "args": [
        "--url",
        "libsql://your-database.turso.io"
      ],
      "env": {
        "LIBSQL_AUTH_TOKEN": "your-turso-auth-token-here"
      }
    }
  }
}
```

**For local testing, you can also export in your shell:**
```bash
export LIBSQL_AUTH_TOKEN="your-turso-auth-token-here"
mcp-libsql --url "libsql://your-database.turso.io"
```

#### **Method 2: CLI Parameter**

```json
{
  "mcpServers": {
    "libsql": {
      "command": "mcp-libsql",
      "args": [
        "--url",
        "libsql://your-database.turso.io",
        "--auth-token",
        "your-turso-auth-token-here"
      ]
    }
  }
}
```

#### **Getting Your Turso Auth Token**

1. **Install Turso CLI:**
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```

2. **Login to Turso:**
   ```bash
   turso auth login
   ```

3. **Create an auth token:**
   ```bash
   turso auth token create --name "mcp-libsql"
   ```

4. **Get your database URL:**
   ```bash
   turso db show your-database-name --url
   ```

#### **Security Best Practices**

- **Environment variables are safer** than CLI parameters (tokens won't appear in process lists)
- **MCP config files may contain tokens** - ensure they're not committed to version control
- **Consider using external secret management** for production environments
- **Use scoped tokens** with minimal required permissions
- **Rotate tokens regularly** for enhanced security
- **Monitor token usage** through Turso dashboard

#### **Example: Complete Turso Setup**

1. **Create and configure database:**
   ```bash
   # Create database
   turso db create my-app-db
   
   # Get database URL
   turso db show my-app-db --url
   # Output: libsql://my-app-db-username.turso.io
   
   # Create auth token
   turso auth token create --name "mcp-libsql-token"
   # Output: your-long-auth-token-string
   ```

2. **Configure Claude Desktop:**
   ```json
   {
     "mcpServers": {
       "libsql": {
         "command": "mcp-libsql",
         "args": [
           "--url",
           "libsql://my-app-db-username.turso.io"
         ],
         "env": {
           "LIBSQL_AUTH_TOKEN": "your-long-auth-token-string"
         }
       }
     }
   }
   ```

3. **Test the connection:**
   ```bash
   # Test locally first
   LIBSQL_AUTH_TOKEN="your-token" mcp-libsql --url "libsql://my-app-db-username.turso.io" --log-mode console
   ```

#### **Configuration Notes**

- **File paths**: Use absolute paths to avoid path resolution issues
- **Database URLs**: 
  - File databases: `file:///absolute/path/to/database.db`
  - HTTP databases: `http://hostname:port`
  - libSQL/Turso: `libsql://your-database.turso.io`
- **Node.js path**: Use `which node` to find your Node.js installation path
- **Working directory**: Set `cwd` to ensure relative paths work correctly
- **Authentication**: For Turso databases, use environment variables for secure token handling
- **Logging modes**: 
  - Default `file` mode prevents JSON parsing errors in MCP protocol
  - Use `--log-mode console` for development debugging
  - Use `--log-mode both` for comprehensive logging
  - Use `--log-mode none` to disable all logging

2. **Restart Claude Desktop** completely after updating the configuration

3. **Test the integration** by asking Claude to run SQL queries:
   ```
   Can you run this SQL query: SELECT 1 as test
   ```

## 🔧 **Quick Start**

1. **Install:**
   ```bash
   npm install -g @xexr/mcp-libsql
   ```

2. **Test locally:**
   ```bash
   mcp-libsql --url file:///tmp/test.db --log-mode console
   ```

3. **Configure Claude Desktop** with your Node.js path and database URL (see configuration examples below)

## 📋 **Available Tools**

- **read-query** - Execute SELECT queries with security validation
- **write-query** - INSERT/UPDATE/DELETE with transaction support  
- **create-table** - CREATE TABLE with DDL security
- **alter-table** - Modify table structure (ADD/RENAME/DROP)
- **list-tables** - Browse database metadata and objects
- **describe-table** - Inspect table schema and structure

> 📖 **Detailed API documentation:** See [docs/API.md](docs/API.md) for complete input/output examples and parameters.

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

**Test Coverage**: 317 tests covering all functionality including edge cases, error scenarios, CLI arguments, authentication, and comprehensive security validation.

## ⚠️ **Common Issues**

### **1. Build Failures**
```bash
# Clean and rebuild
rm -rf dist node_modules
pnpm install && pnpm build
```

### **2. Node.js Version Issues (macOS)**
```
SyntaxError: Unexpected token '??='
```
**Problem**: Claude Desktop uses older Node.js version. **Solution**: Use global installation:
```bash
npm install -g @xexr/mcp-libsql
```
Then use `mcp-libsql` command directly in Claude Desktop configuration.

### **3. Server Won't Start**
- For global installation: `npm install -g @xexr/mcp-libsql`
- For local installation: Ensure `pnpm build` was run and `dist/index.js` exists
- Test locally: `mcp-libsql --url file:///tmp/test.db`
- Restart Claude Desktop after config changes

### **4. Tools Not Available**
- Verify database URL is accessible
- Check Claude Desktop logs for connection errors
- Test with simple file database: `file:///tmp/test.db`

### **5. JSON Parsing Errors (Resolved)**
```
Expected ',' or ']' after array element in JSON
```
**Resolved**: This issue was caused by stdout pollution from console logging. The `--log-mode` option now defaults to `file` mode which prevents this issue. If you see these errors, ensure you're using the default `--log-mode file` or not specifying `--log-mode` at all.

### **6. Database Connection Issues**
```bash
# Test database connectivity
sqlite3 /tmp/test.db "SELECT 1"

# Fix permissions
chmod 644 /path/to/database.db
```

> 🔧 **Full troubleshooting guide:** See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for detailed solutions to all issues.

## 🏗️ **Architecture**

Built with TypeScript and modern Node.js patterns:
- **Connection pooling** with health monitoring and retry logic
- **Tool-based architecture** with consistent validation and error handling
- **Security-first design** with multi-layer input validation
- **Comprehensive testing** with 244 tests covering all scenarios

## 🤝 **Contributing**

1. Follow TypeScript strict mode and existing code patterns
2. Write tests for new features  
3. Maintain security measures
4. Update documentation

**Development:** `pnpm dev` • **Build:** `pnpm build` • **Test:** `pnpm test`

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 **Links**

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [libSQL Documentation](https://docs.libsql.org/)
- [Claude Desktop](https://claude.ai/desktop)