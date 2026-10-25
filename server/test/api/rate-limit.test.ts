import assert from "node:assert/strict";
import { test } from "node:test";
import { post, testApp } from "./app.js";

// The limit is per app (and per IP; inject always comes from 127.0.0.1), so each test builds its own app.
// Logins as an unknown user skip password hashing, which keeps these fast.
const wrongLogin = { username: "nobody", password: "password1" };
const TOO_MANY = /^Too many tries\. Wait .+ and try again\.$/;

test("20 login tries a minute get answers, the 21st is 429", async (t) => {
  const { app } = await testApp(t);
  for (let i = 1; i <= 20; i++) assert.equal((await post(app, "/api/login", wrongLogin)).statusCode, 401, `try ${i}`);
  const res = await post(app, "/api/login", wrongLogin);
  assert.equal(res.statusCode, 429);
  assert.match(res.json().error, TOO_MANY);
  assert.equal(res.headers["cache-control"], "no-store");
});

test("signing up counts toward the same limit as logging in", async (t) => {
  const { app } = await testApp(t);
  // Refused bodies still count: the limit is checked before the body is read.
  for (let i = 1; i <= 10; i++) {
    assert.equal((await post(app, "/api/register", { username: "x", password: "password1" })).statusCode, 400);
  }
  for (let i = 1; i <= 10; i++) assert.equal((await post(app, "/api/login", wrongLogin)).statusCode, 401);
  const signUp = await post(app, "/api/register", { username: "asuna", password: "password1" });
  assert.equal(signUp.statusCode, 429);
  assert.match(signUp.json().error, TOO_MANY);
  assert.equal((await post(app, "/api/login", wrongLogin)).statusCode, 429);
});

test("the limit doesn't touch /api/me or /api/logout", async (t) => {
  const { app } = await testApp(t);
  for (let i = 0; i < 21; i++) await post(app, "/api/login", wrongLogin);
  assert.equal((await app.inject("/api/me")).statusCode, 401);
  assert.equal((await app.inject({ method: "POST", url: "/api/logout" })).statusCode, 204);
});
