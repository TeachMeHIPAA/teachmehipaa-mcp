# @teachmehipaa/mcp

A local [MCP](https://modelcontextprotocol.io) server for the TeachMeHIPAA
Developer API. It lets an AI assistant (Claude Code, Claude Desktop, Cursor,
VS Code or any other MCP client) read and manage one organization's HIPAA
training through that organization's API client. It runs on your machine
over stdio and talks to the API through
[`@teachmehipaa/node`](https://github.com/TeachMeHIPAA/teachmehipaa-node).

[![CI](https://github.com/TeachMeHIPAA/teachmehipaa-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/TeachMeHIPAA/teachmehipaa-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [!IMPORTANT]
> Pre-release. The Developer API is not generally available, and neither
> `@teachmehipaa/mcp` nor `@teachmehipaa/node` is on npm yet, so the
> `npx -y @teachmehipaa/mcp` commands below won't work until launch. Until
> then, [build from source](#build-from-source) and point your MCP client at
> `node /path/to/teachmehipaa-mcp/dist/cli.js` instead. Names and behavior
> can change before 1.0.

## 1. Create an API client

In the TeachMeHIPAA console, open **Settings → Developer** and create an API
client. Grant only the scopes the assistant needs (see [Tools](#tools)).
Copy the client id (`cli_…`) and the secret (`tmh_cs_…`). The secret is shown
once.

Start in the **Sandbox**. It is a separate deployment where learners never
get email, with its own API clients. Credentials work only in the
environment they were created in, so set `TMH_ENVIRONMENT=sandbox` for a
Sandbox client and leave it unset (or `live`) for a live one.

## 2. Register the server

### Claude Code

```sh
claude mcp add teachmehipaa \
  -e TMH_CLIENT_ID=cli_… \
  -e TMH_CLIENT_SECRET=tmh_cs_… \
  -e TMH_ENVIRONMENT=sandbox \
  -- npx -y @teachmehipaa/mcp
```

### Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "teachmehipaa": {
      "command": "npx",
      "args": ["-y", "@teachmehipaa/mcp"],
      "env": {
        "TMH_CLIENT_ID": "cli_…",
        "TMH_CLIENT_SECRET": "tmh_cs_…",
        "TMH_ENVIRONMENT": "sandbox"
      }
    }
  }
}
```

### Cursor

In `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` for every
project:

```json
{
  "mcpServers": {
    "teachmehipaa": {
      "command": "npx",
      "args": ["-y", "@teachmehipaa/mcp"],
      "env": {
        "TMH_CLIENT_ID": "cli_…",
        "TMH_CLIENT_SECRET": "tmh_cs_…",
        "TMH_ENVIRONMENT": "sandbox"
      }
    }
  }
}
```

### VS Code

In `.vscode/mcp.json`. VS Code uses `servers` and needs `type`. An `inputs`
entry makes VS Code ask for the secret and store it itself, so it stays out
of the file:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "tmh-client-secret",
      "description": "TeachMeHIPAA API client secret",
      "password": true
    }
  ],
  "servers": {
    "teachmehipaa": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@teachmehipaa/mcp"],
      "env": {
        "TMH_CLIENT_ID": "cli_…",
        "TMH_CLIENT_SECRET": "${input:tmh-client-secret}",
        "TMH_ENVIRONMENT": "sandbox"
      }
    }
  }
}
```

### Keep the secret narrow

Most MCP client configs store the client secret in plain text, in a file
that other tools on your machine can read and that is easy to commit by
mistake. Create a separate API client for each assistant, grant it only the
scopes it needs, and revoke it in the console when you stop using it. Keep
project-level config files such as `.cursor/mcp.json` out of version
control, or use your client's secret prompt where it has one.

## 3. Check the connection

Ask the assistant to run **whoami**. It answers with the organization, the
API client, the granted scopes, the environment and when the access token
expires. If the token is a Sandbox (`test`) token while `TMH_ENVIRONMENT` is
`live`, or the reverse, whoami says so and tells you which value to set.

## Configuration

| Variable            | Required | Default | Meaning                                                                                                                      |
| ------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `TMH_CLIENT_ID`     | yes      |         | API client id, `cli_…`                                                                                                       |
| `TMH_CLIENT_SECRET` | yes      |         | API client secret, `tmh_cs_…`                                                                                                |
| `TMH_ENVIRONMENT`   | no       | `live`  | `live` or `sandbox`                                                                                                          |
| `TMH_API_URL`       | no       |         | An origin that replaces the environment's URL, such as a local mock: `http://127.0.0.1:4010`. Requests go to `<origin>/v1/…` |

The organization comes from the access token, so it is not configured. A
missing or invalid variable stops the server at start with a message on
stderr that names the variable, never its value.

stdout carries the MCP protocol only. Diagnostics are JSON lines on stderr:
the start-up line, one line per API response (method, path without its
query, status, latency, request id) and one per failed tool call. They never
contain the secret, an access token or a request or response body.

## Tools

| Tool                         | What it does                                       | Scope                             |
| ---------------------------- | -------------------------------------------------- | --------------------------------- |
| `whoami`                     | Organization, client, scopes, token expiry         | none                              |
| `list_courses`               | Public course catalog                              | none (public)                     |
| `get_compliance_summary`     | Compliance totals and rate for one course          | `compliance:read`                 |
| `list_learners`              | Learners by status, email or externalId, paged     | `learners:read`                   |
| `get_learner`                | One learner's status, dates, current certificate   | `learners:read`                   |
| `create_learner`             | Enroll one person (takes a seat, sends the invite) | `learners:write`                  |
| `update_learner`             | Change name or externalId                          | `learners:write`                  |
| `offboard_learner`           | Remove a person (destructive)                      | `learners:write`                  |
| `remind_learner`             | Email a reminder                                   | `learners:write`                  |
| `create_learner_launch_link` | Single-use, 5-minute sign-in URL for one learner   | `learners:write`                  |
| `list_certificates`          | Certificate records, paged or for one learner      | `certificates:read`               |
| `get_certificate`            | One certificate record                             | `certificates:read`               |
| `verify_certificate`         | Public check of a tme.so verification link         | none (public)                     |
| `get_seat_inventory`         | Seats held and free                                | `enrollments:read`                |
| `list_org_events`            | The 30-day event log that webhooks deliver from    | `webhooks:manage` or `audit:read` |
| `list_audit_events`          | The audit trail                                    | `audit:read`                      |

Read tools are annotated `readOnlyHint`. `update_learner` and
`offboard_learner` are annotated `destructiveHint`, so clients ask before
running them. Writes that the API makes idempotent by key send a fresh
`Idempotency-Key` per call, reused on the SDK's own retries.

List tools return one page per call. Pass a page's `nextCursor` back as
`cursor` (as `after` for `list_org_events`) to read the next one.

There is no `get_learner_by_external_id`, because the API has no read by
external id. Use `list_learners` with `externalId`, which matches at most one
learner.

### Errors

An API refusal comes back as a tool result with `isError: true`, never as a
protocol error, so the assistant can read it and act. The text is one line
with the status, the problem `code`, the title and detail, any field errors,
and a wait time for a 429:

```text
403 [forbidden] Forbidden: missing scope learners:read.
422 [validation_failed] Validation failed. Fields: email: must be an email.
429 [rate_limited] Too many requests. Retry after 30s.
```

`structuredContent.error` carries the same facts plus the `requestId`. Quote
that to support. Arguments that don't match a tool's schema come back as
`Invalid arguments: …` before any request is sent.

## Deliberately excluded

These operations are not exposed, so an assistant cannot reach them through
this server:

- Webhook subscription management.
- Certificate PDF download.
- Seat purchasing.

Other Developer API operations, such as enrollments, members, CSV exports
and imports and bulk learner writes, have no tool. Use
[`@teachmehipaa/node`](https://github.com/TeachMeHIPAA/teachmehipaa-node)
for those.

## Build from source

Until both packages are on npm:

```sh
git clone https://github.com/TeachMeHIPAA/teachmehipaa-node.git
(cd teachmehipaa-node && npm ci && npm run build)
git clone https://github.com/TeachMeHIPAA/teachmehipaa-mcp.git
cd teachmehipaa-mcp
scripts/use-local-sdk.sh ../teachmehipaa-node
npm run build
```

Then use `node` as the command and the absolute path to `dist/cli.js` as its
argument, in place of `npx -y @teachmehipaa/mcp`. For Claude Code:

```sh
claude mcp add teachmehipaa \
  -e TMH_CLIENT_ID=cli_… \
  -e TMH_CLIENT_SECRET=tmh_cs_… \
  -e TMH_ENVIRONMENT=sandbox \
  -- node /path/to/teachmehipaa-mcp/dist/cli.js
```

Requires Node.js 20 or newer.

## Support

<!-- TODO(Nick): confirm the support address before launch. -->

Contact TeachMeHIPAA support with the `requestId` from the failed tool
result. Report vulnerabilities privately as described in
[SECURITY.md](SECURITY.md). Changes are in the [changelog](CHANGELOG.md);
[CONTRIBUTING.md](CONTRIBUTING.md) covers working on the server.
[MIT](LICENSE) licensed.
