# MCP libSQL by xexr

A Model Context Protocol (MCP) server for libSQL database operations, providing secure database access through Claude Desktop, Claude Code, Cursor, and other MCP-compatible clients.

Runs on Node, written in TypeScript

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
# Use your package manager of choice, e.g. npm, pnpm, bun etc

# Install globally
pnpm install -g @xexr/mcp-libsql
mcp-libsql -v # check version

# ...or build from the repository
git clone https://github.com/Xexr/mcp-libsql.git
cd mcp-libsql
pnpm install # Install dependencies
pnpm build # Build the project
node dist/index.js -v  # check version
```

## 🚀 **Usage**

### **Local Testing**

Global installation assumed below, replace "mcp-libsql" with "node dist/index.js" if using local build

```bash
# Test with file database (default: file-only logging)
mcp-libsql --url file:///tmp/test.db

# Test with HTTP database
mcp-libsql --url http://127.0.0.1:8080

# Test with Turso database (environment variable, alternatively export the env var)
LIBSQL_AUTH_TOKEN="your-token" mcp-libsql --url "libsql://your-db.turso.io"

# Test with Turso database (CLI parameter)
mcp-libsql --url "libsql://your-db.turso.io" --auth-token "your-token"

# Development mode with console logging
mcp-libsql --dev --log-mode console --url file:///tmp/test.db

# Test with different logging modes
mcp-libsql --url --log-mode both file:///tmp/test.db
```

### **Claude Desktop Integration**

Configure the MCP server in Claude Desktop based on your operating system:

#### **macOS Configuration**

1. **Create configuration file** at `~/Library/Application Support/Claude/claude_desktop_config.json`:

**Global install**
```json

{
  "mcpServers": {
    "mcp-libsql": {
      "command": "mcp-libsql",
      "args": [
        "--url",
        "file:///Users/username/database.db"
      ]
    }
  }
}
```

**Alternative configuration for local build installation:**
```json
{
  "mcpServers": {
    "mcp-libsql": {
      "command": "node",
      "args": [
        "/Users/username/projects/mcp-libsql/dist/index.js",
        "--url", 
        "file:///Users/username/database.db"
      ],
    }
  }
}
```

**Alternative configuration for global install using nvm lts for node**
```json
{
  "mcpServers": {
    "mcp-libsql": {
      "command": "zsh",
      "args": [
        "-c",
        "source ~/.nvm/nvm.sh && nvm use --lts > /dev/null && mcp-libsql --url file:///Users/username/database.db",
      ],
    }
  }
}
```

**Important**: The global installation method is recommended as it handles PATH automatically.

#### **Linux Configuration**

1. **Create configuration file** at `~/.config/Claude/claude_desktop_config.json`:

**Global install**
```json
{
  "mcpServers": {
    "mcp-libsql": {
      "command": "mcp-libsql",
      "args": [
        "--url",
        "file:///home/username/database.db"
      ]
    }
  }
}
```

**Alternative configuration for local build installation:**
```json
{
  "mcpServers": {
    "mcp-libsql": {
      "command": "node",
      "args": [
        "/home/username/projects/mcp-libsql/dist/index.js",
        "--url",
        "file:///home/username/database.db"
      ],
    }
  }
}
```

#### **Windows (WSL2) Configuration**

1. **Create configuration file** at `%APPDATA%\Claude\claude_desktop_config.json`:

**Global install**
```json
{
  "mcpServers": {
    "mcp-libsql": {
      "command": "wsl.exe",
      "args": [
        "-e",
        "bash",
        "-c",
        "mcp-libsql --url file:///home/username/database.db",
      ]
    }
  }
}
```

**Alternative configuration for local build installation:**
```json
{
  "mcpServers": {
    "mcp-libsql": {
      "command": "wsl.exe",
      "args": [
        "-e",
        "bash",
        "-c",
        "/home/username/projects/mcp-libsql/dist/index.js --url file:///home/username/database.db",
      ]
    }
  }
}
```

**Alternative configuration for global install using nvm for node**
```json
{
  "mcpServers": {
    "mcp-libsql": {
      "command": "wsl.exe",
      "args": [
        "-e",
        "bash",
        "-c",
        "source ~/.nvm/nvm.sh && mcp-libsql --url file:///home/username/database.db",
      ]
    }
  }
}
```

**Important**: Use `wsl.exe -e` (not just `wsl.exe`) to ensure proper command handling and avoid issues with server command reception on Windows.

### **Database Authentication**

For Turso (and other credentialed) databases, you'll need an authentication token. There are two secure ways to provide it:

_Global installation shown below, adjust accordingly for your setup_

#### **Method 1: Environment Variable (Recommended)**

**Configure Claude Desktop with environment variable** (macOS/Linux example):
```bash
export LIBSQL_AUTH_TOKEN="your-turso-auth-token-here"
```

```json
{
  "mcpServers": {
    "mcp-libsql": {
      "command": "mcp-libsql",
      "args": [
        "--url",
        "libsql://your-database.turso.io"
      ]
    }
  }
}
```

#### **Method 2: CLI Parameter**

```json
{
  "mcpServers": {
    "mcp-libsql": {
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
    ```bash
    export LIBSQL_AUTH_TOKEN="your-turso-auth-token-here"
    ```

    ```json
    {
      "mcpServers": {
        "mcp-libsql": {
          "command": "mcp-libsql",
          "args": [
            "--url",
            "libsql://my-app-db-username.turso.io"
          ]
        }
      }
    }
    ```

3. **Test the connection:**
   ```bash
   # Test locally first
   mcp-libsql --url "libsql://my-app-db-username.turso.io" --log-mode console
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

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test security-verification

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type check
pnpm typecheck
```

**Test Coverage**: 403 tests covering all functionality including edge cases, error scenarios, CLI arguments, authentication, and comprehensive security validation.

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
**Problem**: Claude Desktop may default to using an older Node.js version on your system which doesn't support the required feature set.

**Solution**: Use global installation and nvm node selection method shown above.

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
**Resolved**: This issue is caused by stdout console logging. The `--log-mode` option now defaults to `file` mode which prevents this issue. If you see these errors, ensure you're using the default `--log-mode file` or not specifying `--log-mode` at all. Note, the error is harmless, and the tool will still work with it if you wish to have console logging.

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