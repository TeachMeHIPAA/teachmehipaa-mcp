import { describe, expect, it } from "vitest";

import type { Tool } from "../src/tool.js";
import { TOOLS } from "../src/tools.js";
import {
  CLIENT_SECRET,
  CONFIG,
  introspectionBody,
  LEARNER_ID,
  learnerBody,
  makeContext,
  on,
  ORG_ID,
  problemReply,
  textOf,
  type FakeReply,
} from "./support/fake-api.js";
import {
  auditEventsPage,
  certificate,
  certificatesPage,
  complianceSummary,
  coursesPage,
  EVENT_ID,
  launchLink,
  learnersPage,
  orgEventsPage,
  remindAccepted,
  seats,
  verification,
} from "./support/fixtures.js";

const ORG = `/v1/organizations/${ORG_ID}`;
const LEARNER = `${ORG}/learners/${LEARNER_ID}`;

const toolNamed = (name: string): Tool => {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (tool === undefined) {
    throw new Error(`no tool ${name}`);
  }
  return tool;
};

interface ToolCase {
  readonly tool: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly idempotencyKey?: boolean;
  readonly authenticated?: boolean;
  readonly status?: number;
  readonly reply: unknown;
  readonly text: RegExp;
}

const SUCCESS_CASES: readonly ToolCase[] = [
  {
    tool: "list_courses",
    args: { limit: 5 },
    method: "GET",
    path: "/v1/courses",
    query: { limit: "5" },
    authenticated: false,
    reply: coursesPage,
    text: /hipaa: HIPAA Training \(v1, pass ≥ 85%\)/,
  },
  {
    tool: "get_compliance_summary",
    args: { courseId: "hipaa" },
    method: "GET",
    path: `${ORG}/compliance`,
    query: { courseId: "hipaa" },
    reply: complianceSummary,
    text: /85% compliant \(71\/84\)/,
  },
  {
    tool: "list_learners",
    args: { status: "expired", limit: 50, cursor: "c1" },
    method: "GET",
    path: `${ORG}/learners`,
    query: { status: "expired", limit: "50", cursor: "c1" },
    reply: learnersPage,
    text: /more available with cursor cursor-2/,
  },
  {
    tool: "list_learners",
    args: { externalId: "E-1042" },
    method: "GET",
    path: `${ORG}/learners`,
    query: { externalId: "E-1042" },
    reply: learnersPage,
    text: /ext:E-1042/,
  },
  {
    tool: "get_learner",
    args: { learnerId: LEARNER_ID },
    method: "GET",
    path: LEARNER,
    query: {},
    reply: learnerBody(),
    text: /compliant in hipaa/,
  },
  {
    tool: "create_learner",
    args: { email: "ana@clinic.example", name: "Ana Ruiz", delivery: "email" },
    method: "POST",
    path: `${ORG}/learners`,
    body: { email: "ana@clinic.example", name: "Ana Ruiz", delivery: "email" },
    idempotencyKey: true,
    status: 201,
    reply: { ...learnerBody({ status: "not_started" }), delivery: "email" },
    text: /Created learner \(one seat taken\)/,
  },
  {
    tool: "offboard_learner",
    args: { learnerId: LEARNER_ID, courseId: "hipaa" },
    method: "POST",
    path: `${LEARNER}:offboard`,
    query: { courseId: "hipaa" },
    idempotencyKey: true,
    reply: learnerBody({ status: "removed" }),
    text: /^Offboarded\./,
  },
  {
    tool: "remind_learner",
    args: { learnerId: LEARNER_ID },
    method: "POST",
    path: `${LEARNER}:remind`,
    idempotencyKey: true,
    status: 202,
    reply: remindAccepted,
    text: /Reminder queued/,
  },
  {
    tool: "create_learner_launch_link",
    args: { learnerId: LEARNER_ID },
    method: "POST",
    path: `${LEARNER}:createLaunchLink`,
    idempotencyKey: false,
    status: 201,
    reply: launchLink,
    text: /Single-use sign-in link/,
  },
  {
    tool: "list_certificates",
    args: { learnerId: LEARNER_ID },
    method: "GET",
    path: `${ORG}/certificates`,
    query: { subjectId: LEARNER_ID },
    reply: certificatesPage,
    text: /cert_1 VALID/,
  },
  {
    tool: "get_certificate",
    args: { certificateId: "cert_1" },
    method: "GET",
    path: `${ORG}/certificates/cert_1`,
    reply: certificate,
    text: /expires 2027-01-11/,
  },
  {
    tool: "verify_certificate",
    args: { tinyId: "cAbC123xYz789" },
    method: "GET",
    path: "/v1/certificate-verifications/cAbC123xYz789",
    authenticated: false,
    reply: verification,
    text: /^VALID: Ana Ruiz/,
  },
  {
    tool: "get_seat_inventory",
    args: {},
    method: "GET",
    path: `${ORG}/seats`,
    reply: seats,
    text: /6 seat\(s\) available of 10/,
  },
  {
    tool: "list_org_events",
    args: { after: EVENT_ID, type: "learner.invited" },
    method: "GET",
    path: `${ORG}/events`,
    query: { after: EVENT_ID, type: "learner.invited" },
    reply: orgEventsPage,
    text: /learner\.invited/,
  },
  {
    tool: "list_audit_events",
    args: {
      type: "learner.updated",
      learnerId: LEARNER_ID,
      since: "2026-11-01T00:00:00Z",
    },
    method: "GET",
    path: `${ORG}/audit-events`,
    query: {
      type: "learner.updated",
      subjectId: LEARNER_ID,
      since: "2026-11-01T00:00:00Z",
    },
    reply: auditEventsPage,
    text: /learner\.updated \(aud_1\)/,
  },
];

describe("tool success paths", () => {
  it.each(SUCCESS_CASES)(
    "$tool sends $method $path",
    async ({
      tool,
      args,
      method,
      path,
      query,
      body,
      reply,
      status,
      text,
      idempotencyKey,
      authenticated,
    }) => {
      const { api, context } = makeContext([
        on(method, path, { status: status ?? 200, body: reply }),
      ]);

      const result = await toolNamed(tool).handle(context, args);

      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toMatch(text);
      expect(result.structuredContent).toBeDefined();
      const [call] = api.callsTo(path);
      expect(call?.method).toBe(method);
      if (query !== undefined) {
        expect(call?.query).toEqual(query);
      }
      if (body !== undefined) {
        expect(JSON.parse(call?.body ?? "null")).toEqual(body);
      }
      if (idempotencyKey !== undefined) {
        expect(call?.headers["idempotency-key"] !== undefined).toBe(
          idempotencyKey,
        );
      }
      expect(call?.headers.authorization).toBe(
        authenticated === false ? undefined : "Bearer tok_1",
      );
    },
  );

  it("whoami reports the organization, client, scopes and environment", async () => {
    const { context } = makeContext();

    const result = await toolNamed("whoami").handle(context, {});

    const text = textOf(result);
    expect(text).toContain(`Organization: ${ORG_ID}`);
    expect(text).toContain("learners:read, learners:write");
    expect(text).toContain(`Connected to ${CONFIG.apiUrl ?? ""}`);
    expect(text).toContain("live environment");
    expect(text).not.toContain("Warning");
    expect(result.structuredContent).toMatchObject({
      orgId: ORG_ID,
      environment: "live",
      apiUrl: CONFIG.apiUrl,
      environmentMismatch: null,
    });
  });

  it("whoami without an override names the environment only", async () => {
    const { context } = makeContext([], {
      ...CONFIG,
      environment: "sandbox",
      apiUrl: null,
    });
    // No override: the SDK's sandbox URL, which the fake still answers.
    const result = await toolNamed("whoami").handle(context, {});

    expect(textOf(result)).toMatch(/^Connected to the sandbox environment/);
  });

  it("whoami says how to fix a test token used as live", async () => {
    const { context } = makeContext([
      on("GET", "/v1/auth/introspection", {
        status: 200,
        body: introspectionBody({ mode: "test" }),
      }),
    ]);

    const result = await toolNamed("whoami").handle(context, {});

    expect(textOf(result)).toContain(
      "Warning: This is a sandbox (test) token, but TMH_ENVIRONMENT is live. " +
        "Set TMH_ENVIRONMENT=sandbox.",
    );
    expect(result.structuredContent).toMatchObject({
      environmentMismatch: expect.stringContaining(
        "Set TMH_ENVIRONMENT=sandbox",
      ) as unknown,
    });
  });

  it("create_learner reports an existing learner (200) as no seat taken", async () => {
    const { context } = makeContext([
      on("POST", `${ORG}/learners`, { status: 200, body: learnerBody() }),
    ]);

    const result = await toolNamed("create_learner").handle(context, {
      email: "ana@clinic.example",
    });

    expect(textOf(result)).toContain("no seat taken");
    expect(result.structuredContent).toMatchObject({ created: false });
  });

  it("create_learner hands back the join link with delivery none", async () => {
    const { context } = makeContext([
      on("POST", `${ORG}/learners`, {
        status: 201,
        body: {
          ...learnerBody({ status: "not_started" }),
          delivery: "none",
          joinUrl: "https://training.example.test/join/abc",
        },
      }),
    ]);

    const result = await toolNamed("create_learner").handle(context, {
      email: "ana@clinic.example",
      delivery: "none",
    });

    expect(textOf(result)).toContain(
      "Join link (single use, give it only to the learner): " +
        "https://training.example.test/join/abc",
    );
  });

  it("update_learner reads the ETag, then merge-patches with If-Match", async () => {
    const { api, context } = makeContext([
      on("GET", LEARNER, {
        status: 200,
        body: learnerBody(),
        headers: { etag: '"rev-7"' },
      }),
      on("PATCH", LEARNER, {
        status: 200,
        body: learnerBody({ externalId: null }),
      }),
    ]);

    const result = await toolNamed("update_learner").handle(context, {
      learnerId: LEARNER_ID,
      externalId: null,
    });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).not.toContain("ext:");
    const patch = api.calls.find((call) => call.method === "PATCH");
    expect(patch?.headers["if-match"]).toBe('"rev-7"');
    expect(patch?.headers["content-type"]).toBe("application/merge-patch+json");
    expect(JSON.parse(patch?.body ?? "null")).toEqual({ externalId: null });
  });

  it("returns one page and never follows nextCursor", async () => {
    const { api, context } = makeContext([
      on("GET", `${ORG}/learners`, { status: 200, body: learnersPage }),
    ]);

    const result = await toolNamed("list_learners").handle(context, {});

    expect(api.callsTo(`${ORG}/learners`)).toHaveLength(1);
    expect(result.structuredContent).toEqual({
      items: learnersPage.items,
      nextCursor: "cursor-2",
    });
  });

  it("resolves the organization once and reuses the token", async () => {
    const { api, context } = makeContext([
      on("GET", `${ORG}/seats`, { status: 200, body: seats }),
    ]);

    await toolNamed("get_seat_inventory").handle(context, {});
    await toolNamed("get_seat_inventory").handle(context, {});

    expect(api.callsTo("/v1/auth/token")).toHaveLength(1);
    expect(api.callsTo("/v1/auth/introspection")).toHaveLength(1);
    expect(api.callsTo(`${ORG}/seats`)).toHaveLength(2);
  });
});

const forbidden = (detail: string): FakeReply =>
  problemReply(403, "forbidden", "Forbidden", detail);

interface RefusalCase {
  readonly tool: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly method: string;
  readonly path: string;
  readonly reply: FakeReply;
  readonly text: string;
}

const REFUSAL_CASES: readonly RefusalCase[] = [
  {
    tool: "whoami",
    args: {},
    method: "GET",
    path: "/v1/auth/introspection",
    reply: problemReply(401, "unauthorized", "Unauthorized"),
    text: "401 [unauthorized] Unauthorized.",
  },
  {
    tool: "list_courses",
    args: {},
    method: "GET",
    path: "/v1/courses",
    reply: problemReply(503, "unavailable", "Service unavailable"),
    text: "503 [unavailable] Service unavailable.",
  },
  {
    tool: "get_compliance_summary",
    args: { courseId: "nope" },
    method: "GET",
    path: `${ORG}/compliance`,
    reply: problemReply(404, "course_not_found", "Not found", "No such course"),
    text: "404 [course_not_found] Not found: No such course.",
  },
  {
    tool: "list_learners",
    args: {},
    method: "GET",
    path: `${ORG}/learners`,
    reply: forbidden("missing scope learners:read"),
    text: "403 [forbidden] Forbidden: missing scope learners:read.",
  },
  {
    tool: "get_learner",
    args: { learnerId: LEARNER_ID },
    method: "GET",
    path: LEARNER,
    reply: problemReply(404, "not_found", "Not found", "No such learner"),
    text: "404 [not_found] Not found: No such learner.",
  },
  {
    tool: "create_learner",
    args: { email: "ana@clinic.example" },
    method: "POST",
    path: `${ORG}/learners`,
    reply: problemReply(409, "seat_unavailable", "Conflict", "No free seat"),
    text: "409 [seat_unavailable] Conflict: No free seat.",
  },
  {
    tool: "update_learner",
    args: { learnerId: LEARNER_ID, name: "Ana R." },
    method: "GET",
    path: LEARNER,
    reply: forbidden("missing scope learners:read"),
    text: "403 [forbidden] Forbidden: missing scope learners:read.",
  },
  {
    tool: "offboard_learner",
    args: { learnerId: LEARNER_ID },
    method: "POST",
    path: `${LEARNER}:offboard`,
    reply: problemReply(
      409,
      "admin_not_offboardable",
      "Conflict",
      "Admins cannot be offboarded",
    ),
    text: "409 [admin_not_offboardable] Conflict: Admins cannot be offboarded.",
  },
  {
    tool: "remind_learner",
    args: { learnerId: LEARNER_ID },
    method: "POST",
    path: `${LEARNER}:remind`,
    reply: problemReply(409, "learner_removed", "Conflict"),
    text: "409 [learner_removed] Conflict.",
  },
  {
    tool: "create_learner_launch_link",
    args: { learnerId: LEARNER_ID },
    method: "POST",
    path: `${LEARNER}:createLaunchLink`,
    reply: problemReply(
      409,
      "invite_not_accepted",
      "Conflict",
      "The learner has not accepted the invite",
    ),
    text: "409 [invite_not_accepted] Conflict: The learner has not accepted the invite.",
  },
  {
    tool: "list_certificates",
    args: {},
    method: "GET",
    path: `${ORG}/certificates`,
    reply: forbidden("missing scope certificates:read"),
    text: "403 [forbidden] Forbidden: missing scope certificates:read.",
  },
  {
    tool: "get_certificate",
    args: { certificateId: "cert_9" },
    method: "GET",
    path: `${ORG}/certificates/cert_9`,
    reply: problemReply(404, "not_found", "Not found"),
    text: "404 [not_found] Not found.",
  },
  {
    tool: "verify_certificate",
    args: { tinyId: "cAbC123xYz789" },
    method: "GET",
    path: "/v1/certificate-verifications/cAbC123xYz789",
    reply: problemReply(429, "rate_limited", "Too many requests", undefined, {
      "retry-after": "12",
    }),
    text: "429 [rate_limited] Too many requests. Retry after 12s.",
  },
  {
    tool: "get_seat_inventory",
    args: {},
    method: "GET",
    path: `${ORG}/seats`,
    reply: problemReply(429, "rate_limited", "Too many requests", undefined, {
      "retry-after": "30",
    }),
    text: "429 [rate_limited] Too many requests. Retry after 30s.",
  },
  {
    tool: "list_org_events",
    args: {},
    method: "GET",
    path: `${ORG}/events`,
    reply: forbidden("needs webhooks:manage or audit:read"),
    text: "403 [forbidden] Forbidden: needs webhooks:manage or audit:read.",
  },
  {
    tool: "list_audit_events",
    args: { since: "2026-11-01T00:00:00Z" },
    method: "GET",
    path: `${ORG}/audit-events`,
    reply: {
      status: 422,
      body: {
        title: "Validation failed",
        status: 422,
        code: "validation_failed",
        errors: [{ path: "since", message: "must be within 90 days" }],
      },
    },
    text: "422 [validation_failed] Validation failed. Fields: since: must be within 90 days.",
  },
];

describe("tool refusal paths", () => {
  it("covers every tool", () => {
    expect(new Set(REFUSAL_CASES.map((refusal) => refusal.tool))).toEqual(
      new Set(TOOLS.map((tool) => tool.name)),
    );
  });

  it.each(REFUSAL_CASES)(
    "$tool answers $reply.status as an isError result",
    async ({ tool, args, method, path, reply, text }) => {
      const { context, logs } = makeContext([on(method, path, reply)]);

      const result = await toolNamed(tool).handle(context, args);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toBe(text);
      expect(result.structuredContent).toMatchObject({
        error: { status: reply.status, requestId: "req_test" },
      });
      expect(logs.find((entry) => entry.event === "mcp.tool.failed")).toEqual(
        expect.objectContaining({
          fields: expect.objectContaining({ tool }) as unknown,
        }),
      );
    },
  );

  it("refuses a malformed learner id before any request", async () => {
    const { api, context } = makeContext();

    const result = await toolNamed("get_learner").handle(context, {
      learnerId: "../../members/x",
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^Invalid arguments: learnerId: /);
    expect(api.calls).toHaveLength(0);
  });

  it("refuses an update that changes nothing", async () => {
    const { api, context } = makeContext();

    const result = await toolNamed("update_learner").handle(context, {
      learnerId: LEARNER_ID,
    });

    expect(textOf(result)).toBe(
      "Invalid arguments: set at least one of: name, externalId",
    );
    expect(api.calls).toHaveLength(0);
  });

  it("refuses unknown arguments", async () => {
    const result = await toolNamed("get_seat_inventory").handle(
      makeContext().context,
      { orgId: "someone-else" },
    );

    expect(textOf(result)).toMatch(/^Invalid arguments: .*orgId/);
  });

  it("update_learner refuses to write without an ETag", async () => {
    const { api, context } = makeContext([
      on("GET", LEARNER, { status: 200, body: learnerBody() }),
    ]);

    const result = await toolNamed("update_learner").handle(context, {
      learnerId: LEARNER_ID,
      name: "Ana R.",
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("read without an ETag");
    expect(api.calls.some((call) => call.method === "PATCH")).toBe(false);
  });

  it("update_learner reports a stale ETag", async () => {
    const { context } = makeContext([
      on("GET", LEARNER, {
        status: 200,
        body: learnerBody(),
        headers: { etag: '"rev-7"' },
      }),
      on(
        "PATCH",
        LEARNER,
        problemReply(412, "precondition_failed", "Precondition failed"),
      ),
    ]);

    const result = await toolNamed("update_learner").handle(context, {
      learnerId: LEARNER_ID,
      name: "Ana R.",
    });

    expect(textOf(result)).toBe(
      "412 [precondition_failed] Precondition failed.",
    );
  });

  it("explains a client that is not bound to an organization", async () => {
    const { context } = makeContext([
      on("GET", "/v1/auth/introspection", {
        status: 200,
        body: introspectionBody({ orgId: null }),
      }),
    ]);

    const result = await toolNamed("get_seat_inventory").handle(context, {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("not bound to an organization");
    expect(result.structuredContent).toMatchObject({
      error: { type: "NoOrganization" },
    });
  });

  it("explains refused credentials without echoing the secret", async () => {
    const { context } = makeContext([
      on("POST", "/v1/auth/token", {
        status: 401,
        body: {
          error: "invalid_client",
          error_description: "Unknown client",
        },
      }),
    ]);

    const result = await toolNamed("list_learners").handle(context, {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      "Could not obtain an access token (invalid_client: Unknown client). " +
        "Check TMH_CLIENT_ID, TMH_CLIENT_SECRET and TMH_ENVIRONMENT (now " +
        "live): credentials work only in the environment they were created in.",
    );
    expect(JSON.stringify(result)).not.toContain(CLIENT_SECRET);
  });
});

describe("tool annotations", () => {
  const WRITES = new Set([
    "create_learner",
    "update_learner",
    "offboard_learner",
    "remind_learner",
    "create_learner_launch_link",
  ]);

  it.each(TOOLS.filter((tool) => !WRITES.has(tool.name)))(
    "$name is read-only and non-destructive",
    (tool) => {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.destructiveHint).toBe(false);
    },
  );

  it.each(TOOLS.filter((tool) => WRITES.has(tool.name)))(
    "$name is not read-only",
    (tool) => {
      expect(tool.annotations.readOnlyHint).toBe(false);
    },
  );

  it("marks offboard_learner and update_learner destructive and idempotent", () => {
    ["offboard_learner", "update_learner"].forEach((name) => {
      expect(toolNamed(name).annotations).toMatchObject({
        destructiveHint: true,
        idempotentHint: true,
      });
    });
  });

  it("marks remind_learner as not idempotent (each call sends mail)", () => {
    expect(toolNamed("remind_learner").annotations.idempotentHint).toBe(false);
  });

  it("no tool reaches outside the TeachMeHIPAA API", () => {
    TOOLS.forEach((tool) => {
      expect(tool.annotations.openWorldHint).toBe(false);
    });
  });

  it("covers every curated tool and none of the excluded ones", () => {
    expect(TOOLS.map((tool) => tool.name)).toEqual([
      "whoami",
      "list_courses",
      "get_compliance_summary",
      "list_learners",
      "get_learner",
      "create_learner",
      "update_learner",
      "offboard_learner",
      "remind_learner",
      "create_learner_launch_link",
      "list_certificates",
      "get_certificate",
      "verify_certificate",
      "get_seat_inventory",
      "list_org_events",
      "list_audit_events",
    ]);
  });
});
