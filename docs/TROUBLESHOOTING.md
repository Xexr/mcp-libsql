# Comprehensive Troubleshooting Guide

## MCP Protocol Issues

### JSON Parsing Errors (Resolved)
```
Expected ',' or ']' after array element in JSON at position 5 (line 1 column 6)
```
**Problem**: Console logging polluting stdout stream used by MCP protocol  
**Solution**: Use default `--log-mode file` or specify log mode explicitly:
```bash
# MCP-safe logging (default)
node dist/index.js --url file:///tmp/test.db

# For development debugging
node dist/index.js --url file:///tmp/test.db --log-mode console

# Both console and file logging
node dist/index.js --url file:///tmp/test.db --log-mode both
```

### Logging Configuration
```
Logs not appearing where expected
```
**Solutions**:
- Default mode is `file` - check log file location in console output
- Use `--log-mode console` for immediate console output (development)
- Use `--log-mode both` for comprehensive logging
- Use `--log-mode none` to disable all logging

## Database Connection Issues

### Connection Refused
```
Error: Connection refused to http://127.0.0.1:8080
```
**Solutions:**
- Verify database server is running
- Check firewall settings for HTTP URLs
- Test with file database: `file:///tmp/test.db`
- Ensure database is accessible from WSL2 if using Windows

### File Database Permissions
```
Error: SQLITE_CANTOPEN: unable to open database file
```
**Solutions:**
- Check file permissions: `chmod 644 /path/to/database.db`
- Ensure directory exists: `mkdir -p /path/to/directory`
- Test with `/tmp/test.db` for quick verification

## Query Execution Issues

### Query Validation Errors
```
Error: Only SELECT queries are allowed
```
**Solutions:**
- Use correct tool for operation type:
  - `read-query`: SELECT statements only
  - `write-query`: INSERT/UPDATE/DELETE only
  - `create-table`: CREATE TABLE only
  - `alter-table`: ALTER TABLE only
- Check for prohibited operations or system table access

### Transaction Failures
```
Error: Transaction rolled back due to constraint violation
```
**Solutions:**
- Check table constraints and foreign key relationships
- Verify data types match column definitions
- Use `useTransaction: false` to bypass transaction wrapper if needed

## Performance Issues

### Slow Query Performance
```
Query execution time > 30 seconds
```
**Solutions:**
- Add appropriate indexes for query patterns
- Use LIMIT clauses for large result sets
- Check database file size and consider optimization
- Monitor connection pool health

### Memory Issues with Large Results
```
Error: Result set too large (> 10,000 rows)
```
**Solutions:**
- Add LIMIT clauses to queries
- Use pagination for large datasets
- Consider batch processing for bulk operations

## Development Issues

### Hot Reload Not Working
```
pnpm dev not detecting file changes
```
**Solutions:**
- Check nodemon configuration in `nodemon.json`
- Restart development server: `Ctrl+C` then `pnpm dev`
- Clear Node.js cache: `rm -rf node_modules/.cache`

### Test Failures
```
Tests failing with connection errors
```
**Solutions:**
- Ensure no other instances are running on test database
- Clean test environment: `pnpm test:clean`
- Check for proper test isolation and cleanup

## Verification Commands

### macOS
```bash
# Test server locally with console logging
cd /path/to/mcp-libsql-server
node dist/index.js --url file:///tmp/test.db --log-mode console

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

### Linux
```bash
# Test server locally with console logging
cd /path/to/mcp-libsql-server
node dist/index.js --url file:///tmp/test.db --log-mode console

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

### Windows (WSL2)
```bash
# Test server locally with console logging (in WSL2)
cd /path/to/mcp-libsql-server
node dist/index.js --url file:///tmp/test.db --log-mode console

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

### Platform-agnostic debugging
```bash
# Check if Claude Desktop can access the files
# Run this from the directory containing your MCP server
ls -la dist/index.js
file dist/index.js

# Test with minimal database
echo "CREATE TABLE test (id INTEGER);" | sqlite3 /tmp/minimal.db
node dist/index.js --url file:///tmp/minimal.db --log-mode console

# Verify configuration syntax
cat claude_desktop_config.json | jq .  # Requires jq for JSON validation
```