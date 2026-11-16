import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

import type { ToolContext, Tool } from "./tool.js";
import { TOOLS } from "./tools.js";
import { SERVER_NAME, VERSION } from "./version.js";

export const INSTRUCTIONS =
  "Tools for one TeachMeHIPAA organization's HIPAA training: learners, " +
  "compliance, certificates, seats and audit history, through the " +
  "developer API with the scopes its API client was granted. Call whoami " +
  "to see the organization and scopes. Seat purchasing, webhooks and " +
  "certificate PDFs are not available here.";

/** The description a client shows, with the scopes the call needs. */
export const describeTool = (tool: Tool): string =>
  tool.scopes.length === 0
    ? tool.description
    : `${tool.description} Requires scope ${tool.scopes.join(" or ")}.`;

const unknownTool = (name: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: `Unknown tool: ${name}.` }],
});

/**
 * An MCP server exposing the curated tools against one SDK client. Connect
 * it to a transport: stdio in the bin, in-memory in tests.
 */
export const createServer = (
  context: ToolContext,
  tools: readonly Tool[] = TOOLS,
): McpServer => {
  const server = new McpServer(
    { name: SERVER_NAME, version: VERSION },
    { instructions: INSTRUCTIONS },
  );
  tools.forEach((tool) => {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: describeTool(tool),
        inputSchema: tool.inputSchema,
        annotations: { title: tool.title, ...tool.annotations },
      },
      (args: unknown) => tool.handle(context, args),
    );
  });
  // McpServer validates arguments itself and answers a mismatch with its own
  // "Input validation error" text. Owning tools/call keeps one behaviour for
  // every failure: `Invalid arguments: …` from the tool's schema, API
  // refusals as isError results, never a protocol error. tools/list stays
  // McpServer's, built from the registrations above.
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  server.server.setRequestHandler(CallToolRequestSchema, (request) => {
    const tool = byName.get(request.params.name);
    return tool === undefined
      ? unknownTool(request.params.name)
      : tool.handle(context, request.params.arguments);
  });
  return server;
};
