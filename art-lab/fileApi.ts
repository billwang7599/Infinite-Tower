import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { Plugin } from "vite";
import { isSaveName } from "./src/editor/names.js";

const PREFIX = "/api/files";
const MAX_BODY_BYTES = 32 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class Refused extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > maxBytes) throw new Refused(413, `A save is at most ${maxBytes} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseSave(body: string): { drawing: string; png: Buffer } {
  let parsed: { drawing?: unknown; png?: unknown };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Refused(400, "Not JSON");
  }
  const png = typeof parsed.png === "string" ? Buffer.from(parsed.png, "base64") : null;
  if (!png || !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) throw new Refused(400, "Not a PNG");
  let drawing: { pages?: unknown } | null = null;
  try {
    drawing = typeof parsed.drawing === "string" ? JSON.parse(parsed.drawing) : null;
  } catch { /* refused below */ }
  if (!drawing || !Array.isArray(drawing.pages)) throw new Refused(400, "Not a drawing");
  return { drawing: parsed.drawing as string, png };
}

async function list(dir: string): Promise<{ name: string; modifiedMs: number }[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  const drawings = names.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter(isSaveName).sort();
  return Promise.all(drawings.map(async (name) => ({ name, modifiedMs: (await stat(join(dir, `${name}.json`))).mtimeMs })));
}

async function save(dir: string, name: string, { drawing, png }: { drawing: string; png: Buffer }): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const [ext, data] of [["json", drawing], ["png", png]] as const) {
    const path = join(dir, `${name}.${ext}`);
    await writeFile(`${path}.part`, data);
    await rename(`${path}.part`, path);
  }
}

export function fileApi(dir: string, maxBodyBytes = MAX_BODY_BYTES) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const url = (req.url ?? "").split("?")[0]!;
    if (url !== PREFIX && !url.startsWith(`${PREFIX}/`)) return next();
    const reply = (status: number, body: string, type = "application/json") => {
      res.statusCode = status;
      res.setHeader("content-type", type);
      res.end(body);
    };
    const handle = async () => {
      if (url === PREFIX) {
        if (req.method !== "GET") throw new Refused(405, "GET only");
        return reply(200, JSON.stringify(await list(dir)));
      }
      let name = "";
      try {
        name = decodeURIComponent(url.slice(PREFIX.length + 1));
      } catch { /* refused below */ }
      if (!isSaveName(name)) throw new Refused(400, "A name is letters, digits, - and _");
      if (req.method === "GET") {
        const text = await readFile(join(dir, `${name}.json`), "utf8").catch(() => null);
        return text === null ? reply(404, "{}") : reply(200, text);
      }
      if (req.method !== "PUT") throw new Refused(405, "GET or PUT");
      await save(dir, name, parseSave(await readBody(req, maxBodyBytes)));
      reply(200, JSON.stringify({ json: join(dir, `${name}.json`), png: join(dir, `${name}.png`) }));
    };
    handle().catch((e: unknown) => {
      const status = e instanceof Refused ? e.status : 500;
      reply(status, JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      if (status === 413) req.resume();
    });
  };
}

export const artLabFiles = (dir: string): Plugin => ({
  name: "art-lab-files",
  configureServer: (server) => { server.middlewares.use(fileApi(dir)); },
});
