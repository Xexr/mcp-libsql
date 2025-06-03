# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-03

### Initial Release

This is the first stable release of the MCP libSQL server, providing comprehensive database operations through the Model Context Protocol.

### Added

#### Core Database Tools
- **read-query**: Execute SELECT queries with comprehensive security validation
- **write-query**: INSERT/UPDATE/DELETE operations with transaction support  
- **create-table**: DDL operations for table creation with security measures
- **alter-table**: Table structure modifications (ADD/RENAME/DROP operations)
- **list-tables**: Database metadata browsing with filtering options
- **describe-table**: Table schema inspection with multiple output formats

#### Security Features
- Multi-layer SQL injection prevention with comprehensive validation
- 67 security tests covering all injection vectors
- Parameterized query support for safe data handling
- Comprehensive audit logging for security compliance
- Authentication support for libSQL/Turso databases

#### Database Support
- **File-based databases**: Local SQLite/libSQL files
- **HTTP databases**: Remote libSQL servers over HTTP
- **Turso databases**: Cloud libSQL with authentication
- Connection pooling with health monitoring
- Automatic retry logic with graceful degradation

#### Developer Experience
- Beautiful table formatting with proper alignment and NULL handling
- Performance metrics displayed for all operations
- Clear error messages with actionable context
- Development mode with enhanced logging and hot reload
- Multiple logging modes (file, console, both, none)

#### Platform Support
- **macOS**: Native Node.js installation
- **Linux**: Native Node.js installation  
- **Windows**: WSL2 support with proper command handling
- Node.js 20+ requirement for modern JavaScript features

#### Testing & Quality
- 403 comprehensive tests covering all functionality
- 67 dedicated security tests for injection prevention
- 100% test pass rate with robust error handling
- Coverage for all tools, edge cases, and error scenarios
- Continuous integration with automated testing
- TypeScript strict mode with explicit type checking

#### Documentation
- Complete API documentation with examples
- Security documentation with threat model
- Troubleshooting guide for common issues
- Installation guides for all platforms
- MCP integration examples for Claude Desktop

#### CLI Features
- Flexible database URL configuration
- Environment variable support for secure token handling
- Multiple authentication methods
- Configurable logging modes
- Development and production modes

### Technical Details

#### Architecture
- Built with TypeScript and modern Node.js patterns
- Tool-based architecture with consistent validation
- Security-first design with input sanitization
- Connection pooling with automatic health checks
- Graceful error handling and recovery

#### Dependencies
- `@libsql/client ^0.15.7`: Core libSQL database connectivity
- `@modelcontextprotocol/sdk ^1.12.0`: MCP protocol implementation
- `zod ^3.25.32`: Runtime type validation and parsing

#### Publishing
- Available on npm as `@xexr/mcp-libsql`
- Global installation support with `mcp-libsql` command
- Automated publishing with GitHub Actions
- Semantic versioning for reliable updates

### Installation

```bash
npm install -g @xexr/mcp-libsql
```

### Usage

```bash
# Quick test with file database
mcp-libsql --url file:///tmp/test.db

# Turso database with authentication
LIBSQL_AUTH_TOKEN="token" mcp-libsql --url "libsql://db.turso.io"
```

### Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "libsql": {
      "command": "mcp-libsql",
      "args": ["--url", "file:///path/to/database.db"]
    }
  }
}
```

### Security

This release includes comprehensive security measures:
- SQL injection prevention across all tools
- Input validation with Zod schemas  
- Parameterized queries for data operations
- Authentication token handling for cloud databases
- Audit logging for security compliance

For detailed security information, see [docs/SECURITY.md](docs/SECURITY.md).

### Known Issues

None at this time. See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for help with common setup issues.

---

For more information, see the [README](README.md) and [documentation](docs/).