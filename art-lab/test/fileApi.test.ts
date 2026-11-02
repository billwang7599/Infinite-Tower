import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileApi } from "../fileApi.js";
import { projectToJson } from "../src/editor/json.js";
import { newProject } from "../src/editor/layers.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString("base64");
const MAX_BYTES = 4096;
const drawing = projectToJson("sprite", newProject(4, 4, ["body"]));

let root: string, dir: string, server: Server, base: string;

before(async () => {
  root = await mkdtemp(join(tmpdir(), "art-lab-"));
  dir = join(root, "files");
  server = createServer((req, res) => fileApi(dir, MAX_BYTES)(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/files`;
});

after(async () => {
  server.close();
  await rm(root, { recursive: true });
});

const put = (name: string, body: unknown) =>
  fetch(`${base}/${name}`, { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) });

test("a saved drawing is written as its JSON and its PNG, then listed and read back", async () => {
  const res = await put("boar-walk", { drawing, png: PNG });
  assert.equal(res.status, 200);
  assert.deepEqual((await readdir(dir)).sort(), ["boar-walk.json", "boar-walk.png"]);
  assert.equal(await readFile(join(dir, "boar-walk.json"), "utf8"), drawing);
  assert.deepEqual(await readFile(join(dir, "boar-walk.png")), Buffer.from(PNG, "base64"));

  const list = await (await fetch(base)).json() as { name: string }[];
  assert.deepEqual(list.map((f) => f.name), ["boar-walk"]);
  assert.equal(await (await fetch(`${base}/boar-walk`)).text(), drawing);
});

test("saving again overwrites", async () => {
  const other = projectToJson("sprite", newProject(2, 2, ["body"]));
  assert.equal((await put("again", { drawing, png: PNG })).status, 200);
  assert.equal((await put("again", { drawing: other, png: PNG })).status, 200);
  assert.equal(await readFile(join(dir, "again.json"), "utf8"), other);
});

test("a name that could reach outside the folder is refused", async () => {
  for (const name of ["..%2Fescape", "%2E%2E", "a%2Fb", ".hidden", "a.b", "", "x".repeat(65)]) {
    const { status } = await put(name, { drawing, png: PNG });
    assert.ok(status === 400 || status === 404, `${name}: ${status}`);
  }
  assert.deepEqual((await readdir(root)).sort(), ["files"]);
});

test("only a drawing the lab can open and a real PNG are saved", async () => {
  assert.equal((await put("bad", { drawing: "{}", png: PNG })).status, 400);
  assert.equal((await put("bad", { drawing, png: Buffer.from("GIF89a").toString("base64") })).status, 400);
  assert.equal((await put("bad", "not json")).status, 400);
  assert.ok(!(await readdir(dir)).some((f) => f.startsWith("bad")));
});

test("a body past the size cap is refused", async () => {
  const res = await put("huge", { drawing, png: PNG, pad: "x".repeat(MAX_BYTES) });
  assert.equal(res.status, 413);
});

test("reading a drawing that isn't there is a 404", async () => {
  assert.equal((await fetch(`${base}/nothing`)).status, 404);
});

test("the list is empty before the folder exists", async () => {
  const empty = await mkdtemp(join(tmpdir(), "art-lab-"));
  const s = createServer((req, res) => fileApi(join(empty, "none"))(req, res, () => res.end()));
  await new Promise<void>((done) => s.listen(0, "127.0.0.1", done));
  const res = await fetch(`http://127.0.0.1:${(s.address() as AddressInfo).port}/api/files`);
  assert.deepEqual(await res.json(), []);
  s.close();
  await rm(empty, { recursive: true });
});

test("other addresses pass through to the next handler", async () => {
  assert.equal((await fetch(base.replace("/api/files", "/src/main.ts"))).status, 404);
});
