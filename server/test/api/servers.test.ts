import assert from "node:assert/strict";
import { test } from "node:test";
import { TEST_SERVER, testApp } from "./app.js";

test("GET /api/servers lists the game servers, never cached", async (t) => {
  const { app } = await testApp(t);
  const res = await app.inject({ method: "GET", url: "/api/servers" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), [TEST_SERVER]);
  assert.equal(res.headers["cache-control"], "no-store");
});
