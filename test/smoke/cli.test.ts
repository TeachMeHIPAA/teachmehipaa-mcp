import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the built bin the way an MCP client does: `node dist/cli.js` over
// stdio, against a tiny local HTTP fake of the Developer API.

const CLI = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
const CLIENT_ID = "cli_01JAAAAAAAAAAAAAAAAAAAAAAA";
const SECRET = "tmh_cs_smoke-secret-never-printed";
const ORG_ID = "org_smoke";

const json = (
  status: number,
  body: unknown,
): [number, Record<string, string>, string] => [
  status,
  { "content-type": "application/json", "x-request-id": "req_smoke" },
  JSON.stringify(body),
];

const route = (
  method: string,
  path: string,
): [number, Record<string, string>, string] => {
  if (method === "POST" && path === "/v1/auth/token") {
    return json(200, {
      access_token: "tok_smoke",
      token_type: "Bearer",
      expires_in: 900,
      scope: "learners:read",
    });
  }
  if (method === "GET" && path === "/v1/auth/introspection") {
    return json(200, {
      actorType: "client",
      clientId: CLIENT_ID,
      subjectId: null,
      orgId: ORG_ID,
      scopes: ["learners:read"],
      mode: "test",
      expiresAt: "2026-11-16T12:15:00.000Z",
    });
  }
  if (method === "GET" && path === `/v1/organizations/${ORG_ID}/learners`) {
    return json(200, { items: [], nextCursor: null });
  }
  return [
    404,
    { "content-type": "application/problem+json" },
    JSON.stringify({ title: "Not found", status: 404, code: "not_found" }),
  ];
};

const state: { server?: Server; origin?: string } = {};

beforeAll(async () => {
  if (!existsSync(CLI)) {
    throw new Error("dist/cli.js is missing; run `npm run build` first");
  }
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const [status, headers, body] = route(request.method ?? "GET", path);
    request.resume();
    response.writeHead(status, headers).end(body);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  state.server = server;
  state.origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  await new Promise((resolve) => state.server?.close(resolve));
});

describe("teachmehipaa-mcp over stdio", () => {
  it("is an executable node script, as npx runs it", () => {
    expect(readFileSync(CLI, "utf8").split("\n")[0]).toBe(
      "#!/usr/bin/env node",
    );
    expect(statSync(CLI).mode & 0o100).toBe(0o100);
  });

  it("initializes, lists the tools and runs whoami", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CLI],
      env: {
        PATH: process.env.PATH ?? "",
        TMH_CLIENT_ID: CLIENT_ID,
        TMH_CLIENT_SECRET: SECRET,
        TMH_ENVIRONMENT: "sandbox",
        TMH_API_URL: state.origin ?? "",
      },
      stderr: "pipe",
    });
    const stderr: string[] = [];
    transport.stderr?.on("data", (chunk: Buffer) => {
      stderr.push(chunk.toString("utf8"));
    });
    const client = new Client({ name: "smoke", version: "0.0.0" });

    try {
      await client.connect(transport);
      expect(client.getServerVersion()?.name).toBe("teachmehipaa-mcp");

      const { tools } = await client.listTools();
      expect(tools).toHaveLength(16);

      const whoami = await client.callTool({ name: "whoami", arguments: {} });
      expect(whoami.isError).toBeFalsy();
      expect(whoami.content).toEqual([
        {
          type: "text",
          text: expect.stringContaining(`Organization: ${ORG_ID}`) as unknown,
        },
      ]);
      expect(whoami.structuredContent).toMatchObject({
        orgId: ORG_ID,
        environment: "sandbox",
        apiUrl: state.origin,
        environmentMismatch: null,
      });

      const learners = await client.callTool({
        name: "list_learners",
        arguments: {},
      });
      expect(learners.structuredContent).toEqual({
        items: [],
        nextCursor: null,
      });
    } finally {
      await client.close();
    }

    const log = stderr.join("");
    expect(log).toContain('"event":"mcp.started"');
    expect(log).not.toContain(SECRET);
    expect(log).not.toContain("tok_smoke");
    log
      .split("\n")
      .filter((line) => line.trim() !== "")
      .forEach((line) => {
        expect(() => JSON.parse(line) as unknown).not.toThrow();
      });
  });

  it("exits 1 and names the missing variable, never the secret", () => {
    const result = spawnSync(process.execPath, [CLI], {
      env: { PATH: process.env.PATH ?? "", TMH_CLIENT_SECRET: SECRET },
      encoding: "utf8",
      timeout: 10_000,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("TMH_CLIENT_ID");
    expect(result.stderr).not.toContain(SECRET);
  });

  it("exits 1 naming both credentials when neither is set", () => {
    const result = spawnSync(process.execPath, [CLI], {
      env: { PATH: process.env.PATH ?? "" },
      encoding: "utf8",
      timeout: 10_000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("TMH_CLIENT_ID");
    expect(result.stderr).toContain("TMH_CLIENT_SECRET");
  });
});
