import { defineConfig } from "tsup";

// ESM only: the bin uses top-level await. Dependencies, the SDK included,
// stay external: they are real npm dependencies, installed next to the bin.
export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: { entry: ["src/index.ts"] },
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "node20",
  platform: "node",
});
