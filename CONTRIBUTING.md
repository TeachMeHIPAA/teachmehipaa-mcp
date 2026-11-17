# Contributing

## Setup

Use the Node version in `.nvmrc` (any Node 20 or newer works).

`@teachmehipaa/node` is not on npm yet, so `npm ci` and a plain
`npm install` can't resolve it. Install through `scripts/use-local-sdk.sh`
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

Rerun it after you change or rebuild the SDK. `npm ls` reports the SDK as
`invalid` because the checkout's version is `0.0.0`, outside `^1.0.0`;
that is expected until the SDK's first release.

There is no `package-lock.json` yet: `.npmrc` sets `package-lock=false`,
because a lockfile written now would record the local tarball. At launch,
remove that line, run `npm install`, and commit the lockfile.

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
| `src/client.ts`  | Builds the `@teachmehipaa/node` client                           |
| `src/server.ts`  | The `McpServer`, its instructions and the `tools/call` handler   |
| `src/tools.ts`   | The 16 tools: names, descriptions, scopes, annotations, SDK call |
| `src/schemas.ts` | Tool input schemas                                               |
| `src/render.ts`  | The one-line text answers                                        |
| `src/errors.ts`  | SDK errors to `isError` tool results                             |
| `test/`          | Unit and server tests against a fake SDK `transport`             |
| `test/smoke/`    | The built bin over stdio against a local HTTP fake               |

## Rules

- All HTTP goes through `@teachmehipaa/node`. Tokens, the organization
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
  (<https://docs.teachmehipaa.com/api#description/use-with-ai-assistants>).

## Tests

Tests build a real `@teachmehipaa/node` client on a fake `transport`
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

`.github/workflows/ci.yml` checks out this repository and
`TeachMeHIPAA/teachmehipaa-node` at `main` side by side, builds the SDK,
installs it with `scripts/use-local-sdk.sh`, then runs lint, typecheck,
tests, the build and the smoke test on Node 20 and 22. Once the SDK is on
npm, switch CI to `npm ci` and drop the second checkout.

## Releasing

Releases go out from `.github/workflows/release.yml`, which runs only when
dispatched by hand. A run with `publish` unchecked (the default) verifies
and packs, and publishes nothing. With `publish` checked it then runs
`npm publish --provenance --access public` through npm trusted publishing
(OIDC, no npm token stored in the repo).

`package.json` keeps `"private": true` until launch, so a `publish` run
fails at `npm publish` (`EPRIVATE`) even if dispatched by mistake. To ship:

1. Publish `@teachmehipaa/node` 1.0.0 first. This package depends on
   `^1.0.0` and can't be installed before that exists on npm.
2. On npm, configure trusted publishing for `@teachmehipaa/mcp`:
   repository `TeachMeHIPAA/teachmehipaa-mcp`, workflow `release.yml`.
3. In one PR: remove `"private": true`, set `version` in `package.json` and
   `src/version.ts`, remove `package-lock=false` from `.npmrc` and commit
   the lockfile, switch both workflows to `npm ci`, and move the
   changelog's Unreleased entry under the version with the date.
4. After it merges, dispatch **Release** on `main` once without `publish`
   and check the packed file list, then again with `publish` checked.
5. Tag the release commit `v<version>`.
