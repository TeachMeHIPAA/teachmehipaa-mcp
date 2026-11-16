import { readFileSync } from "node:fs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { createServer } from "../src/server.js";
import { makeContext } from "./support/fake-api.js";

interface CatalogTool {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly destructiveHint: boolean;
    readonly idempotentHint: boolean;
    readonly openWorldHint: boolean;
  };
}

interface Catalog {
  readonly tools: readonly CatalogTool[];
}

const CATALOG_FILE = new URL("../tool-catalog.json", import.meta.url);

// The vendored catalog is the hosted server's tool list. Input schemas are
// left out on purpose: the two servers generate them with different tools.
interface Hints {
  readonly readOnlyHint?: boolean | undefined;
  readonly destructiveHint?: boolean | undefined;
  readonly idempotentHint?: boolean | undefined;
  readonly openWorldHint?: boolean | undefined;
}

const hints = (annotations: Hints | undefined) => ({
  readOnlyHint: annotations?.readOnlyHint,
  destructiveHint: annotations?.destructiveHint,
  idempotentHint: annotations?.idempotentHint,
  openWorldHint: annotations?.openWorldHint,
});

const listLocalTools = async () => {
  const { context } = makeContext([]);
  const server = createServer(context);
  const client = new Client({ name: "catalog-test", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return (await client.listTools()).tools;
};

describe("tool catalog parity with the hosted server", () => {
  const catalog = JSON.parse(readFileSync(CATALOG_FILE, "utf8")) as Catalog;

  it("lists the same tool names as the hosted server", async () => {
    const tools = await listLocalTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(
      catalog.tools.map((tool) => tool.name).sort(),
    );
  });

  it("describes each tool exactly as the hosted server does", async () => {
    const tools = await listLocalTools();

    catalog.tools.forEach((expected) => {
      const actual = tools.find((tool) => tool.name === expected.name);
      expect(actual?.title, `${expected.name} title`).toBe(expected.title);
      expect(actual?.description, `${expected.name} description`).toBe(
        expected.description,
      );
      expect(hints(actual?.annotations), `${expected.name} hints`).toEqual(
        hints(expected.annotations),
      );
    });
  });
});
