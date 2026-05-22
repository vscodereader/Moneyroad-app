// Emits a standalone package.json containing only this app's production
// dependencies pinned to their installed versions. Running `npm install` against
// it yields a minimal, flat node_modules for the Docker runtime image.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"));

const dependencies = {};
for (const name of Object.keys(pkg.dependencies ?? {})) {
  const depManifest = join(appDir, "node_modules", name, "package.json");
  const { version } = JSON.parse(readFileSync(depManifest, "utf8"));
  dependencies[name] = version;
}

const target = process.argv[2] ?? join(appDir, "dist");
mkdirSync(target, { recursive: true });
writeFileSync(
  join(target, "package.json"),
  `${JSON.stringify({ name: "realtime", private: true, type: "module", dependencies }, null, 2)}\n`
);

console.log(
  `Wrote runtime package.json (${Object.keys(dependencies).length} deps) to ${target}`
);
