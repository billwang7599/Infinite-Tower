/**
 * Checks the server's layering; `npm run typecheck` runs it. core/ imports only core/ and CORE_PACKAGES; an outlet
 * (ws/, api/, db/) imports itself, core/, env.ts and any package, never another outlet; every other file is main.ts or
 * env.ts. In the client, only visuals/ imports Babylon, and only game/ imports visuals/, through visuals.ts. Prints
 * each broken import and exits 1, or prints nothing.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

const SRC = resolve(import.meta.dirname, "../src");
const CLIENT_SRC = resolve(import.meta.dirname, "../../client/src");
const OUTLETS = ["ws", "api", "db"];
const TOP_FILES = ["main.ts", "env.ts"];
/** Adding one is a decision: core must stay runnable without a database, a network or the file system. */
const CORE_PACKAGES = ["@infinite-tower/shared", "node:crypto"];

/** "core", an outlet, or the file's own name for main.ts / env.ts. */
const layerOf = (file: string) => relative(SRC, file).split(sep)[0] ?? "";

/** Why `from` may not import `spec` (resolved to the layer `target`, or null for a package), or null if it may. */
function whyForbidden(from: string, spec: string, target: string | null): string | null {
  if (target === null) {
    if (from !== "core") return null;
    const ok = CORE_PACKAGES.some((p) => spec === p || spec.startsWith(`${p}/`));
    return ok ? null : `core may only use the packages ${CORE_PACKAGES.join(", ")} (scripts/check-layers.ts)`;
  }
  if (target === from) return null;
  if (from === "core") return "core may only import core/";
  if (OUTLETS.includes(from) && OUTLETS.includes(target)) {
    return `an outlet never imports another (${from}/ -> ${target}/); main.ts connects them`;
  }
  if (OUTLETS.includes(from) && target === "main.ts") return "nothing imports main.ts";
  return null;
}

const problems: string[] = [];
const sources = (dir: string) => readdirSync(dir, { recursive: true, encoding: "utf8" })
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => join(dir, f));
const importsOf = (file: string) =>
  ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles.map((i) => i.fileName);
const files = sources(SRC);

for (const file of files) {
  const layer = layerOf(file);
  const relPath = relative(resolve(SRC, "../.."), file);
  if (layer !== "core" && !OUTLETS.includes(layer) && !TOP_FILES.includes(layer)) {
    const homes = [...["core", ...OUTLETS].map((l) => `${l}/`), ...TOP_FILES].join(", ");
    problems.push(`${relPath}: every file is one of, or in one of: ${homes}`);
    continue;
  }
  if (layer === "main.ts") continue;
  for (const spec of importsOf(file)) {
    const target = spec.startsWith(".") ? layerOf(resolve(dirname(file), spec)) : null;
    const why = whyForbidden(layer, spec, target);
    if (why) problems.push(`${relPath}: imports "${spec}": ${why}`);
  }
}

for (const file of sources(CLIENT_SRC)) {
  const folder = relative(CLIENT_SRC, file).split(sep)[0];
  if (folder === "visuals") continue;
  for (const spec of importsOf(file)) {
    const path = spec.startsWith(".") ? relative(CLIENT_SRC, resolve(dirname(file), spec)) : null;
    const target = path?.split(sep)[0];
    const why = spec.startsWith("@babylonjs/") ? "only client/src/visuals/ draws, so only it imports Babylon"
      : target === "visuals" && folder !== "game" ? "only game/ starts visuals/; it reads the modes, never the reverse"
      : target === "visuals" && path !== join("visuals", "visuals.js") ? "visuals/ is entered only through visuals.ts"
      : null;
    if (why) problems.push(`${relative(resolve(SRC, "../.."), file)}: imports "${spec}": ${why}`);
  }
}

if (problems.length > 0) {
  console.error(`[layers] ${problems.length} problem(s) with the layering:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
