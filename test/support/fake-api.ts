import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Clock, Transport, TransportRequest } from "@teachmehipaa/node";

import { createClient } from "../../src/client.js";
import type { Config } from "../../src/config.js";
import type { ToolContext } from "../../src/tool.js";

// A typed fake of the Developer API behind the SDK's `transport` seam. The
// SDK runs for real on top: client credentials, the organization lookup,
// idempotency keys and error mapping all happen as in production.

export const CLIENT_ID = "cli_01JAAAAAAAAAAAAAAAAAAAAAAA";
export const CLIENT_SECRET = "tmh_cs_super:secret+value";
export const ORG_ID = "org_acme";
export const LEARNER_ID = "sub_01JBBBBBBBBBBBBBBBBBBBBBBB";
export const API_URL = "https://api.example.test";

export interface FakeRequest {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
}

export interface FakeReply {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export type FakeRoute = (request: FakeRequest) => FakeReply | null;

export const on =
  (method: string, path: string, reply: FakeReply): FakeRoute =>
  (request) =>
    request.method === method && request.path === path ? reply : null;

export const problemReply = (
  status: number,
  code: string,
  title: string,
  detail?: string,
  headers?: Readonly<Record<string, string>>,
): FakeReply => ({
  status,
  body: {
    type: "about:blank",
    title,
    status,
    code,
    ...(detail === undefined ? {} : { detail }),
  },
  ...(headers === undefined ? {} : { headers }),
});

export const introspectionBody = (
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  actorType: "client",
  clientId: CLIENT_ID,
  subjectId: null,
  orgId: ORG_ID,
  scopes: ["learners:read", "learners:write", "compliance:read"],
  mode: "live",
  expiresAt: "2026-11-13T12:15:00.000Z",
  ...overrides,
});

const toFakeRequest = (request: TransportRequest): FakeRequest => {
  const url = new URL(request.url);
  return {
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: request.headers,
    body: typeof request.body === "string" ? request.body : null,
  };
};

const toResponse = (reply: FakeReply): Response =>
  new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
    status: reply.status,
    headers: {
      "content-type":
        reply.status >= 400 ? "application/problem+json" : "application/json",
      "x-request-id": "req_test",
      ...reply.headers,
    },
  });

/**
 * Routes are tried in order, then the built-in token and introspection
 * routes; anything else is a 404 problem. Tokens are numbered `tok_1`, ….
 */
export const makeFakeApi = (routes: readonly FakeRoute[] = []) => {
  const calls: FakeRequest[] = [];
  const issued: string[] = [];
  const builtIns: readonly FakeRoute[] = [
    (request) => {
      if (request.path !== "/v1/auth/token") {
        return null;
      }
      issued.push(`tok_${String(issued.length + 1)}`);
      return {
        status: 200,
        body: {
          access_token: issued.at(-1),
          token_type: "Bearer",
          expires_in: 900,
          scope: "learners:read learners:write compliance:read",
        },
      };
    },
    (request) =>
      request.path === "/v1/auth/introspection"
        ? { status: 200, body: introspectionBody() }
        : null,
  ];
  const transport: Transport = (request) => {
    const fake = toFakeRequest(request);
    calls.push(fake);
    const reply = [...routes, ...builtIns].reduce<FakeReply | null>(
      (found, route) => found ?? route(fake),
      null,
    );
    return Promise.resolve(
      toResponse(reply ?? problemReply(404, "not_found", "No such resource")),
    );
  };
  return {
    transport,
    calls,
    issued,
    callsTo: (path: string) => calls.filter((call) => call.path === path),
    apiCalls: () =>
      calls.filter(
        (call) =>
          call.path !== "/v1/auth/token" &&
          call.path !== "/v1/auth/introspection",
      ),
  };
};

/** A clock whose sleeps resolve at once, so retries never wait. */
export const instantClock: Clock = {
  now: () => Date.parse("2026-11-13T12:00:00Z"),
  sleep: () => Promise.resolve(),
};

export interface LogEntry {
  readonly event: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

export const CONFIG: Config = {
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  environment: "live",
  apiUrl: API_URL,
};

export const makeContext = (
  routes: readonly FakeRoute[] = [],
  config: Config = CONFIG,
) => {
  const api = makeFakeApi(routes);
  const logs: LogEntry[] = [];
  const log = (event: string, fields: Readonly<Record<string, unknown>>) => {
    logs.push({ event, fields });
  };
  const context: ToolContext = {
    client: createClient(config, log, {
      transport: api.transport,
      clock: instantClock,
      maxRetries: 0,
    }),
    environment: config.environment,
    apiUrl: config.apiUrl,
    log,
  };
  return { api, context, logs };
};

export const textOf = (result: CallToolResult): string =>
  result.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");

export const learnerBody = (
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  learnerId: LEARNER_ID,
  email: "ana@clinic.example",
  name: "Ana Ruiz",
  externalId: "E-1042",
  status: "compliant",
  course: { courseId: "hipaa", title: "HIPAA Training" },
  invitedAt: "2026-01-10T14:02:11Z",
  startedAt: "2026-01-11T09:30:00Z",
  completedAt: "2026-01-11T10:41:52Z",
  dueAt: null,
  certificate: null,
  ...overrides,
});
