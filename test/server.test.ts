import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { createServer, INSTRUCTIONS } from "../src/server.js";
import { TOOLS } from "../src/tools.js";
import { SERVER_NAME } from "../src/version.js";
import {
  LEARNER_ID,
  makeContext,
  on,
  ORG_ID,
  type FakeRoute,
} from "./support/fake-api.js";
import { learnersPage } from "./support/fixtures.js";

const LEARNERS = `/v1/organizations/${ORG_ID}/learners`;

const connect = async (routes: readonly FakeRoute[] = []) => {
  const { api, context } = makeContext([
    on("GET", LEARNERS, { status: 200, body: learnersPage }),
    ...routes,
  ]);
  const server = createServer(context);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { api, client };
};

describe("the MCP server", () => {
  it("introduces itself with the server instructions", async () => {
    const { client } = await connect();

    expect(client.getServerVersion()?.name).toBe(SERVER_NAME);
    expect(client.getInstructions()).toBe(INSTRUCTIONS);
  });

  it("lists the 16 curated tools with annotations, schemas and scopes", async () => {
    const { client } = await connect();

    const { tools } = await client.listTools();

    expect(tools).toHaveLength(16);
    expect(tools.map((tool) => tool.name)).toEqual(
      TOOLS.map((tool) => tool.name),
    );
    const offboard = tools.find((tool) => tool.name === "offboard_learner");
    expect(offboard?.title).toBe("Offboard learner");
    expect(offboard?.annotations).toEqual({
      title: "Offboard learner",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(offboard?.inputSchema.required).toEqual(["learnerId"]);
    expect(offboard?.description).toMatch(/Requires scope learners:write\.$/);

    const events = tools.find((tool) => tool.name === "list_org_events");
    expect(events?.description).toMatch(
      /Requires scope webhooks:manage or audit:read\.$/,
    );

    const whoami = tools.find((tool) => tool.name === "whoami");
    expect(whoami?.description).not.toContain("Requires scope");
    expect(whoami?.annotations?.readOnlyHint).toBe(true);
  });

  it("describes inputs for the model", async () => {
    const { client } = await connect();

    const { tools } = await client.listTools();

    const list = tools.find((tool) => tool.name === "list_learners");
    expect(list?.inputSchema.properties).toMatchObject({
      status: {
        enum: expect.arrayContaining(["compliant", "expired"]) as unknown,
      },
      limit: { description: "Page size, 1-100. Defaults to 20." },
    });
  });

  it("round-trips a tool call through the SDK", async () => {
    const { client, api } = await connect();

    const result = await client.callTool({
      name: "list_learners",
      arguments: { status: "compliant" },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      items: [{ learnerId: LEARNER_ID, status: "compliant" }],
      nextCursor: "cursor-2",
    });
    expect(api.callsTo(LEARNERS)[0]?.query).toEqual({ status: "compliant" });
  });

  it("answers an API refusal as an isError tool result", async () => {
    const { client } = await connect();

    const result = await client.callTool({
      name: "get_seat_inventory",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "404 [not_found] No such resource." },
    ]);
  });

  it("answers bad arguments with the tool's own message", async () => {
    const { client, api } = await connect();

    const result = await client.callTool({
      name: "get_learner",
      arguments: { learnerId: "nope" },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: expect.stringMatching(
          /^Invalid arguments: learnerId: /,
        ) as unknown,
      },
    ]);
    expect(api.calls).toHaveLength(0);
  });

  it("answers an unknown tool as a tool result", async () => {
    const { client } = await connect();

    const result = await client.callTool({ name: "buy_seats", arguments: {} });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "Unknown tool: buy_seats." },
    ]);
  });
});
