# @teachmehipaa/mcp

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant
work with one organization's TeachMeHIPAA training through the Developer
API. Use the hosted server, or run this package locally over stdio.

[![CI](https://github.com/TeachMeHIPAA/teachmehipaa-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/TeachMeHIPAA/teachmehipaa-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Hosted server (no install)

Most people should start here. TeachMeHIPAA runs this server for you at:

```text
https://mcp.teachmehipaa.com/mcp
```

Setup for each assistant is in the developer reference under
**[Use with AI assistants](https://api.tme.so/developer)**, which also lists
the tools and the scopes each one needs.

## Local server

Run the same tools on your own machine, over stdio, with an API client's
credentials. This is the choice when you want the credentials to stay local
or the assistant can't reach a hosted server.

> [!IMPORTANT]
> Pre-release. The Developer API is not generally available, and the first
> release of this package is pending, so `npx -y @teachmehipaa/mcp` works
> once `0.1.0` is published. Names and behavior can change before 1.0.

### Requirements

- Node.js 20 or newer.
- An API client from the TeachMeHIPAA console (**Settings → Developer**):
  a client id (`cli_…`) and secret (`tmh_cs_…`). Start in the Sandbox, where
  learners never get email.

### Configuration

| Variable            | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| `TMH_CLIENT_ID`     | The API client id, `cli_…`.                                                 |
| `TMH_CLIENT_SECRET` | The API client secret, `tmh_cs_…`.                                          |
| `TMH_ENVIRONMENT`   | `live` (the default) or `sandbox`. Must match the API client's environment. |

Run it with `npx -y @teachmehipaa/mcp`. Installing it first with
`npm install -g @teachmehipaa/mcp` is optional; the bin is
`teachmehipaa-mcp`.

### Claude Code

```sh
claude mcp add teachmehipaa \
  -e TMH_CLIENT_ID=cli_… \
  -e TMH_CLIENT_SECRET=tmh_cs_… \
  -e TMH_ENVIRONMENT=sandbox \
  -- npx -y @teachmehipaa/mcp
```

### Claude Desktop

Add this to `claude_desktop_config.json` (**Settings → Developer → Edit
Config**), then restart the app:

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

Add the same `mcpServers` block to `~/.cursor/mcp.json`, or to
`.cursor/mcp.json` in a project.

### VS Code

Add this to `.vscode/mcp.json`. VS Code prompts for the secret once and
keeps it out of the file:

```json
{
  "inputs": [
    {
      "id": "tmh-client-secret",
      "type": "promptString",
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

### Check the connection

Ask the assistant to run **whoami**. The server writes only the MCP protocol
to stdout and never logs the secret, tokens or request and response bodies.

## Support

<!-- TODO(Nick): confirm the support address before launch. -->

Contact TeachMeHIPAA support with the `requestId` from the failed tool
result. Changes are in the [changelog](CHANGELOG.md).

## Security

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
Give each assistant its own API client with only the scopes it needs, and
revoke it when you stop using it.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers working on the server.

## License

[MIT](LICENSE)
