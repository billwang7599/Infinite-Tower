import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { currentAccount, listServers, logIn, logOut, register, SERVER_UNREACHABLE } from "../../src/net/api.js";

const ACCOUNT = { username: "test1" };
const CREDENTIALS = { username: "test1", password: "test1" };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Replaces fetch with one answering `respond`, and records the calls. */
function mockFetch(t: TestContext, respond: () => Response | Promise<Response>) {
  return t.mock.method(globalThis, "fetch", async () => respond());
}

describe("the HTTP API", () => {
  test("currentAccount returns the account when logged in", async (t) => {
    const fetch = mockFetch(t, () => json(200, ACCOUNT));
    assert.deepEqual(await currentAccount(), ACCOUNT);
    assert.deepEqual(fetch.mock.calls[0]!.arguments.slice(0, 1), ["/api/me"]);
    assert.equal((fetch.mock.calls[0]!.arguments[1] as RequestInit).method, "GET");
  });

  test("currentAccount returns null when not logged in", async (t) => {
    mockFetch(t, () => json(401, { error: "Not logged in." }));
    assert.equal(await currentAccount(), null);
  });

  test("logIn posts the credentials as JSON", async (t) => {
    const fetch = mockFetch(t, () => json(200, ACCOUNT));
    assert.deepEqual(await logIn(CREDENTIALS), ACCOUNT);
    const [path, init] = fetch.mock.calls[0]!.arguments as [string, RequestInit];
    assert.equal(path, "/api/login");
    assert.equal(init.method, "POST");
    assert.deepEqual(init.headers, { "content-type": "application/json" });
    assert.deepEqual(JSON.parse(String(init.body)), CREDENTIALS);
  });

  test("register posts to the register route", async (t) => {
    const fetch = mockFetch(t, () => json(201, ACCOUNT));
    assert.deepEqual(await register(CREDENTIALS), ACCOUNT);
    assert.equal(fetch.mock.calls[0]!.arguments[0], "/api/register");
  });

  test("the server's error message becomes the thrown error", async (t) => {
    mockFetch(t, () => json(401, { error: "Wrong username or password." }));
    await assert.rejects(logIn(CREDENTIALS), { message: "Wrong username or password." });
  });

  test("a network failure reads as the server being unreachable", async (t) => {
    mockFetch(t, () => { throw new TypeError("fetch failed"); });
    await assert.rejects(currentAccount(), { message: SERVER_UNREACHABLE });
  });

  test("an answer that isn't our JSON reads as unreachable", async (t) => {
    mockFetch(t, () => new Response("<html>Bad gateway</html>", { status: 502 }));
    await assert.rejects(logIn(CREDENTIALS), { message: SERVER_UNREACHABLE });
  });

  test("logOut sends no body and resolves on success", async (t) => {
    const fetch = mockFetch(t, () => new Response(null, { status: 204 }));
    await logOut();
    const [path, init] = fetch.mock.calls[0]!.arguments as [string, RequestInit];
    assert.equal(path, "/api/logout");
    assert.equal(init.body, undefined);
  });

  test("logOut throws the server's error when it fails", async (t) => {
    mockFetch(t, () => json(500, { error: "Something went wrong." }));
    await assert.rejects(logOut(), { message: "Something went wrong." });
  });

  test("listServers gets the game servers", async (t) => {
    const servers = [{ name: "Local", socket: "/ws", players: 1, maxPlayers: 50 }];
    const fetch = mockFetch(t, () => json(200, servers));
    assert.deepEqual(await listServers(), servers);
    assert.equal(fetch.mock.calls[0]!.arguments[0], "/api/servers");
  });
});
