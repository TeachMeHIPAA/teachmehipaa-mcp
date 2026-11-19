# Changelog

All notable changes to this server are documented here. It follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[semantic versioning](https://semver.org/).

## [Unreleased]

The first release, `0.1.0`, published by hand once `teachmehipaa` 1.0.0 is
on npm; later releases go through the Release workflow.

### Added

- `list_audit_events` filters on `oauth_grant.created` and
  `oauth_grant.revoked`: an admin connecting or disconnecting an AI assistant
  through browser sign-in on the hosted server.

- A README that leads with the hosted server and links to the setup guide
  and tool list in the developer reference, at
  [Use with AI assistants](https://api.tme.so/developer), then covers the
  local server for Claude Code, Claude Desktop, Cursor and VS Code.

- `teachmehipaa-mcp`, a local (stdio) MCP server for one organization's
  API client, published as `@teachmehipaa/mcp`.
- 16 tools: `whoami`, `list_courses`, `get_compliance_summary`,
  `list_learners`, `get_learner`, `create_learner`, `update_learner`,
  `offboard_learner`, `remind_learner`, `create_learner_launch_link`,
  `list_certificates`, `get_certificate`, `verify_certificate`,
  `get_seat_inventory`, `list_org_events` and `list_audit_events`. Each has
  a one-line text answer and the full record as `structuredContent`, MCP
  annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
  `openWorldHint`) and the scopes it needs in its description.
- All HTTP through `teachmehipaa`: client credentials with a cached
  token, the organization read from the token, retries, and an
  `Idempotency-Key` on every write that takes one. `update_learner` reads
  the learner's ETag and sends it as `If-Match`.
- API refusals as tool results flagged `isError`, with status, problem
  code, title, detail, field errors and `Retry after Ns.` for a 429. Bad
  arguments answer `Invalid arguments: …` before any request.
- Configuration from `TMH_CLIENT_ID`, `TMH_CLIENT_SECRET`, `TMH_ENVIRONMENT`
  (`live` or `sandbox`) and `TMH_API_URL`. Invalid configuration exits 1
  with a message naming the variables, never their values.
- `whoami` reports the environment and says how to fix a token whose mode
  contradicts `TMH_ENVIRONMENT`.
- Diagnostics as JSON lines on stderr, without secrets, tokens or bodies.
