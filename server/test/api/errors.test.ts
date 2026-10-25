import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { post, register, testApp } from "./app.js";

const SERVER_FAILED = { error: "Something went wrong on the server. Try again." };

describe("bad requests", () => {
  test("a text/plain body is refused with 415 Send JSON.", async (t) => {
    const { app } = await testApp(t);
    const res = await app.inject({
      method: "POST", url: "/api/login", headers: { "content-type": "text/plain" }, payload: "asuna:password1",
    });
    assert.equal(res.statusCode, 415);
    assert.deepEqual(res.json(), { error: "Send JSON." });
  });

  test("no body at all is refused with 415 Send JSON.", async (t) => {
    const { app } = await testApp(t);
    const res = await app.inject({ method: "POST", url: "/api/login" });
    assert.equal(res.statusCode, 415);
    assert.deepEqual(res.json(), { error: "Send JSON." });
  });

  test("a JSON content type with an empty body is 400, not valid JSON", async (t) => {
    const { app } = await testApp(t);
    const headers = { "content-type": "application/json" };
    const res = await app.inject({ method: "POST", url: "/api/login", headers });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), { error: "That isn't valid JSON." });
  });

  test("broken JSON is 400, not valid JSON", async (t) => {
    const { app } = await testApp(t);
    const res = await app.inject({
      method: "POST", url: "/api/login", headers: { "content-type": "application/json" }, payload: "{\"username\":",
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), { error: "That isn't valid JSON." });
  });

  test("a body over 4 KB is refused with 413", async (t) => {
    const { app } = await testApp(t);
    const res = await post(app, "/api/login", { username: "asuna", password: "x".repeat(4 * 1024) });
    assert.equal(res.statusCode, 413);
    assert.deepEqual(res.json(), { error: "That request is too big." });
  });
});

describe("not found", () => {
  test("an unknown /api route is a JSON 404", async (t) => {
    const { app } = await testApp(t);
    const res = await app.inject("/api/nothing-here");
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: "No such API route." });
  });

  test("an unknown page is a plain-text 404", async (t) => {
    const { app } = await testApp(t);
    const res = await app.inject("/nothing-here");
    assert.equal(res.statusCode, 404);
    assert.match(String(res.headers["content-type"]), /^text\/plain/);
    assert.match(res.body, /^Not found\./);
  });

  test("a path climbing out of client/dist finds nothing", async (t) => {
    const { app } = await testApp(t);
    const res = await app.inject("/../package.json");
    assert.equal(res.statusCode, 404);
  });
});

describe("caching and server failures", () => {
  test("every /api answer, good or bad, says cache-control: no-store", async (t) => {
    const { app } = await testApp(t);
    const cookie = await register(app);
    const answers = await Promise.all([
      app.inject({ url: "/api/me", headers: { cookie } }),
      app.inject("/api/me"),
      app.inject("/api/nothing-here"),
      post(app, "/api/login", { username: "asuna", password: "wrong-password" }),
      post(app, "/api/logout", {}, cookie),
    ]);
    for (const res of answers) assert.equal(res.headers["cache-control"], "no-store", `${res.statusCode} ${res.body}`);
  });

  test("a failing account store is a 500 with the generic sentence, and is logged", async (t) => {
    const { app, store } = await testApp(t);
    const logged = t.mock.method(console, "error", () => {});
    store.fail = new Error("database down");
    const res = await post(app, "/api/login", { username: "asuna", password: "password1" });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.json(), SERVER_FAILED);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(logged.mock.callCount(), 1);
    assert.match(String(logged.mock.calls[0]!.arguments[0]), /POST \/api\/login failed/);
  });
});
