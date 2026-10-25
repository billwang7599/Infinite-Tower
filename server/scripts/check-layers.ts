/**
 * Checks the server's layering (main.ts explains it); `npm run typecheck` runs this after tsc.
 *
 * - core/ imports only core/ and the packages in CORE_PACKAGES: no outlet, no env.ts, no pg, ws, http, ...
 * - an outlet (ws/, api/, db/) imports itself, core/, env.ts and any package, but never another outlet.
 * - every file is in one of those folders, or is main.ts / env.ts at the top.
 *
 * Prints each broken import and exits 1, or prints nothing.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

const SRC = resolve(import.meta.dirname, "../src");
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
const files = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".ts"))
  .map((f) => join(SRC, f));

for (const file of files) {
  const layer = layerOf(file);
  const relPath = relative(resolve(SRC, "../.."), file);
  if (layer !== "core" && !OUTLETS.includes(layer) && !TOP_FILES.includes(layer)) {
    const homes = [...["core", ...OUTLETS].map((l) => `${l}/`), ...TOP_FILES].join(", ");
    problems.push(`${relPath}: every file is one of, or in one of: ${homes}`);
    continue;
  }
  if (layer === "main.ts") continue;
  for (const { fileName: spec } of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
    const target = spec.startsWith(".") ? layerOf(resolve(dirname(file), spec)) : null;
    const why = whyForbidden(layer, spec, target);
    if (why) problems.push(`${relPath}: imports "${spec}": ${why}`);
  }
}

if (problems.length > 0) {
  console.error(`[layers] ${problems.length} problem(s) with the server's layering:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
