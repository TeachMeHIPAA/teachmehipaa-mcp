import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SERVER_NAME, VERSION } from "../src/version.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { readonly version: string; readonly bin: Record<string, string> };

describe("version", () => {
  it("matches package.json", () => {
    expect(VERSION).toBe(packageJson.version);
  });

  it("names the server after the bin", () => {
    expect(Object.keys(packageJson.bin)).toEqual([SERVER_NAME]);
  });
});
