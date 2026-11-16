# teachmehipaa-mcp: agent notes

- Local stdio MCP server for the TeachMeHIPAA Developer API, published as
  `@teachmehipaa/mcp`. Public repo: no internal hostnames, project names or
  ticket numbers in code, comments or docs.
- All HTTP goes through `@teachmehipaa/node`. Never add `fetch`, token or
  retry code here; if the SDK lacks something, say so and use its public API.
- stdout is the MCP protocol. Never `console.log`; diagnostics go through
  `src/log.ts` to stderr, identifiers only (no secrets, tokens or bodies).
- API failures become tool results with `isError: true`
  (`src/errors.ts`), never thrown protocol errors.
- Tool names, titles, descriptions, scopes and annotations are a contract
  with MCP clients. Change them deliberately and update README.md and
  CHANGELOG.md.
- Install: `scripts/use-local-sdk.sh <path-to-built-sdk>` (the SDK is not on
  npm yet; there is no lockfile until it is).
- Done means: `npm run lint && npm run typecheck && npm test && npm run build
&& npm run test:smoke`.
