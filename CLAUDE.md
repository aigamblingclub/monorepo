1. use `say` command before yielding control back to me (either because you finished or because you need help), so I can get notified in case I'm tabbed out
2. never yield control back before checking for type errors; use IDE diagnostics MCP
3. we use bun for the JS runtime/tooling, except when messing with external dependencies, then we respect their choice ofc
