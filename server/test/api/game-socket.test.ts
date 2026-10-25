import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { WebSocket } from "ws";
import { register, testApp, type TestApp } from "./app.js";

async function openWs({ app }: TestApp, cookie?: string): Promise<WebSocket> {
  await app.ready();
  return app.injectWS("/ws", cookie ? { headers: { cookie } } : {});
}

/** The handler runs after the client sees the upgrade, so wait a moment for it. */
async function acceptedCount(testApp: TestApp, count: number): Promise<void> {
  for (let i = 0; i < 50 && testApp.accepted.length < count; i++) await new Promise((r) => setImmediate(r));
  assert.equal(testApp.accepted.length, count);
}

test("a socket without a login cookie is handed on with no account", async (t) => {
  const server = await testApp(t);
  const ws = await openWs(server);
  t.after(() => ws.terminate());
  await acceptedCount(server, 1);
  assert.equal(server.accepted[0]!.account, null);
});

test("a socket with a login cookie is handed on with its account", async (t) => {
  const server = await testApp(t);
  const cookie = await register(server.app, "Asuna");
  const ws = await openWs(server, cookie);
  t.after(() => ws.terminate());
  await acceptedCount(server, 1);
  assert.equal(server.accepted[0]!.account?.username, "Asuna");
});

test("an unknown or logged-out token is handed on with no account", async (t) => {
  const server = await testApp(t);
  const cookie = await register(server.app);
  await server.app.inject({ method: "POST", url: "/api/logout", headers: { cookie } });
  for (const c of [cookie, "it_session=made-up"]) {
    const ws = await openWs(server, c);
    t.after(() => ws.terminate());
  }
  await acceptedCount(server, 2);
  assert.deepEqual(server.accepted.map((a) => a.account), [null, null]);
});

test("the server's socket and the client's are connected", async (t) => {
  const server = await testApp(t);
  const ws = await openWs(server);
  t.after(() => ws.terminate());
  await acceptedCount(server, 1);
  const received = once(server.accepted[0]!.ws, "message");
  ws.send("hello");
  assert.equal(String((await received)[0]), "hello");
});

test("if the login lookup fails, the upgrade is answered 503 and nothing is handed on", async (t) => {
  const server = await testApp(t);
  const cookie = await register(server.app);
  const logged = t.mock.method(console, "error", () => {});
  server.store.fail = new Error("database down");
  await assert.rejects(openWs(server, cookie), /Unexpected server response: 503/);
  assert.equal(server.accepted.length, 0);
  assert.equal(logged.mock.callCount(), 1);
});

test("without a cookie the lookup isn't needed, so a failing store doesn't block the socket", async (t) => {
  const server = await testApp(t);
  server.store.fail = new Error("database down");
  const ws = await openWs(server);
  t.after(() => ws.terminate());
  await acceptedCount(server, 1);
  assert.equal(server.accepted[0]!.account, null);
});
