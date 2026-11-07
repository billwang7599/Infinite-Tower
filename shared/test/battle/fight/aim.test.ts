import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Body, Fighter, Health, type Vec3 } from "@infinite-tower/shared";
import { aimOf, Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, enemy, input, player, STATUE } from "./fixtures.js";

before(() => initPhysics());

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

function aimingAt(foes: Vec3[], over: Parameters<typeof input>[0]) {
  const fight = new Fight({ arena: ARENA, players: [player(at(0, -4))], enemies: foes.map((f) => enemy(STATUE, f)) });
  fight.step([input(over)]);
  return { fight, me: fight.players[0]! };
}

const middleOf = (fight: Fight, e: number) => {
  const { pos, centerHeight } = fight.world.require(e, Body);
  return { ...pos, y: pos.y - centerHeight + fight.world.require(e, Fighter).heightM / 2 };
};

describe("where a fighter aims", () => {
  test("locked on, at the target's middle: the flat way to it, the pitch to it, whatever the input aims", () => {
    const { fight, me } = aimingAt([at(3, 0)], { locked: 0, aimX: -1, aimZ: 0, aimPitchRad: 0.6 });
    const foe = fight.enemies[0]!, aim = aimOf(fight.world, me);
    const from = fight.world.require(me, Body).pos, to = middleOf(fight, foe);
    const flatM = Math.hypot(to.x - from.x, to.z - from.z);
    assert.equal(aim.target, foe);
    assert.deepEqual(aim.at, to);
    assert.ok(near(aim.dir.x, (to.x - from.x) / flatM) && near(aim.dir.z, (to.z - from.z) / flatM));
    assert.ok(near(aim.pitchRad, Math.atan2(to.y - from.y, flatM)), `${aim.pitchRad}`);
  });

  test("unlocked, the input's way and pitch, at nothing", () => {
    const way = { aimX: Math.sin(0.4), aimZ: Math.cos(0.4), aimPitchRad: -0.2 };
    const { fight, me } = aimingAt([at(3, 0)], way);
    assert.deepEqual(aimOf(fight.world, me), {
      dir: { x: way.aimX, z: way.aimZ }, pitchRad: way.aimPitchRad, target: null, at: null,
    });
  });

  test("a locked target that's down falls back to the input's aim", () => {
    const way = { aimX: 0, aimZ: 1, aimPitchRad: 0.3 };
    const { fight, me } = aimingAt([at(3, 0), at(0, 4)], { ...way, locked: 0 });
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    assert.deepEqual(aimOf(fight.world, me), { dir: { x: 0, z: 1 }, pitchRad: 0.3, target: null, at: null });
  });

  test("from a given point (a later segment's), the way to the target is from there", () => {
    const { fight, me } = aimingAt([at(3, 0)], { locked: 0 });
    const to = middleOf(fight, fight.enemies[0]!), from = { x: 3, y: to.y, z: -5 };
    const aim = aimOf(fight.world, me, from);
    assert.ok(near(aim.dir.x, 0) && near(aim.dir.z, 1) && near(aim.pitchRad, 0), JSON.stringify(aim));
  });
});
