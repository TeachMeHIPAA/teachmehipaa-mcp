import {
  ApiError,
  AuthenticationError,
  ConflictError,
  ConnectionError,
  IdempotencyError,
  InvalidRequestError,
  NotFoundError,
  OAuthError,
  PermissionDeniedError,
  PreconditionFailedError,
  RateLimitError,
  TeachMeHipaaError,
  TimeoutError,
  type FieldError,
} from "@teachmehipaa/node";
import { describe, expect, it } from "vitest";

import { describeError } from "../src/errors.js";

const details = (
  status: number | null,
  code: string | null,
  title: string | null,
  detail: string | null = null,
  errors: readonly FieldError[] = [],
) => ({
  message: [title, detail].filter((part) => part !== null).join(": "),
  status,
  code,
  title,
  detail,
  errors,
  requestId: "req_1",
  headers: {},
  raw: null,
});

const textOf = (error: unknown): string => describeError(error, "live").text;

describe("describeError", () => {
  it.each([
    [
      "InvalidRequestError",
      new InvalidRequestError(details(400, "bad_request", "Bad request")),
      "400 [bad_request] Bad request.",
    ],
    [
      "AuthenticationError",
      new AuthenticationError(
        details(401, "unauthorized", "Unauthorized", "Token expired"),
      ),
      "401 [unauthorized] Unauthorized: Token expired.",
    ],
    [
      "PermissionDeniedError",
      new PermissionDeniedError(
        details(403, "forbidden", "Forbidden", "missing scope learners:read"),
      ),
      "403 [forbidden] Forbidden: missing scope learners:read.",
    ],
    [
      "NotFoundError",
      new NotFoundError(details(404, "not_found", "Not found")),
      "404 [not_found] Not found.",
    ],
    [
      "ConflictError",
      new ConflictError(
        details(409, "seat_unavailable", "Conflict", "No seat is free"),
      ),
      "409 [seat_unavailable] Conflict: No seat is free.",
    ],
    [
      "PreconditionFailedError",
      new PreconditionFailedError(
        details(412, "precondition_failed", "Precondition failed"),
      ),
      "412 [precondition_failed] Precondition failed.",
    ],
    [
      "IdempotencyError",
      new IdempotencyError(
        details(422, "idempotency_key_reuse", "Idempotency key reused"),
      ),
      "422 [idempotency_key_reuse] Idempotency key reused.",
    ],
    [
      "ApiError",
      new ApiError(details(500, null, "Internal error")),
      "500 Internal error.",
    ],
  ])("renders %s with status, code and words", (_name, error, expected) => {
    expect(textOf(error)).toBe(expected);
  });

  it("names every field of a 422", () => {
    const error = new InvalidRequestError(
      details(422, "validation_failed", "Validation failed", null, [
        { path: "email", message: "must be an email" },
        { path: "items.3.name", message: "too long" },
      ]),
    );

    expect(textOf(error)).toBe(
      "422 [validation_failed] Validation failed. " +
        "Fields: email: must be an email; items.3.name: too long.",
    );
    expect(describeError(error, "live").structured).toMatchObject({
      error: {
        type: "InvalidRequestError",
        status: 422,
        code: "validation_failed",
        errors: [
          { path: "email", message: "must be an email" },
          { path: "items.3.name", message: "too long" },
        ],
        requestId: "req_1",
      },
    });
  });

  it("adds Retry-After to a 429", () => {
    const error = new RateLimitError({
      ...details(429, "rate_limited", "Too many requests"),
      retryAfter: 30,
    });

    expect(textOf(error)).toBe(
      "429 [rate_limited] Too many requests. Retry after 30s.",
    );
    expect(describeError(error, "live").structured).toMatchObject({
      error: { type: "RateLimitError", retryAfter: 30 },
    });
  });

  it("leaves the hint out when a 429 has no Retry-After", () => {
    const error = new RateLimitError({
      ...details(429, "rate_limited", "Too many requests"),
      retryAfter: null,
    });

    expect(textOf(error)).toBe("429 [rate_limited] Too many requests.");
  });

  it("uses the SDK's fallback words when the body is not a problem", () => {
    const error = new ApiError({
      ...details(502, null, null),
      message: "TeachMeHIPAA API responded with HTTP 502",
    });

    expect(textOf(error)).toBe("502 TeachMeHIPAA API responded with HTTP 502.");
  });

  it("renders a connection failure without a status", () => {
    const error = new ConnectionError({
      ...details(null, null, null),
      message: "Could not reach the TeachMeHIPAA API: fetch failed",
    });

    expect(textOf(error)).toBe(
      "Could not reach the TeachMeHIPAA API: fetch failed.",
    );
  });

  it("renders a timeout", () => {
    const error = new TimeoutError({
      ...details(null, null, null),
      message: "TeachMeHIPAA API did not respond within 80000 ms",
    });

    expect(textOf(error)).toBe(
      "TeachMeHIPAA API did not respond within 80000 ms.",
    );
  });

  it("points refused credentials at the three variables", () => {
    const error = new OAuthError({
      ...details(401, "invalid_client", null, "Unknown client"),
      message: "invalid_client: Unknown client",
    });

    expect(describeError(error, "sandbox").text).toBe(
      "Could not obtain an access token (invalid_client: Unknown client). " +
        "Check TMH_CLIENT_ID, TMH_CLIENT_SECRET and TMH_ENVIRONMENT (now " +
        "sandbox): credentials work only in the environment they were " +
        "created in.",
    );
  });

  it("explains a token bound to no organization", () => {
    const error = new TeachMeHipaaError({
      ...details(200, null, null),
      message:
        "The Access token is not bound to an Organization. Pass " +
        "organizationId when you create the client.",
    });

    const described = describeError(error, "live");

    expect(described.text).toContain("not bound to an organization");
    expect(described.text).not.toContain("organizationId");
    expect(described.structured).toMatchObject({
      error: { type: "NoOrganization" },
    });
  });

  it("reports anything else as unexpected, still as text", () => {
    const described = describeError(new TypeError("boom"), "live");

    expect(described.text).toMatch(/^Unexpected error: boom\. /);
    expect(described.structured).toEqual({
      error: { type: "Unexpected", message: "boom" },
    });
  });
});
