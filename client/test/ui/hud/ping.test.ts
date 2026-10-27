import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { pingReadout } from "../../../src/ui/hud/Ping.js";

describe("pingReadout", () => {
  test("a dash before the first reply, then whole ms", () => {
    assert.equal(pingReadout(null).text, "—");
    assert.equal(pingReadout(42).text, "42 ms");
  });

  test("green under 100 ms, amber under 200, red from there", () => {
    const color = (ms: number) => pingReadout(ms).color;
    assert.deepEqual([0, 99, 100, 199, 200, 5000].map(color), [
      "text-ping-good", "text-ping-good", "text-ping-fair", "text-ping-fair", "text-ping-poor", "text-ping-poor",
    ]);
  });
});
