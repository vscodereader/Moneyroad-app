import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts", "./src/scripts/sync-stock-icons.ts"],
  format: "esm",
  outDir: "./dist",
  clean: true,
  noExternal: [/@moneyroad-app\/.*/],
});
