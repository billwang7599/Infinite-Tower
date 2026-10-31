import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Body, Enemy, FIXED_DT, Health, IDLE_INPUT, type PlayerInputData } from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { fightWith, FULL } from "../../fixtures/fight.js";

before(() => initPhysics());

describe("the Goblin Warlock", () => {
  const WARLOCK = ENEMIES["goblin-warlock"].def;

  function chaser(fight: Fight, swings: boolean): PlayerInputData {
    const at = fight.world.require(fight.players[0]!, Body).pos, it = fight.world.require(fight.enemies[0]!, Body).pos;
    const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
    const aimX = dx / dist, aimZ = dz / dist, close = dist < 1.4;
    const attack = swings && close && fight.steps % 2 === 0 ? "light" : null;
    return { ...IDLE_INPUT, moveX: close ? 0 : aimX, moveZ: close ? 0 : aimZ, aimX, aimZ, attack };
  }

  test("left alone, it keeps its distance and its Bolts find you", () => {
    const fight = fightWith(WARLOCK, 1);
    let closest = Infinity;
    for (let i = 0; i < 20 / FIXED_DT; i++) {
      fight.step([IDLE_INPUT]);
      const a = fight.world.require(fight.players[0]!, Body).pos, b = fight.world.require(fight.enemies[0]!, Body).pos;
      closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
    }
    const hp = fight.world.require(fight.players[0]!, Health).hp;
    assert.ok(closest > WARLOCK.keepAway!.nearM, `came within ${closest} m`);
    assert.ok(hp < FULL.hp - 20, `${hp} HP left`);
  });

  test("a player who runs it down beats it, whatever its seed", () => {
    for (const seed of [1, 2, 3, 1234, 99999]) {
      const fight = fightWith(WARLOCK, seed);
      while (fight.outcome.state === "fighting" && fight.steps < 60 / FIXED_DT) fight.step([chaser(fight, true)]);
      const hp = fight.world.require(fight.players[0]!, Health).hp;
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
    }
  });

  test("standing on it gets you poked by its staff, for a little", () => {
    const fight = fightWith(WARLOCK, 1);
    const pokes: number[] = [];
    for (let i = 0; i < 15 / FIXED_DT; i++) {
      fight.step([chaser(fight, false)]);
      for (const ev of fight.events) {
        if (ev.type === "hit" && ev.by === fight.enemies[0] && !ev.weapon
          && fight.world.require(fight.enemies[0]!, Enemy).state === "lunge") pokes.push(ev.damage);
      }
    }
    assert.ok(pokes.length > 0);
    for (const damage of pokes) assert.equal(damage, WARLOCK.attacks.lunge!.damage);
  });

  test("drops only its essence, even on the lowest roll", () => {
    assert.deepEqual(rollDrops("goblin-warlock", () => 0), { "goblin-warlock-essence": 1 });
  });
});
