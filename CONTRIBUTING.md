# Contributing

## Setup

Use the Node version in `.nvmrc` (any Node 20 or newer works).

The SDK, `teachmehipaa`, is the one runtime dependency that matters here.
Once it is on npm, `npm install` is all you need. While it isn't, `npm
install` can't resolve it: install through `scripts/use-local-sdk.sh`
instead. It runs `npm pack` in a built SDK checkout, writing the tarball to
`.local-sdk/` here, then installs it together with every other dependency
using `npm install --no-save`, so `package.json` keeps the registry range
`^1.0.0`:

```sh
git clone https://github.com/TeachMeHIPAA/teachmehipaa-node.git ../teachmehipaa-node
(cd ../teachmehipaa-node && npm ci && npm run build)
scripts/use-local-sdk.sh                       # defaults to ../teachmehipaa-node
scripts/use-local-sdk.sh ~/src/teachmehipaa-node   # or any checkout
```

Rerun it after you change or rebuild the SDK.

There is no `package-lock.json`: `.npmrc` sets `package-lock=false`, because
a lockfile written while the SDK comes from a local tarball would record
that path. After the SDK is published, remove that line, run `npm install`
and commit the lockfile, then switch the workflows to `npm ci`.

## Commands

```sh
npm run lint        # ESLint and Prettier
npm run typecheck   # tsc --noEmit over src and test
npm test            # unit and server tests, no network
npm run build       # dist/index.js and the dist/cli.js bin
npm run test:smoke  # spawns dist/cli.js over stdio; run after build
```

## Layout

| Path             | What it holds                                                    |
| ---------------- | ---------------------------------------------------------------- |
| `src/cli.ts`     | The bin: reads the environment, starts the server on stdio       |
| `src/config.ts`  | Environment variables, validated with zod                        |
| `src/client.ts`  | Builds the `teachmehipaa` client                                 |
| `src/server.ts`  | The `McpServer`, its instructions and the `tools/call` handler   |
| `src/tools.ts`   | The 16 tools: names, descriptions, scopes, annotations, SDK call |
| `src/schemas.ts` | Tool input schemas                                               |
| `src/render.ts`  | The one-line text answers                                        |
| `src/errors.ts`  | SDK errors to `isError` tool results                             |
| `test/`          | Unit and server tests against a fake SDK `transport`             |
| `test/smoke/`    | The built bin over stdio against a local HTTP fake               |

## Rules

- All HTTP goes through `teachmehipaa`. Tokens, the organization
  lookup, retries, idempotency keys and ETags belong to the SDK. If a tool
  needs something the SDK lacks, add it to the SDK.
- stdout is the MCP protocol. Write diagnostics with `src/log.ts`, to stderr,
  and log identifiers only: never the secret, a token or a body. ESLint
  rejects `console` in `src/`.
- An API failure is a tool result with `isError: true` and one line of text
  the model can act on. Never let one escape as a protocol error.
- Tool names, titles, descriptions, scopes and annotations are what MCP
  clients and models see. Changing one is a visible change: update the
  changelog, and the tool list in the hosted docs
  (<https://api.tme.so/developer>, "Use with AI assistants").

## Tests

Tests build a real `teachmehipaa` client on a fake `transport`
(`test/support/fake-api.ts`), so token requests, the organization lookup,
idempotency keys and error mapping run as in production with no network.
Every tool has a success case and a refusal case in `test/tools.test.ts`.
`test/server.test.ts` connects an MCP `Client` over the in-memory transport.

`npm run test:smoke` needs a fresh build. It starts a small HTTP fake on a
free local port, spawns `node dist/cli.js` with `TMH_API_URL` pointing at it,
and drives initialize, `tools/list` and `whoami` through the MCP client's
`StdioClientTransport`. It also checks that missing configuration exits 1
without printing the secret.

## Continuous integration

`.github/workflows/ci.yml` runs lint, typecheck, tests, the build and the
smoke test on Node 20 and 22. A first step asks the registry for
`teachmehipaa@^1.0.0`. If it exists, CI runs `npm install`. If not, it
checks out `TeachMeHIPAA/teachmehipaa-node` at `main` next to this
repository, builds it and installs it with `scripts/use-local-sdk.sh`. Once
the SDK is published and the lockfile is committed, drop the checkout
branch and use `npm ci`.

## Releasing

Releases go out from `.github/workflows/release.yml`, which runs only when
dispatched by hand. A run with `publish` unchecked (the default) runs lint,
type checks, tests, the build, the smoke test and `npm pack --dry-run`, and
publishes nothing. With `publish` checked it then runs `npm publish` in the
`npm` environment through npm trusted publishing (OIDC, no npm token stored
in the repo). `publishConfig` sets public access and provenance. The
`npm` environment is restricted to `main`, so only a run on `main` can
publish.

npm trusted publishing for `@teachmehipaa/mcp` is configured on npmjs.com:
organization `TeachMeHIPAA`, repository `teachmehipaa-mcp`, workflow
`release.yml`, environment `npm`. npm only offers this once a package
exists, so the first release, `0.1.0`, is published by hand from a clean
checkout of the release commit (`npm run build`, then `npm publish`, with a
npm login that can publish to the `@teachmehipaa` scope). It needs `teachmehipaa` 1.0.0 on npm first.
To ship a later release:

1. In one PR: set `version` in `package.json` and `src/version.ts`, and move
   the changelog's Unreleased entries under that version with the date.
2. After it merges, dispatch **Release** on `main` once without `publish`
   and check the packed file list, then again with `publish` checked.
3. Tag the release commit `v<version>`.
