# @teachmehipaa/mcp

A local [MCP](https://modelcontextprotocol.io) server that lets an AI
assistant work with one organization's TeachMeHIPAA training through the
Developer API.

[![CI](https://github.com/TeachMeHIPAA/teachmehipaa-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/TeachMeHIPAA/teachmehipaa-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Documentation

**[Use with AI assistants](https://docs.teachmehipaa.com/api#description/use-with-ai-assistants)**
in the TeachMeHIPAA developer docs covers creating an API client, registering
this server in Claude Code, Claude Desktop, Cursor or VS Code, its tools and
the scopes each one needs.

## Install

> [!IMPORTANT]
> Pre-release. The Developer API is not generally available, and neither
> this package nor the Node.js SDK is on npm yet, so `npx -y
@teachmehipaa/mcp` won't work until launch. Build from source instead.
> Names and behavior can change before 1.0.

```sh
git clone https://github.com/TeachMeHIPAA/teachmehipaa-node.git
(cd teachmehipaa-node && npm ci && npm run build)
git clone https://github.com/TeachMeHIPAA/teachmehipaa-mcp.git
cd teachmehipaa-mcp
scripts/use-local-sdk.sh ../teachmehipaa-node
npm run build
```

## Requirements

- Node.js 20 or newer.
- An API client from the TeachMeHIPAA console (**Settings → Developer**):
  a client id (`cli_…`) and secret (`tmh_cs_…`). Start in the Sandbox
  (`https://sandbox.api.tme.so/v1`), where learners never get email.

## Usage

Register the server with Claude Code, then ask the assistant to run
**whoami** to check the connection:

```sh
claude mcp add teachmehipaa \
  -e TMH_CLIENT_ID=cli_… \
  -e TMH_CLIENT_SECRET=tmh_cs_… \
  -e TMH_ENVIRONMENT=sandbox \
  -- node /path/to/teachmehipaa-mcp/dist/cli.js
```

`TMH_ENVIRONMENT` is `live` (the default) or `sandbox`, and must match the
environment the API client was created in. The server runs over stdio,
writes only the MCP protocol to stdout, and never logs the secret, tokens or
request and response bodies.

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
