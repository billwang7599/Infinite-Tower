import assert from "node:assert/strict";
import { test } from "node:test";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, player } from "../fixtures.js";

// One process per test file, so the physics isn't loaded yet when this starts.
test("a fight can't be made before the physics is loaded; once it is, it can", async () => {
  const setup = { arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })], enemies: [] };
  assert.throws(() => new Fight(setup), /initPhysics/);
  const loading = initPhysics();
  assert.equal(initPhysics(), loading, "a second call waits for the same load");
  await loading;
  new Fight(setup).dispose();
});
