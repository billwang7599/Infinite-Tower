import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Body, Enemy, FIXED_DT, Health, IDLE_INPUT, type PlayerInputData } from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { SHOPS } from "../../../src/core/content/shops.js";
import { getRegion } from "../../../src/core/world/index.js";
import { fightWith, FULL } from "../../fixtures/fight.js";

before(() => initPhysics());

const WOLF = ENEMIES["grey-wolf"].def;
const POUNCE = WOLF.attacks.pounce!;
const SEEDS = [1, 2, 3, 1234, 99999];

function sizeUp(fight: Fight) {
  const at = fight.world.require(fight.players[0]!, Body).pos, it = fight.world.require(fight.enemies[0]!, Body).pos;
  const wolf = fight.world.require(fight.enemies[0]!, Enemy);
  const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimed: PlayerInputData = { ...IDLE_INPUT, aimX: dx / dist, aimZ: dz / dist, locked: 0 };
  return { wolf, dist, aimed };
}

const aside = (aimed: PlayerInputData) => ({ moveX: aimed.aimZ, moveZ: -aimed.aimX });

function punish(fight: Fight): PlayerInputData {
  const { wolf, dist, aimed } = sizeUp(fight);
  if (wolf.state !== "pounceRecover" && wolf.state !== "staggered") return aimed;
  const far = dist > 1.8;
  return { ...aimed, moveX: far ? aimed.aimX : 0, moveZ: far ? aimed.aimZ : 0,
    attack: !far && fight.steps % 2 === 0 ? "light" : null };
}

function sidestepper(fight: Fight): PlayerInputData {
  const { wolf, aimed } = sizeUp(fight);
  const locked = wolf.state === "pounceWindup" && wolf.stateTime > POUNCE.windup - POUNCE.lockAt;
  return locked || wolf.state === "pounce" ? { ...aimed, ...aside(aimed) } : punish(fight);
}

// Aside and back, toward where its leap lands, so the cut back is in time.
const behindAside = (aimed: PlayerInputData) =>
  ({ moveX: (aimed.aimZ - aimed.aimX) * Math.SQRT1_2, moveZ: (-aimed.aimX - aimed.aimZ) * Math.SQRT1_2 });

function dodger(fight: Fight): PlayerInputData {
  const { wolf, dist, aimed } = sizeUp(fight);
  return wolf.state === "pounce" && dist < 3 ? { ...aimed, ...behindAside(aimed), dodge: true } : punish(fight);
}

function blocker(fight: Fight): PlayerInputData {
  const { wolf, aimed } = sizeUp(fight);
  if (wolf.state === "pounceWindup" || wolf.state === "pounce") return { ...aimed, block: true };
  return punish(fight);
}

function masher(fight: Fight): PlayerInputData {
  const { aimed } = sizeUp(fight);
  return { ...aimed, moveX: aimed.aimX, moveZ: aimed.aimZ, attack: fight.steps % 2 === 0 ? "light" : null };
}

const play = (seed: number, next: (fight: Fight) => PlayerInputData) => {
  const fight = fightWith(WOLF, seed);
  while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([next(fight)]);
  return { fight, hp: fight.world.require(fight.players[0]!, Health).hp, seconds: fight.steps * FIXED_DT };
};

describe("the grey wolf", () => {
  test("is quicker and frailer than the boar", () => {
    const boar = ENEMIES["wild-boar"].def;
    assert.ok(WOLF.maxHp < boar.maxHp / 2);
    assert.ok(WOLF.walkSpeed > boar.walkSpeed);
  });

  test("a player who steps out of its leap, or dodges it, and cuts back beats it, whatever its seed", () => {
    for (const seed of SEEDS) for (const bot of [sidestepper, dodger]) {
      const { fight, hp, seconds } = play(seed, bot);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${seconds} s`);
      assert.ok(hp > FULL.hp / 2, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("so does one who blocks its leap and cuts back", () => {
    for (const seed of SEEDS) {
      const { fight, hp, seconds } = play(seed, blocker);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${seconds} s`);
      assert.ok(hp > FULL.hp / 2, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("a player who only runs at it swinging comes off far worse, and mostly loses", () => {
    const results = SEEDS.map((seed) => ({ mashed: play(seed, masher), read: play(seed, sidestepper) }));
    for (const { mashed, read } of results) assert.ok(mashed.hp < read.hp - FULL.hp / 4, `${mashed.hp} vs ${read.hp}`);
    const lost = results.filter(({ mashed }) => mashed.fight.outcome.state === "lost").length;
    assert.ok(lost > SEEDS.length / 2, `lost ${lost} of ${SEEDS.length}`);
  });

  test("drops its essence always, and a pelt and a fang on a low roll", () => {
    assert.deepEqual(rollDrops("grey-wolf", () => 0.999, () => false), { "grey-wolf-essence": 1 });
    const loot = rollDrops("grey-wolf", () => 0, () => false);
    assert.ok((loot["wolf-pelt"] ?? 0) >= 1 && (loot["wolf-fang"] ?? 0) >= 1);
  });

  test("the forge buys its pelt and fang", () => {
    for (const item of ["wolf-pelt", "wolf-fang"] as const) assert.ok(SHOPS.smith.buys.includes(item), item);
  });

  test("roams the Grass Field and the Mistwood", () => {
    const count = (region: string, enemy: string) => getRegion(region).spawns.filter((s) => s.enemy === enemy).length;
    assert.ok(count("grass-field", "grey-wolf") >= 1);
    assert.ok(count("mistwood", "grey-wolf") >= 1);
  });
});
