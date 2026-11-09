import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BLESSINGS, Health, STATUS_DEFS, Statuses, timeLeft, type Vec3 } from "@infinite-tower/shared";
import { Fight, initPhysics, type PlayerSetup } from "@infinite-tower/shared/fight";
import { ARENA, enemy, input, player, run, STATUE, swingTime } from "./fixtures.js";

await initPhysics();

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });

function swingAtStatue(over: Partial<PlayerSetup> = {}): Fight {
  const fight = new Fight({ arena: ARENA, players: [player(at(0, 0), over)], enemies: [enemy(STATUE, at(0, 1.4))] });
  fight.step([input({ attack: "light" })]);
  run(fight, swingTime());
  return fight;
}

describe("blessings in a fight", () => {
  test("each is a permanent status from the start, its mods working like any other's", () => {
    const blessed = swingAtStatue({ blessings: ["kaelith"] }), plain = swingAtStatue();
    assert.equal(timeLeft(blessed.world.require(blessed.players[0]!, Statuses).on, BLESSINGS.kaelith.status), Infinity);
    const dealt = (fight: Fight) => STATUE.maxHp - fight.world.require(fight.enemies[0]!, Health).hp;
    assert.ok(dealt(plain) > 0);
    const factor = STATUS_DEFS[BLESSINGS.kaelith.status].mods.damageDealtFactor;
    assert.ok(Math.abs(dealt(blessed) - dealt(plain) * factor) < 1e-6);
  });
});
