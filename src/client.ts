import TeachMeHipaa, { type Clock, type Transport } from "@teachmehipaa/node";

import type { Config } from "./config.js";
import type { Log } from "./log.js";
import { SERVER_NAME, VERSION } from "./version.js";

/** Seams for tests; production passes none of them. */
export interface ClientOverrides {
  readonly transport?: Transport;
  readonly clock?: Clock;
  readonly maxRetries?: number;
}

/**
 * The SDK client for the configured API client. The SDK owns every HTTP
 * detail: tokens, the organization lookup, retries, idempotency keys.
 */
export const createClient = (
  config: Config,
  log: Log,
  overrides: ClientOverrides = {},
): TeachMeHipaa =>
  new TeachMeHipaa({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    environment: config.environment,
    ...(config.apiUrl === null ? {} : { baseUrl: `${config.apiUrl}/v1` }),
    appInfo: {
      name: SERVER_NAME,
      version: VERSION,
      url: "https://github.com/TeachMeHIPAA/teachmehipaa-mcp",
    },
    // The SDK logs only method, path (no query), status, latency and
    // request id; never bodies or credentials.
    logger: {
      debug: (_message, fields) => {
        log("http.response", { ...fields });
      },
    },
    ...overrides,
  });
