import * as z from "zod";

export type Environment = "live" | "sandbox";

export interface Config {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly environment: Environment;
  /** An origin such as `http://127.0.0.1:4010`, or `null` for the default. */
  readonly apiUrl: string | null;
}

export type ConfigResult =
  | { readonly ok: true; readonly config: Config }
  | {
      readonly ok: false;
      readonly message: string;
      /** The variables at fault, never their values. */
      readonly variables: readonly string[];
    };

// An empty variable counts as unset: MCP client configs often carry `""`.
const optional = <S extends z.ZodType>(schema: S) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

// Zod runs refinements after a failed format check too, so this parses
// defensively.
const isOrigin = (value: string): boolean => {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return url.pathname === "/" && url.search === "" && url.hash === "";
};

// The process environment, of which only these keys are read. Not strict:
// it carries every other variable of the shell.
const EnvSchema = z.object({
  TMH_CLIENT_ID: z.string().trim().min(1),
  TMH_CLIENT_SECRET: z.string().min(1),
  TMH_ENVIRONMENT: optional(z.enum(["live", "sandbox"]).default("live")),
  TMH_API_URL: optional(
    z
      .url({ protocol: /^https?$/ })
      .refine(isOrigin)
      .optional(),
  ),
});

const HINTS: Readonly<Record<string, string>> = {
  TMH_CLIENT_ID: "required: the API client id (cli_…)",
  TMH_CLIENT_SECRET: "required: the API client secret (tmh_cs_…)",
  TMH_ENVIRONMENT: 'must be "live" or "sandbox"',
  TMH_API_URL:
    "must be an http(s) origin with no path, such as http://127.0.0.1:4010",
};

/**
 * Reads the connection settings from the process environment. A failure
 * names the variables at fault and never their values: one is a secret.
 */
export const parseConfig = (
  env: Readonly<Record<string, string | undefined>>,
): ConfigResult => {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const variables = [
      ...new Set(
        parsed.error.issues.map((issue) => String(issue.path[0] ?? "env")),
      ),
    ];
    return {
      ok: false,
      message: [
        "Invalid configuration:",
        ...variables.map((name) => `  ${name}: ${HINTS[name] ?? "invalid"}`),
      ].join("\n"),
      variables,
    };
  }
  const { data } = parsed;
  return {
    ok: true,
    config: {
      clientId: data.TMH_CLIENT_ID,
      clientSecret: data.TMH_CLIENT_SECRET,
      environment: data.TMH_ENVIRONMENT,
      apiUrl:
        data.TMH_API_URL === undefined
          ? null
          : new URL(data.TMH_API_URL).origin,
    },
  };
};
