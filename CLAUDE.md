# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

You help build MCP Servers to provide data and tools to other AI agents, you have a deep understanding of the MCP protocol and the tools that can be built with it.

## Approach and Style Guide

- **Package management**: pnpm
- **TypeScript**: Strict type checking, ES modules, explicit return types
- **Naming**: PascalCase for classes/types, camelCase for functions/variables
- **Files**: Lowercase with hyphens, test files with .test.ts suffix
- **Imports**: ES module style, include .js extension, group imports logically
- **Error Handling**: Use TypeScript's strict mode, explicit error checking in tests
- **Formatting**: 2-space indentation, semicolons required, single quotes preferred
- **Testing**: Tests in the `src/__tests__` directory, use descriptive test names
- **Comments**: JSDoc for public APIs, inline comments for complex logic

## Project Structure

```
/src/              - Source code
/src/__tests__/    - Tests
/src/lib/          - Shared utilities and constants
/src/schemas/      - MCP schemas
/src/tools/        - MCP tools
/src/types/        - MCP types
/src/utils/        - Shared utilities
/src/index.ts      - Entry point
/docs/             - Documentation
/plans/            - Implementation and feature plans
/logs/             - Logs
/dist/             - Build output
```

## Development Commands

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
pnpm test <filename>   # Run tests for a specific file
```


## Documentation

Documentation is in the `docs` directory:

- `docs/mcp/mcp-docs.txt` - complete MCP protocol documentation
- `docs/mcp/typescript-sdk.md` - TypeScript SDK documentation
- `docs/libsql/` - LibSQL documentation for the spec and client

# Plans

Plans for features and improvements are in the `plans` directory. Each folder contains a plan for a specific feature or improvement and contains the following files:

- `prd-<feature>.md` - product requirements document for the feature or improvement
- `tasks-prd-<feature>.md` - a broken down task list to implement the feature or improvement
- `implementation-notes.md` - notes on the implementation of the feature or improvement, built up as you work on the feature or improvement


## Critical Rules - DO NOT VIOLATE

- **NEVER replace existing complex components with simplified versions** - always fix the actual problem
- **ALWAYS work with the existing codebase** - do not create new simplified alternatives
- **ALWAYS find and fix the root cause of issues** - debug, test, iterate instead of creating workarounds
