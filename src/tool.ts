import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TeachMeHipaaError } from "teachmehipaa";
import type TeachMeHipaa from "teachmehipaa";
import type * as z from "zod";

import type { Environment } from "./config.js";
import { describeError } from "./errors.js";
import type { Log } from "./log.js";

/** What every tool runs against. */
export interface ToolContext {
  readonly client: TeachMeHipaa;
  readonly environment: Environment;
  /** The TMH_API_URL override, or null for the environment's own URL. */
  readonly apiUrl: string | null;
  readonly log: Log;
}

export interface ToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

export interface ToolOutput {
  readonly structured: Record<string, unknown>;
  readonly text: string;
}

/** One curated tool, its input type erased so the catalog is one list. */
export interface Tool {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  /**
   * Token scopes the API accepts for this call, any one of them. Empty: a
   * public route, or one that needs no scope.
   */
  readonly scopes: readonly string[];
  readonly annotations: ToolAnnotations;
  readonly inputSchema: z.ZodObject;
  handle(context: ToolContext, args: unknown): Promise<CallToolResult>;
}

export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const summarizeIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path === "" ? issue.message : `${path}: ${issue.message}`;
    })
    .join("; ");

export const invalidArguments = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: `Invalid arguments: ${message}` }],
});

/**
 * Builds a tool whose `handle` validates the arguments, runs the call and
 * turns every failure into a tool result flagged `isError`. An API refusal
 * is an answer the model should read and act on, never a protocol error.
 */
export const defineTool = <S extends z.ZodObject>(spec: {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly scopes: readonly string[];
  readonly annotations: ToolAnnotations;
  readonly inputSchema: S;
  readonly run: (
    context: ToolContext,
    input: z.output<S>,
  ) => Promise<ToolOutput>;
}): Tool => ({
  name: spec.name,
  title: spec.title,
  description: spec.description,
  scopes: spec.scopes,
  annotations: spec.annotations,
  inputSchema: spec.inputSchema,
  handle: async (context, args) => {
    const parsed = spec.inputSchema.safeParse(args ?? {});
    if (!parsed.success) {
      return invalidArguments(summarizeIssues(parsed.error));
    }
    try {
      const output = await spec.run(context, parsed.data);
      return {
        content: [{ type: "text", text: output.text }],
        structuredContent: output.structured,
      };
    } catch (error: unknown) {
      const described = describeError(error, context.environment);
      // Only identifiers: a problem's detail can quote Learner data.
      context.log("mcp.tool.failed", {
        tool: spec.name,
        error: error instanceof Error ? error.name : typeof error,
        ...(error instanceof TeachMeHipaaError
          ? {
              status: error.status,
              code: error.code,
              requestId: error.requestId,
            }
          : {}),
      });
      return {
        isError: true,
        content: [{ type: "text", text: described.text }],
        structuredContent: { ...described.structured },
      };
    }
  },
});
