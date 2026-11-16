# Security policy

<!-- TODO(Nick): confirm the reporting address and response times before launch. -->

## Reporting a vulnerability

Please report security issues privately to **security@teachmehipaa.com**, not
in a public GitHub issue. Include the server version, what you found and, if
you can, steps to reproduce it. Don't include real learner data, access
tokens or client secrets in the report.

We will acknowledge your report, keep you informed while we fix it, and
credit you in the release notes if you would like.

## Supported versions

Security fixes are released for the latest major version.

## How the server handles secrets and learner data

- It reads the client secret from its environment and passes it only to
  `@teachmehipaa/node`, which sends it only to the token endpoint.
- It never writes the secret, an access token or a request or response body
  to stdout, stderr or disk. Its stderr log holds method, path without the
  query, status, latency, request id, and the tool name, error class, status
  and code of a failed call.
- It sends no telemetry.
- Anything a tool returns goes to the AI assistant and, through it, to the
  model provider. Grant the API client only the scopes the assistant needs.
- MCP client configs usually store the secret in plain text. Use a separate,
  narrowly scoped API client per assistant and revoke it when you stop using
  it.
