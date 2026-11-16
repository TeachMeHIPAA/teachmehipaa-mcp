#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createClient } from "./client.js";
import { parseConfig } from "./config.js";
import { stderrLog } from "./log.js";
import { createServer } from "./server.js";
import { SERVER_NAME, VERSION } from "./version.js";

// The bin: binds real IO to the server. stdout carries the MCP protocol
// alone, so every diagnostic goes to stderr.

const parsed = parseConfig(process.env);

if (!parsed.ok) {
  process.stderr.write(`${SERVER_NAME}: ${parsed.message}\n`);
  process.exitCode = 1;
} else {
  const { config } = parsed;
  const log = stderrLog();
  const server = createServer({
    client: createClient(config, log),
    environment: config.environment,
    apiUrl: config.apiUrl,
    log,
  });
  await server.connect(new StdioServerTransport());
  log("mcp.started", {
    version: VERSION,
    environment: config.environment,
    apiUrl: config.apiUrl,
  });
}
