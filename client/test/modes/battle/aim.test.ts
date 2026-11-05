import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  addItem, BASE_STATS, Body, BOW, copyInput, drawTime, emptyBag, emptyEquipment, IDLE_INPUT, maxHpOf, newCore,
  packFor, Player, Projectile, quantizeInput, staminaMaxOf, toSteps, WEAPONS, World, type EnemyDef, type PlayerAction,
  type PlayerData, type Vec2, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import type { Polled } from "../../../src/core/actions.js";
import {
  CROSSHAIR_MIN_M, crosshairAim, freeCamera, playerAim, type Aimed,
} from "../../../src/modes/battle/aim.js";
import { readPlayerInput } from "../../../src/modes/battle/input.js";

const polled = (over: Partial<Polled>): Polled =>
  ({
    held: new Set(), pressed: [], flicks: [], move: { x: 0, z: 0 }, turn: 0, look: 0, dragging: false, zoom: 0, ...over,
  });

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const way = (x: number, z: number): Vec2 => ({ x: x / Math.hypot(x, z), z: z / Math.hypot(x, z) });
const nearWay = (got: Vec2 | null, want: Vec2) =>
  assert.ok(got && near(got.x, want.x) && near(got.z, want.z), `${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
const nearSpot = (got: Vec3, want: Vec3) =>
  assert.ok(near(got.x, want.x) && near(got.y, want.y) && near(got.z, want.z), `${JSON.stringify(got)}`);

const me: Vec3 = { x: 0, y: 0.9, z: 0 };
const foeAt = (x: number, z: number, heightM = 1.8, e = 1): Aimed => ({
  e,
  body: { pos: { x, y: heightM / 2, z }, vel: { x: 0, y: 0, z: 0 }, centerHeight: heightM / 2, collider: 0 },
  fighter: { team: "enemy", side: -1, radius: 0.4, heightM },
});
// Over the left shoulder, looking parallel to the player's way: the centre's line passes 1 m left of the player.
const eye = { x: -1, y: 3, z: -4 }, at = { x: -1, y: 2, z: 0 };

describe("aiming where the crosshair is (the screen's centre)", () => {
  test("aims at the floor the crosshair shows, not parallel to the camera", () => {
    nearWay(crosshairAim(eye, at, me, [], 20), way(-1, 8));
  });

  test("aims at the foe under the crosshair, where the line first meets it", () => {
    nearWay(crosshairAim(eye, at, me, [foeAt(-1, 6)], 20), way(-1, 6 - 0.4));
  });

  test("looking over the floor, aims at the arena's wall", () => {
    const level = { x: -1, y: 3, z: 0 };
    nearWay(crosshairAim(eye, level, me, [], 10), way(-1, Math.sqrt(100 - 1)));
  });

  test("a foe between the camera and the player is looked past", () => {
    nearWay(crosshairAim(eye, at, me, [foeAt(-1, -2, 3)], 20), way(-1, 8));
  });

  test("its spot is where the centre line meets the floor, the foe or the wall, up or down", () => {
    nearSpot(crosshairAim(eye, at, me, [], 20)!.at, { x: -1, y: 0, z: 8 });
    nearSpot(crosshairAim(eye, at, me, [foeAt(-1, 6)], 20)!.at, { x: -1, y: 0.6, z: 5.6 });
    const up = { x: -1, y: 3.5, z: 0 }, wallZ = Math.sqrt(100 - 1);
    nearSpot(crosshairAim(eye, up, me, [], 10)!.at, { x: -1, y: 3 + (wallZ + 4) / 8, z: wallZ });
  });

  test("none when what it shows is beside or behind the player", () => {
    const down = { x: 0, y: 6, z: -CROSSHAIR_MIN_M }, feet = { x: 0, y: 0, z: CROSSHAIR_MIN_M / 2 };
    assert.equal(crosshairAim(down, feet, me, [], 20), null);
  });
});

describe("an arrow loosed at the crosshair", () => {
  before(() => initPhysics());
  const FULL_STEPS = toSteps(drawTime(BOW, WEAPONS["training-bow"], BASE_STATS.strength, "fullTime"));
  const STATUE: EnemyDef = {
    id: "wild-boar", name: "Statue", maxHp: 100, stats: BASE_STATS, radius: 0.85, walkSpeed: 0, turnRate: 0,
    poise: 1000, poiseRegen: 0, staggerTime: 1, attacks: {},
  };

  function archer(spot: Vec3, wallM: number) {
    const fight = new Fight({
      arena: { id: "test", radius: wallM, look: "forest-clearing" },
      players: [{
        at: { x: 0, y: 0.05, z: 0 }, vitals: { hp: maxHpOf(BASE_STATS), stamina: staminaMaxOf(BASE_STATS) },
        stats: BASE_STATS, core: newCore(), burden: "light", book: [],
        gear: {
          bag: emptyBag(), pack: packFor(null), quiver: addItem(packFor("training-quiver"), BOW.ammo, 5).bag,
          equipment: { ...emptyEquipment(), rightHand: "training-bow", hip: "training-quiver" },
        },
      }],
      enemies: [{ def: STATUE, at: { x: 0, y: 0.05, z: 2 - wallM }, yaw: 0 }],
    });
    for (let s = 0; s < 10; s++) fight.step([copyInput(IDLE_INPUT)]);
    const me = { ...fight.world.require(fight.players[0]!, Body).pos };
    const view = { yaw: 0, pitch: 0, fovRad: 1, eye: { x: me.x - 0.8, y: me.y + 1.5, z: me.z - 4 }, at: spot };
    const aiming = copyInput(IDLE_INPUT);
    readPlayerInput(polled({}), 0, "tb", aiming, playerAim({ lock: null, freeCamera: "aim", view }, [], me, wallM).aim);
    const aimed = quantizeInput(aiming);
    let s = 0;
    const step = () => {
      s++;
      fight.step([{ ...aimed, attack: s === 1 ? "light" : null, attackHeld: s <= FULL_STEPS }]);
      return [...fight.world.query(Projectile)].map(([, arrow]) => arrow)[0];
    };
    return { fight, me: fight.players[0]!, step };
  }

  function stuckAt(spot: Vec3, wallM: number): Vec3 {
    const { step } = archer(spot, wallM);
    for (let s = 1; s < FULL_STEPS + 240; s++) {
      const arrow = step();
      if (arrow?.stuck) return arrow.pos;
    }
    throw new Error("the arrow never landed");
  }

  const under = (spot: Vec3, wallM: number): number => {
    const got = stuckAt(spot, wallM);
    assert.ok(Math.hypot(got.x - spot.x, got.z - spot.z) < 0.01, `straight under it: ${JSON.stringify(got)}`);
    return spot.y - got.y;
  };

  test("on the wall, it sticks straight under the spot, a little low near and far lower 25 m off", () => {
    const near = under({ x: 1, y: 2.5, z: Math.sqrt(63) }, 8), far = under({ x: -2, y: 4, z: Math.sqrt(621) }, 25);
    assert.ok(near > 0 && far > 4 * near, `${near} m low near, ${far} m 25 m off`);
  });

  test("the camera stays the aim's while it flies, past the loose's recovery, and is the lock's once it lands", () => {
    const { fight, me, step } = archer({ x: 0, y: 6, z: Math.sqrt(899) }, 30);
    let afterLoose = 0;
    for (let s = 1; s < FULL_STEPS + 240; s++) {
      const arrow = step(), { action } = fight.world.require(me, Player);
      if (arrow?.stuck) {
        assert.ok(afterLoose > 0, "it flew on past the loose");
        assert.equal(freeCamera(polled({}), fight.world, me), null);
        return;
      }
      if (!arrow || action === "loose") continue;
      afterLoose++;
      assert.equal(freeCamera(polled({}), fight.world, me), "aim", `${action}, ${afterLoose} steps after the loose`);
    }
    throw new Error("the arrow never landed");
  });

  test("on the floor, it sticks in the floor short of the spot", () => {
    for (const [spot, wallM] of [[{ x: 0.5, y: 0, z: 6 }, 8], [{ x: 0, y: 0, z: 25 }, 30]] as const) {
      const got = stuckAt(spot, wallM);
      assert.ok(Math.abs(got.y) < 1e-9 && got.z < spot.z && got.x >= 0 && got.x <= spot.x, JSON.stringify(got));
    }
  });
});

describe("freeCamera", () => {
  const free = (over: Partial<Polled>, action: PlayerAction = "none") => {
    const world = new World(), me = world.spawn();
    world.add(me, Player, { action } as PlayerData);
    return freeCamera(polled(over), world, me);
  };

  test("a bow drawn or just loosed, a skill chanted, cast or streamed: the camera aims", () => {
    for (const action of ["draw", "loose", "chant", "cast", "beam"] as const) assert.equal(free({}, action), "aim");
    assert.equal(free({ dragging: true }, "cast"), "aim");
  });

  test("a right drag or a held arrow pans it; otherwise it's the lock's", () => {
    assert.equal(free({ dragging: true }), "pan");
    assert.equal(free({ turn: -1 }), "pan");
    assert.equal(free({ look: 1 }), "pan");
    assert.equal(free({}), null);
    assert.equal(free({}, "attack"), null);
  });
});

describe("the player's aim", () => {
  const view = { yaw: 0.3, pitch: 0.2, fovRad: 1, eye, at };
  const target = foeAt(3, 0, 1.8, 7);

  test("locked on (the camera the lock's): at the target, level, the fight told; walking toward it", () => {
    const got = playerAim({ lock: 7, freeCamera: null, view }, [target], me, 20);
    assert.ok(near(got.walkYaw, Math.PI / 2), `${got.walkYaw}`);
    nearWay(got.aim, way(1, 0));
    nearSpot(got.aim.at, { x: Math.sqrt(400 - me.z * me.z), y: me.y, z: me.z });
    assert.equal(got.locked, 7);
  });

  test("aiming or panned: the crosshair's way and spot, the lock kept from the fight; walking by the camera", () => {
    for (const freed of ["aim", "pan"] as const) {
      const got = playerAim({ lock: 7, freeCamera: freed, view }, [target], me, 20);
      assert.equal(got.walkYaw, view.yaw, freed);
      assert.deepEqual(got.aim, crosshairAim(eye, at, me, [target], 20), freed);
      assert.equal(got.locked, null, freed);
    }
  });

  test("with no target, the crosshair; where it shows nothing ahead, the camera's way, level to the wall", () => {
    const unlocked = playerAim({ lock: null, freeCamera: null, view }, [], me, 20);
    assert.deepEqual(unlocked.aim, crosshairAim(eye, at, me, [], 20));
    const down = { ...view, eye: { x: 0, y: 6, z: -CROSSHAIR_MIN_M }, at: { x: 0, y: 0, z: CROSSHAIR_MIN_M / 2 } };
    const got = playerAim({ lock: null, freeCamera: "aim", view: down }, [], me, 20);
    nearWay(got.aim, { x: Math.sin(view.yaw), z: Math.cos(view.yaw) });
    nearSpot(got.aim.at, { x: 20 * Math.sin(view.yaw), y: me.y, z: 20 * Math.cos(view.yaw) });
  });
});
