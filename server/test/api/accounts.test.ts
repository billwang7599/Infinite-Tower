import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { post, register, sessionCookie, sessionSetCookie, testApp } from "./app.js";

const attributes = (setCookie: string) =>
  setCookie.split(";").slice(1).map((a) => a.trim().split("=")[0]!.toLowerCase());

describe("POST /api/register", () => {
  test("makes the account, answers 201 {username} and logs in with an httpOnly, Lax, path-wide cookie", async (t) => {
    const { app, store } = await testApp(t);
    const res = await post(app, "/api/register", { username: "Asuna", password: "password1" });
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.json(), { username: "Asuna" });
    assert.equal(store.accounts.size, 1);

    const cookie = sessionSetCookie(res);
    assert.match(cookie, /; HttpOnly/);
    assert.match(cookie, /; SameSite=Lax/);
    assert.match(cookie, /; Path=\//);
    assert.match(cookie, /; Expires=/);
    assert.ok(!attributes(cookie).includes("secure"), cookie);
  });

  test("marks the cookie Secure when secureCookies is on", async (t) => {
    const { app } = await testApp(t, { secureCookies: true });
    const res = await post(app, "/api/register", { username: "asuna", password: "password1" });
    assert.ok(attributes(sessionSetCookie(res)).includes("secure"));
  });

  test("refuses a username that's taken in another case with 409", async (t) => {
    const { app } = await testApp(t);
    await register(app, "Asuna");
    const res = await post(app, "/api/register", { username: "asuna", password: "password2" });
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.json(), { error: "That username is taken." });
    assert.equal(res.headers["set-cookie"], undefined);
  });

  test("answers 400 with the rule a username or password breaks", async (t) => {
    const { app, store } = await testApp(t);
    const usernameRule = { error: "Usernames are 3-20 letters, digits, _ or -." };
    for (const username of ["ab", "a".repeat(21), "has space", "émile"]) {
      const res = await post(app, "/api/register", { username, password: "password1" });
      assert.equal(res.statusCode, 400, username);
      assert.deepEqual(res.json(), usernameRule, username);
    }
    const short = await post(app, "/api/register", { username: "asuna", password: "short" });
    assert.equal(short.statusCode, 400);
    assert.deepEqual(short.json(), { error: "Passwords need at least 8 characters." });
    assert.equal(store.accounts.size, 0);
  });

  test("trims spaces around the username", async (t) => {
    const { app } = await testApp(t);
    const res = await post(app, "/api/register", { username: "  asuna  ", password: "password1" });
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.json(), { username: "asuna" });
  });
});

describe("POST /api/login", () => {
  test("logs in with the right password, in any case of the username: 200 and a new cookie", async (t) => {
    const { app } = await testApp(t);
    const registered = await register(app, "Asuna", "password1");
    const res = await post(app, "/api/login", { username: "ASUNA", password: "password1" });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { username: "Asuna" });
    assert.notEqual(sessionCookie(res), registered);
  });

  test("answers 401 to a wrong password or an unknown username, with the same sentence", async (t) => {
    const { app } = await testApp(t);
    await register(app, "asuna", "password1");
    for (const body of [{ username: "asuna", password: "password2" }, { username: "kirito", password: "password1" }]) {
      const res = await post(app, "/api/login", body);
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.json(), { error: "Wrong username or password." });
      assert.equal(res.headers["set-cookie"], undefined);
    }
  });

  test("asks for the username when it's blank", async (t) => {
    const { app } = await testApp(t);
    const res = await post(app, "/api/login", { username: "  ", password: "password1" });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), { error: "Enter your username." });
  });
});

describe("GET /api/me and POST /api/logout", () => {
  test("/api/me names the cookie's account, and answers 401 without one", async (t) => {
    const { app } = await testApp(t);
    const cookie = await register(app, "Asuna");
    const me = await app.inject({ url: "/api/me", headers: { cookie } });
    assert.equal(me.statusCode, 200);
    assert.deepEqual(me.json(), { username: "Asuna" });

    for (const headers of [{}, { cookie: "it_session=made-up" }]) {
      const res = await app.inject({ url: "/api/me", headers });
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.json(), { error: "Not logged in." });
    }
  });

  test("logout answers 204, clears the cookie and ends the session for good", async (t) => {
    const { app, store } = await testApp(t);
    const cookie = await register(app);
    const res = await post(app, "/api/logout", {}, cookie);
    assert.equal(res.statusCode, 204);
    assert.equal(res.body, "");
    const cleared = sessionSetCookie(res);
    assert.match(cleared, /^it_session=;/);
    assert.match(cleared, /Max-Age=0/);
    assert.match(cleared, /; Path=\//);
    assert.equal(store.sessions.size, 0);
    assert.equal((await app.inject({ url: "/api/me", headers: { cookie } })).statusCode, 401);
  });

  test("logout without a cookie still answers 204", async (t) => {
    const { app } = await testApp(t);
    const res = await app.inject({ method: "POST", url: "/api/logout" });
    assert.equal(res.statusCode, 204);
  });
});
