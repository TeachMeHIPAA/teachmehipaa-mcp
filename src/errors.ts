import {
  OAuthError,
  RateLimitError,
  TeachMeHipaaError,
  type FieldError,
} from "@teachmehipaa/node";

import type { Environment } from "./config.js";

/** What a failed tool call tells the model: one line plus the details. */
export interface DescribedError {
  readonly text: string;
  readonly structured: Readonly<Record<string, unknown>>;
}

const NO_ORGANIZATION =
  "This API client is not bound to an organization, so organization tools " +
  "are unavailable. Use an organization API client (cli_…) created in the " +
  "console under Settings → Developer.";

const withPeriod = (text: string): string =>
  /[.!?]$/.test(text) ? text : `${text}.`;

const retryHint = (retryAfter: number | null): string =>
  retryAfter === null ? "" : ` Retry after ${String(retryAfter)}s.`;

const fieldHint = (errors: readonly FieldError[]): string =>
  errors.length === 0
    ? ""
    : ` Fields: ${errors
        .map((field) => `${field.path}: ${field.message}`)
        .join("; ")}.`;

const retryAfterOf = (error: TeachMeHipaaError): number | null =>
  error instanceof RateLimitError ? error.retryAfter : null;

// The SDK raises the base class, not a subclass, with the introspection's
// 2xx status when the token names no organization. Every subclass maps a
// failed or unreadable response, so this combination means only that.
const isUnboundOrganization = (error: TeachMeHipaaError): boolean =>
  error.constructor === TeachMeHipaaError &&
  error.status !== null &&
  error.status >= 200 &&
  error.status < 300;

const apiErrorText = (
  error: TeachMeHipaaError,
  environment: Environment,
): string => {
  const retry = retryHint(retryAfterOf(error));
  if (error instanceof OAuthError) {
    return (
      `Could not obtain an access token (${error.message}). Check ` +
      `TMH_CLIENT_ID, TMH_CLIENT_SECRET and TMH_ENVIRONMENT (now ` +
      `${environment}): credentials work only in the environment they ` +
      `were created in.${retry}`
    );
  }
  if (isUnboundOrganization(error)) {
    return NO_ORGANIZATION;
  }
  if (error.status === null) {
    return withPeriod(error.message);
  }
  const code = error.code === null ? "" : ` [${error.code}]`;
  return `${String(error.status)}${code} ${withPeriod(error.message)}${fieldHint(
    error.errors,
  )}${retry}`;
};

/**
 * One line an LLM can act on (status, code, what went wrong, when to retry)
 * and the same facts as structured content. Never includes credentials: the
 * SDK's errors carry only the API's own words.
 */
export const describeError = (
  error: unknown,
  environment: Environment,
): DescribedError => {
  if (error instanceof TeachMeHipaaError) {
    return {
      text: apiErrorText(error, environment),
      structured: {
        error: {
          type: isUnboundOrganization(error) ? "NoOrganization" : error.name,
          status: error.status,
          code: error.code,
          title: error.title,
          detail: error.detail,
          errors: error.errors,
          requestId: error.requestId,
          retryAfter: retryAfterOf(error),
        },
      },
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    text:
      `Unexpected error: ${withPeriod(message)} The API may have answered ` +
      "in a shape this server does not understand; the MCP server may be " +
      "out of date.",
    structured: { error: { type: "Unexpected", message } },
  };
};
