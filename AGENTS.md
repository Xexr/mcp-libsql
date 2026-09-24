# xexr-libsql

MCP server exposing libSQL databases as tools for other agents. TypeScript (strict, ES modules), pnpm. Scripts are in `package.json`; tests live in `src/__tests__/`.

## Reference docs

- `docs/mcp/mcp-docs.txt` — full MCP protocol reference
- `docs/mcp/typescript-sdk.md` — MCP TypeScript SDK
- `docs/libsql/` — libSQL spec and client
- `docs/API.md`, `docs/SECURITY.md`, `docs/TROUBLESHOOTING.md`, `RELEASING.md` — as needed

## Plans

Each feature has a folder in `plans/` with `prd-<feature>.md`, `tasks-prd-<feature>.md`, and an `implementation-notes.md` that you keep up to date as you work.

## Gotchas

- Relative imports need the `.js` extension (ES module output).
- Fix problems in the existing components at their root cause. Don't swap in simplified rewrites or workarounds, since other agents depend on the current tool behaviour.
