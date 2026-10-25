import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_JS, INDEX_HTML, testApp } from "./app.js";

test("the page is served from client/dist and rechecked on every load", async (t) => {
  const { app } = await testApp(t);
  for (const url of ["/", "/index.html"]) {
    const res = await app.inject(url);
    assert.equal(res.statusCode, 200, url);
    assert.equal(res.body, INDEX_HTML);
    assert.equal(res.headers["cache-control"], "no-cache");
  }
});

test("files under assets/ are kept by the browser for good", async (t) => {
  const { app } = await testApp(t);
  const res = await app.inject("/assets/app.js");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, APP_JS);
  assert.equal(res.headers["cache-control"], "public, max-age=31536000, immutable");
});
