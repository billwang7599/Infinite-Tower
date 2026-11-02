import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Body, Enemy, FIXED_DT, Health, IDLE_INPUT, PLAYER, type PlayerInputData } from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { SHOPS } from "../../../src/core/content/shops.js";
import { LEVELS } from "../../../src/core/world/index.js";
import { fightWith, FULL } from "../../fixtures/fight.js";

before(() => initPhysics());

const LURKER = ENEMIES["bog-lurker"].def;
const SLAM = LURKER.attacks.slam!, SWEEP = SLAM.sweep;
const REACT_TIME = 0.15;

function sizeUp(fight: Fight) {
  const at = fight.world.require(fight.players[0]!, Body).pos, it = fight.world.require(fight.enemies[0]!, Body).pos;
  const lurker = fight.world.require(fight.enemies[0]!, Enemy);
  const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimed: PlayerInputData = { ...IDLE_INPUT, aimX: dx / dist, aimZ: dz / dist, locked: 0 };
  return { lurker, dist, aimed };
}

const comingDown = (fight: Fight) => {
  const { lurker } = sizeUp(fight);
  return (lurker.state === "slamWindup" && lurker.stateTime > SLAM.windup - REACT_TIME)
    || (lurker.state === "sweepWindup" && lurker.stateTime > SWEEP.windup - REACT_TIME);
};
const rising = (fight: Fight) => ["slamWindup", "sweepWindup", "slam", "sweep"].includes(sizeUp(fight).lurker.state);

function cutAt(fight: Fight): PlayerInputData {
  const { dist, aimed } = sizeUp(fight);
  const far = dist > 2.2;
  return { ...aimed, moveX: far ? aimed.aimX : 0, moveZ: far ? aimed.aimZ : 0,
    attack: fight.steps % 2 === 0 ? "light" : null };
}

function dodger(fight: Fight): PlayerInputData {
  const { aimed } = sizeUp(fight);
  if (comingDown(fight)) return { ...aimed, moveX: -aimed.aimX, moveZ: -aimed.aimZ, dodge: true };
  return rising(fight) ? aimed : cutAt(fight);
}

function blocker(fight: Fight): PlayerInputData {
  const { aimed } = sizeUp(fight);
  return rising(fight) ? { ...aimed, block: true } : cutAt(fight);
}

function masher(fight: Fight): PlayerInputData {
  const { aimed } = sizeUp(fight);
  return { ...aimed, moveX: aimed.aimX, moveZ: aimed.aimZ, attack: fight.steps % 2 === 0 ? "light" : null };
}

const play = (next: (fight: Fight) => PlayerInputData) => {
  const fight = fightWith(LURKER, 1);
  while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([next(fight)]);
  return { fight, hp: fight.world.require(fight.players[0]!, Health).hp, seconds: fight.steps * FIXED_DT };
};

describe("the bog lurker", () => {
  test("is slower and tankier than the boar, and hits harder", () => {
    const boar = ENEMIES["wild-boar"].def;
    assert.ok(LURKER.maxHp > boar.maxHp && LURKER.poise > boar.poise);
    assert.ok(LURKER.walkSpeed < boar.walkSpeed / 2);
    assert.ok(SLAM.damage > boar.attacks.lunge!.damage * 2);
  });

  test("its slam costs a blocker more stamina than a dodge does", () => {
    assert.ok(SLAM.damage > PLAYER.dodge.cost * 1.5);
  });

  test("a player who dodges its slams and sweeps and cuts back beats it", () => {
    const { fight, hp, seconds } = play(dodger);
    assert.equal(fight.outcome.state, "won", `${hp} HP left after ${seconds} s`);
    assert.ok(hp > FULL.hp / 2, `${hp} HP left`);
  });

  test("one who blocks instead wins too, but far slower: each blocked slam pushes them out of reach", () => {
    const dodged = play(dodger), blocked = play(blocker);
    assert.equal(blocked.fight.outcome.state, "won");
    assert.ok(blocked.seconds > dodged.seconds * 1.3, `${blocked.seconds} s against ${dodged.seconds} s`);
  });

  test("one who only runs at it swinging loses", () => {
    assert.equal(play(masher).fight.outcome.state, "lost");
  });

  test("drops its essence always, and scales on a low roll", () => {
    assert.deepEqual(rollDrops("bog-lurker", () => 0.999), { "bog-lurker-essence": 1 });
    assert.ok((rollDrops("bog-lurker", () => 0)["lurker-scale"] ?? 0) >= 1);
  });

  test("the forge buys its scales", () => {
    assert.ok(SHOPS.smith.buys.includes("lurker-scale"));
  });

  test("lurks in the Mistwood", () => {
    assert.ok(LEVELS["mistwood"]!.spawns.some((s) => s.enemy === "bog-lurker"));
  });
});
