# Product Requirements Document: MCP libSQL Server

## Introduction/Overview

This MCP (Model Context Protocol) server enables AI assistants and developers to interact with libSQL databases through standardized tools. By providing a controlled interface to database operations, it empowers LLMs in tools like Claude Desktop, Claude Code, and Cursor to perform data operations as part of larger workflows while maintaining security through operation-specific tools.

## Goals

1. **Enable Database Access for AI Tools:** Provide a secure, standardized way for AI assistants to interact with libSQL databases
2. **Maintain Operation Security:** Ensure read and write operations are properly segregated through distinct tools
3. **Simplify Integration:** Make it easy for developers to connect their AI tools to local libSQL databases
4. **Provide Schema Introspection:** Allow AI assistants to understand database structure before performing operations
5. **Handle Errors Gracefully:** Provide clear, actionable error messages that AI assistants can understand and respond to

## User Stories

1. **As an AI assistant**, I want to query data from a libSQL database so that I can analyze information and provide insights to users.
2. **As a developer**, I want to use AI tools to manage my database schema so that I can automate database operations.
3. **As an AI assistant**, I want to understand the database schema so that I can write accurate queries without errors.
4. **As a developer**, I want the MCP server to handle connection failures gracefully so that temporary network issues don't break my workflows.
5. **As an AI assistant**, I want clear separation between read and write operations so that I don't accidentally modify data when only intending to read.

## Functional Requirements

1. **Server Initialization**
   - The server must accept a libSQL server URL as a command-line argument
   - The server must establish and maintain a persistent connection pool to the libSQL server
   - The server must expose standard MCP metadata about available tools

2. **Query Tools**
   
   2.1 **read-query Tool**
   - Must accept a SELECT SQL query as input
   - Must execute the query against the libSQL database
   - Must return results as an array of objects
   - Must reject non-SELECT queries (INSERT, UPDATE, DELETE, etc.)
   - Must handle empty result sets appropriately

   2.2 **write-query Tool**
   - Must accept INSERT, UPDATE, or DELETE queries as input
   - Must execute the query against the libSQL database
   - Must return the number of affected rows
   - Must reject SELECT queries and DDL statements
   - Must provide transaction support for data consistency

   2.3 **create-table Tool**
   - Must accept CREATE TABLE SQL statements
   - Must execute the statement against the libSQL database
   - Must return confirmation of successful table creation
   - Must reject non-CREATE TABLE statements

   2.4 **alter-table Tool**
   - Must accept ALTER TABLE SQL statements
   - Must execute the statement against the libSQL database
   - Must return confirmation of successful table alteration
   - Must support ADD COLUMN, DROP COLUMN, RENAME COLUMN operations
   - Must reject non-ALTER TABLE statements

3. **Schema Tools**
   
   3.1 **list-tables Tool**
   - Must retrieve all table names from the database
   - Must return an array of table names
   - Must handle empty databases (no tables)

   3.2 **describe-table Tool**
   - Must accept a table name as input
   - Must return column definitions including names and data types
   - Must handle non-existent table names with appropriate error messages
   - Must include additional schema information (primary keys, constraints) when available

4. **Connection Management**
   - Must implement connection pooling for efficient resource usage
   - Must automatically retry failed connections after a default timeout period
   - Must handle connection failures gracefully with informative error messages
   - Must close connections properly on server shutdown

5. **Error Handling**
   - Must return MCP-compliant error responses for all error conditions
   - Must implement reasonable query timeouts (configurable with defaults)
   - Must limit result set sizes to prevent memory issues (configurable with defaults)
   - Must provide clear error messages for SQL syntax errors
   - Must distinguish between connection errors and query errors

6. **Performance Monitoring**
   - Must include query execution time in all query responses
   - Must include number of affected/returned rows
   - Must include any available query plan information
   - Performance metrics should be returned in a consistent format across all tools

7. **Security**
   - Must validate all SQL inputs to prevent injection attacks
   - Must maintain a configurable list of restricted operations
   - Must enforce read/write separation at the tool level
   - Must log all database operations for audit purposes

## Non-Goals (Out of Scope)

1. **Authentication:** libSQL server authentication is not included in this initial version
2. **Multiple Connections:** Support for connecting to multiple libSQL servers simultaneously
3. **Advanced Configuration:** Complex configuration options beyond the server URL
4. **Database Administration:** Operations like creating/dropping databases, user management
5. **Binary Data Handling:** Special handling for BLOB data types
6. **Streaming Results:** Support for streaming large result sets

## Technical Considerations

1. **Technology Stack:**
   - TypeScript with strict mode enabled for type safety
   - Node.js 20+ runtime
   - Official libSQL client library
   - @modelcontextprotocol/sdk for MCP implementation
   - pnpm for package management
   - Vitest for unit testing
   - ESLint for code linting
   - Prettier for code formatting
   - Zod for schema validation and parsing

2. **Build System:**
   - TypeScript compiler (tsc) for building
   - Target ES2022 or later
   - Hot reloading for development using nodemon or similar

3. **Project Structure:**
   ```
   src/
   ├── tools/          # MCP tool implementations
   ├── lib/            # Core functionality (db connection, etc.)
   ├── types/          # TypeScript type definitions
   ├── schemas/        # Zod schemas
   ├── utils/          # Utility functions
   └── index.ts        # Main entry point
   ```

4. **Logging:**
   - Structured logging to both console and file
   - Log levels: error, warn, info, debug
   - Rotation for log files to prevent disk space issues
   - Include timestamp, level, and context in all logs

5. **Restricted Operations:**
   - Define a constants array for easily configurable restricted operations
   - Initial restrictions should include: DROP DATABASE, DROP TABLE (unless explicitly needed), system table modifications

6. **Connection Pooling:**
   - Implement a connection pool with reasonable defaults (e.g., min: 1, max: 10)
   - Connection timeout: 30 seconds default
   - Retry interval: 5 seconds default

7. **Query Limits:**
   - Default query timeout: 30 seconds
   - Default max result set size: 10,000 rows
   - These should be defined as constants for easy adjustment

## Success Metrics

1. **Functionality:** All six tools successfully execute their intended operations
2. **Reliability:** 99% uptime with automatic recovery from temporary connection failures
3. **Performance:** Query response time under 1 second for typical operations
4. **Security:** Zero SQL injection vulnerabilities in production use
5. **Usability:** AI assistants can successfully use all tools without human intervention
6. **Testing:** 80% unit test coverage with all tools having comprehensive test suites

## Resolved Questions

1. **Result Formatting:** JSON format only for initial version
2. **Migration Support:** Not included in initial scope
3. **Backup Operations:** Not included in initial scope
4. **Performance Monitoring:** Yes - queries should return execution metrics
5. **Schema Modifications:** Yes - ALTER TABLE operations will have a dedicated tool

## Acceptance Criteria

### read-query Tool
- ✓ Accepts valid SELECT queries
- ✓ Returns results as JSON array
- ✓ Rejects non-SELECT queries with clear error message
- ✓ Handles empty results appropriately
- ✓ Respects timeout and size limits

### write-query Tool
- ✓ Accepts INSERT, UPDATE, DELETE queries
- ✓ Returns affected row count
- ✓ Rejects SELECT queries
- ✓ Maintains transaction integrity
- ✓ Provides rollback on errors

### create-table Tool
- ✓ Accepts valid CREATE TABLE statements
- ✓ Returns success confirmation
- ✓ Rejects non-CREATE TABLE statements
- ✓ Handles existing table names appropriately

### list-tables Tool
- ✓ Returns all table names
- ✓ Handles empty database case
- ✓ Excludes system tables if applicable

### describe-table Tool
- ✓ Returns column definitions for valid tables
- ✓ Includes data types for each column
- ✓ Handles non-existent tables with clear errors
- ✓ Includes constraint information when available

### alter-table Tool
- ✓ Accepts valid ALTER TABLE statements
- ✓ Returns success confirmation
- ✓ Supports ADD/DROP/RENAME COLUMN operations
- ✓ Rejects non-ALTER TABLE statements
- ✓ Handles invalid column operations appropriately

### General Requirements
- ✓ Server starts with command-line URL argument
- ✓ Connection pool maintains persistent connections
- ✓ All errors follow MCP error format
- ✓ All query responses include performance metrics
- ✓ Unit tests cover all tools
- ✓ README includes setup and usage instructions

