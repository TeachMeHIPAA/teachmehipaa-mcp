import { describe, expect, it } from "vitest";

import { parseConfig } from "../src/config.js";

const SECRET = "tmh_cs_do-not-print";

const BASE = {
  TMH_CLIENT_ID: "cli_01JAAAAAAAAAAAAAAAAAAAAAAA",
  TMH_CLIENT_SECRET: SECRET,
};

describe("parseConfig", () => {
  it("defaults to live with no URL override", () => {
    expect(parseConfig({ ...BASE, PATH: "/usr/bin" })).toEqual({
      ok: true,
      config: {
        clientId: BASE.TMH_CLIENT_ID,
        clientSecret: SECRET,
        environment: "live",
        apiUrl: null,
      },
    });
  });

  it("reads the sandbox environment and an origin override", () => {
    const result = parseConfig({
      ...BASE,
      TMH_ENVIRONMENT: "sandbox",
      TMH_API_URL: "http://127.0.0.1:4010/",
    });

    expect(result).toMatchObject({
      ok: true,
      config: { environment: "sandbox", apiUrl: "http://127.0.0.1:4010" },
    });
  });

  it("treats empty variables as unset", () => {
    const result = parseConfig({
      ...BASE,
      TMH_ENVIRONMENT: "",
      TMH_API_URL: "",
    });

    expect(result).toMatchObject({
      ok: true,
      config: { environment: "live", apiUrl: null },
    });
  });

  it("trims the client id", () => {
    expect(
      parseConfig({ ...BASE, TMH_CLIENT_ID: `  ${BASE.TMH_CLIENT_ID}\n` }),
    ).toMatchObject({ config: { clientId: BASE.TMH_CLIENT_ID } });
  });

  it("names every missing variable", () => {
    const result = parseConfig({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.variables).toEqual(["TMH_CLIENT_ID", "TMH_CLIENT_SECRET"]);
      expect(result.message).toBe(
        [
          "Invalid configuration:",
          "  TMH_CLIENT_ID: required: the API client id (cli_…)",
          "  TMH_CLIENT_SECRET: required: the API client secret (tmh_cs_…)",
        ].join("\n"),
      );
    }
  });

  it.each([
    ["TMH_ENVIRONMENT", "production"],
    ["TMH_API_URL", "not a url"],
    ["TMH_API_URL", "ftp://api.example.test"],
    ["TMH_API_URL", "https://api.example.test/v1"],
    ["TMH_API_URL", "https://api.example.test/?x=1"],
  ])("refuses %s=%s and names it", (name, value) => {
    const result = parseConfig({ ...BASE, [name]: value });

    expect(result).toMatchObject({ ok: false, variables: [name] });
  });

  it("never puts a value in the message", () => {
    const result = parseConfig({
      TMH_CLIENT_ID: "",
      TMH_CLIENT_SECRET: SECRET,
      TMH_ENVIRONMENT: "prod-with-secret-ish-value",
      TMH_API_URL: "https://user:pw@example.test/path",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain(SECRET);
      expect(result.message).not.toContain("prod-with");
      expect(result.message).not.toContain("pw@");
    }
  });
});
