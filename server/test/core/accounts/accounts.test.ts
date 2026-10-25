import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import { Accounts } from "../../../src/core/accounts/accounts.js";
import { MemoryAccountStore } from "../../fixtures/fakes.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function setup() {
  const store = new MemoryAccountStore();
  return { store, accounts: new Accounts(store) };
}

describe("create and verify", () => {
  test("creates an account, then refuses the same username in another case", async () => {
    const { store, accounts } = setup();
    const made = await accounts.create("Asuna", "password1");
    assert.equal(made?.username, "Asuna");
    assert.equal(await accounts.create("ASUNA", "password2"), null);
    assert.equal(store.accounts.size, 1);
  });

  test("stores a hash, never the password itself", async () => {
    const { store, accounts } = setup();
    await accounts.create("asuna", "password1");
    const stored = store.accounts.get("asuna")!;
    assert.notEqual(stored.passwordHash, "password1");
    assert.match(stored.passwordHash, /^scrypt\$/);
  });

  test("verify gives the account for the right password, and null for a wrong one or an unknown user", async () => {
    const { accounts } = setup();
    const made = await accounts.create("Asuna", "password1");
    assert.deepEqual(await accounts.verify("asuna", "password1"), made);
    assert.equal(await accounts.verify("Asuna", "password2"), null);
    assert.equal(await accounts.verify("kirito", "password1"), null);
  });
});

describe("login sessions", () => {
  test("the store only gets the token's SHA-256, and the token finds the account", async () => {
    const { store, accounts } = setup();
    const made = (await accounts.create("asuna", "password1"))!;
    const { token } = await accounts.startSession(made.id);
    assert.equal(store.sessions.has(token), false);
    assert.equal(store.sessions.get(sha256(token))?.accountId, made.id);
    assert.deepEqual(await accounts.forToken(token), made);
  });

  test("each session gets its own long random token", async () => {
    const { accounts } = setup();
    const made = (await accounts.create("asuna", "password1"))!;
    const a = await accounts.startSession(made.id);
    const b = await accounts.startSession(made.id);
    assert.notEqual(a.token, b.token);
    assert.ok(a.token.length >= 40, a.token);
  });

  test("a session lasts 30 days, then the token finds nobody", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 0, 1) });
    const { accounts } = setup();
    const made = (await accounts.create("asuna", "password1"))!;
    const { token, expires } = await accounts.startSession(made.id);
    assert.equal(expires.getTime(), Date.UTC(2026, 0, 1) + 30 * DAY_MS);

    t.mock.timers.tick(30 * DAY_MS - 1);
    assert.deepEqual(await accounts.forToken(token), made);
    t.mock.timers.tick(1);
    assert.equal(await accounts.forToken(token), null);
  });

  test("an unknown token finds nobody", async () => {
    const { accounts } = setup();
    await accounts.create("asuna", "password1");
    assert.equal(await accounts.forToken("not-a-token"), null);
  });

  test("ending a session removes it from the store", async () => {
    const { store, accounts } = setup();
    const made = (await accounts.create("asuna", "password1"))!;
    const { token } = await accounts.startSession(made.id);
    await accounts.endSession(token);
    assert.equal(store.sessions.size, 0);
    assert.equal(await accounts.forToken(token), null);
  });

  test("starting a session clears that account's expired sessions, and keeps the rest", async () => {
    const { store, accounts } = setup();
    const asuna = (await accounts.create("asuna", "password1"))!;
    const kirito = (await accounts.create("kirito", "password1"))!;
    const past = new Date(Date.now() - DAY_MS);
    const future = new Date(Date.now() + DAY_MS);
    store.sessions.set("asuna-old", { accountId: asuna.id, expires: past });
    store.sessions.set("asuna-live", { accountId: asuna.id, expires: future });
    store.sessions.set("kirito-old", { accountId: kirito.id, expires: past });

    const { token } = await accounts.startSession(asuna.id);
    assert.deepEqual([...store.sessions.keys()].sort(), ["asuna-live", "kirito-old", sha256(token)].sort());
  });

  test("passes the store's errors on", async () => {
    const { store, accounts } = setup();
    store.fail = new Error("database down");
    await assert.rejects(accounts.forToken("token"), /database down/);
    await assert.rejects(accounts.verify("asuna", "password1"), /database down/);
  });
});
