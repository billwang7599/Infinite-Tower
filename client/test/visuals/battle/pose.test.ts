import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  emptyBag, IDLE_INPUT, newCore, SWING_DIRS, WAYS, type AttackKind, type PlayerAction, type PlayerData,
  type SwingData, type SwingDir,
} from "@infinite-tower/shared";
import { facingSeen, playerBlade, spritePose, TURN_MARGIN_RAD } from "../../../src/visuals/battle/pose.js";
import { MOTIONS, REELING_BLADE, REST_BLADE } from "../../../src/visuals/battle/weapons.js";
import { BATTLE_FRAMES } from "../../../src/visuals/characters.js";
import { swingAt, swingSteps, waySwingAt } from "../../fixtures/swings.js";
import { armed } from "../../fixtures/armed.js";

function playerDoing(action: PlayerAction, t: number, way: SwingDir | null = null): PlayerData {
  return {
    grounded: true, airTime: 0, last: IDLE_INPUT, perfectBlockLeft: 0, sinceBlockPress: 1, way, jumpBuffer: 0,
    attackBuffer: 0, dodgeBuffer: 0, castBuffer: 0, queued: null, castQueued: null, brokenOff: false, writing: null,
    using: null, book: [], burden: "light",
    gear: { bag: emptyBag(), equipment: armed() }, core: newCore(), action, actionTime: t,
    actionDir: { x: 0, z: 1 }, invulnerable: false, leftArena: false,
  };
}
const ATTACKING = playerDoing("attack", 0);
const holding = (swing: SwingData | null) => ({ swing });
const KINDS: readonly AttackKind[] = ["light", "heavy"];
const SIDES = { left: "lr", top: "tb", right: "rl" } as const;

describe("the player's sprite", () => {
  test("every swing plays its pose's frames in turn: wind-up, strike as its blade goes live, follow-through", () => {
    for (const attack of KINDS) {
      for (const way of Object.values(SIDES)) {
        const steps = swingSteps(attack, way), what = `${attack} ${way}`;
        const poses = steps.map((swing) => spritePose(ATTACKING, holding(swing), true, 1));
        const { driveAt, liveAt } = steps[0]!;
        for (const pose of poses) {
          assert.equal(pose.pose, `swing-${way}`, what);
          assert.ok(pose.scaleX > 0, `${what} isn't mirrored`);
        }
        assert.deepEqual(poses.map((p) => p.frame), poses.map((p) => p.frame).sort(), `${what}: in order`);
        assert.equal(poses[driveAt]!.frame, 0, `${what}: wound up as the drive starts`);
        assert.equal(poses[liveAt]!.frame, 1, `${what}: striking as it goes live`);
        assert.ok(poses.some((pose) => pose.frame === 2), `${what} follows through`);
      }
    }
  });

  test("staggered, knocked back for half of it, then stumbling; down when dead", () => {
    const of = 0.6;
    for (const [left, frame] of [[of * 0.6, 0], [of * 0.4, 1]] as const) {
      const { pose, frame: shown } = spritePose(playerDoing("stagger", 0.1), holding(null), true, 1, { left, of });
      assert.deepEqual([pose, shown], ["stagger", frame]);
    }
    assert.deepEqual(spritePose(playerDoing("none", 0.1), holding(null), false, 1).pose, "down");
    assert.deepEqual(spritePose(ATTACKING, holding(swingAt("light", "lr", 3)), false, 1).pose, "down");
  });

  test("swings take the drawn swing nearest their way; a stab the overhead one", () => {
    const pose = (way: (typeof WAYS)[number]) => spritePose(ATTACKING, holding(waySwingAt(way, 2)), true, 1).pose;
    assert.equal(pose("lr"), "swing-lr");
    assert.equal(pose("trbl"), "swing-trbl");
    assert.equal(pose("brtl"), "swing-rl");
    assert.equal(pose("stab"), "swing-tb");
  });

  test("aimed, held on the side the swing will come from; blocking, up top; unaimed, at rest", () => {
    assert.equal(spritePose(playerDoing("none", 1, "lr"), holding(null), true, 1).pose, "guard-left");
    assert.equal(spritePose(playerDoing("none", 1, "bltr"), holding(null), true, 1).pose, "guard-left");
    assert.equal(spritePose(playerDoing("none", 1, "brtl"), holding(null), true, 1).pose, "guard-right");
    assert.equal(spritePose(playerDoing("none", 1, "tb"), holding(null), true, 1).pose, "guard-top");
    assert.equal(spritePose(playerDoing("block", 1, "lr"), holding(null), true, 1).pose, "guard-top");
    assert.equal(spritePose(playerDoing("none", 1), holding(null), true, 1).pose, "stand");
  });

  test("every frame it picks is drawn", () => {
    const all = KINDS.flatMap((attack) => WAYS.flatMap((way) => swingSteps(attack, way)))
      .map((swing) => spritePose(ATTACKING, holding(swing), true, 1));
    for (const way of [...SWING_DIRS, null]) {
      for (const action of ["stagger", "block", "none"] as const) {
        for (const left of [0, 0.2, 0.4, 0.8]) {
          all.push(spritePose(playerDoing(action, 0.1, way), holding(null), true, 1, { left, of: 0.8 }));
        }
      }
    }
    all.push(spritePose(playerDoing("none", 0), holding(null), false, 1));
    for (const { pose, frame } of all) assert.ok(frame >= 0 && frame < BATTLE_FRAMES[pose], `${pose} ${frame}`);
  });
});

describe("the player's blade", () => {
  const blade = (player: PlayerData, swing: SwingData | null = null, alive = true) =>
    playerBlade(player, holding(swing), alive, MOTIONS.sword);
  const aimed = (way: SwingDir | null) => blade(playerDoing("none", 1, way));

  test("aimed, it's held out on the side the swing comes from, unaimed at rest, eased there", () => {
    assert.ok(aimed(SIDES.left).blade.x < -0.5);
    assert.ok(aimed(SIDES.right).blade.x > 0.5);
    assert.ok(aimed(SIDES.top).blade.y > 0.7);
    assert.deepEqual(aimed(null).blade, REST_BLADE.blade);
    for (const way of [...SWING_DIRS, null]) assert.equal(aimed(way).exact, false);
  });

  test("blocking, it's held up top", () => {
    assert.deepEqual(blade(playerDoing("block", 1, "lr")).blade, aimed(SIDES.top).blade);
  });

  test("winding up, it's drawn back toward the side the cut comes from", () => {
    for (const attack of KINDS) {
      for (const [side, way] of Object.entries(SIDES)) {
        const steps = swingSteps(attack, way), what = `${attack} from ${side}`;
        const mid = blade(playerDoing("attack", 0.1, way), steps[steps[0]!.driveAt >> 1]!);
        assert.equal(mid.exact, false, what);
        assert.ok(mid.blade.z < aimed(way).blade.z, `${what}: drawn back`);
        if (side === "top") assert.ok(mid.blade.y > 0.5, `${what}: overhead`);
        else assert.equal(Math.sign(mid.blade.x), side === "left" ? -1 : 1, `${what}: on its side`);
      }
    }
  });

  test("a heavy is drawn back further than a light", () => {
    const wound = (attack: AttackKind) => {
      const steps = swingSteps(attack, "tb");
      return blade(playerDoing("attack", 0.1, "tb"), steps[steps[0]!.driveAt - 1]!).blade;
    };
    assert.ok(wound("heavy").z < wound("light").z);
  });

  test("from the drive on it's exactly where its stroke is: straight ahead mid-cut, then through to the far side", () => {
    for (const side of ["left", "right"] as const) {
      const way = SIDES[side], steps = swingSteps("light", way), { driveAt, liveAt, liveUntil, endAt } = steps[0]!;
      const player = playerDoing("attack", 0.1, way);
      assert.equal(blade(player, steps[driveAt]!).exact, true, side);
      assert.ok(blade(player, steps[(liveAt + liveUntil) >> 1]!).blade.z > 0.9, `${side}: ahead mid-cut`);
      const end = blade(player, steps[endAt - 1]!).blade;
      assert.ok(side === "left" ? end.x > 0.5 : end.x < -0.5, `${side}: on the far side`);
    }
  });

  test("a swing's blade sweeps its way; a stab points straight ahead", () => {
    const { liveAt, liveUntil, endAt } = waySwingAt("bltr", 0);
    const rising = blade(playerDoing("attack", 0.1), waySwingAt("bltr", endAt - 1)).blade;
    assert.ok(rising.y > 0.5, "a rising cut ends up high");
    const stab = blade(playerDoing("attack", 0.1), waySwingAt("stab", (liveAt + liveUntil) >> 1)).blade;
    assert.ok(stab.z > 0.95, "ahead");
  });

  test("staggered it reels, as an enemy's does; dead it lies flat", () => {
    assert.deepEqual(blade(playerDoing("stagger", 0.1, "lr"), swingAt("light", "lr", 3)).blade, REELING_BLADE);
    assert.ok(Math.abs(blade(playerDoing("none", 0.1), null, false).blade.y) < 0.2);
  });
});

describe("the side of a player the camera sees", () => {
  const at = { x: 2, z: -1 };
  const seen = (yaw: number, offRad: number, was: "back" | "front") => {
    const eye = { x: at.x + 6 * Math.sin(yaw + offRad), y: 3, z: at.z + 6 * Math.cos(yaw + offRad) };
    return facingSeen(eye, at, { x: Math.sin(yaw), z: Math.cos(yaw) }, was);
  };
  const YAWS = [0, 1, 2.5, -2, Math.PI];

  test("their back with the camera behind them, their front with it ahead of them, whichever way they face", () => {
    for (const yaw of YAWS) {
      for (const was of ["back", "front"] as const) {
        assert.equal(seen(yaw, Math.PI, was), "back", `yaw ${yaw}, behind`);
        assert.equal(seen(yaw, 0.3, was), "front", `yaw ${yaw}, ahead`);
        assert.equal(seen(yaw, -1.2, was), "front", `yaw ${yaw}, ahead to the side`);
        assert.equal(seen(yaw, 2, was), "back", `yaw ${yaw}, behind to the side`);
      }
    }
  });

  test("side-on, it keeps the side it showed until the camera is past side-on by the margin", () => {
    for (const yaw of YAWS) {
      for (const side of [1, -1]) {
        const sideOn = side * Math.PI / 2, margin = side * TURN_MARGIN_RAD;
        for (const was of ["back", "front"] as const) {
          assert.equal(seen(yaw, sideOn, was), was, `yaw ${yaw}, side-on`);
          assert.equal(seen(yaw, sideOn - margin * 0.9, was), was, `yaw ${yaw}, just ahead`);
          assert.equal(seen(yaw, sideOn + margin * 0.9, was), was, `yaw ${yaw}, just behind`);
        }
        assert.equal(seen(yaw, sideOn - margin * 1.1, "back"), "front", `yaw ${yaw}, past side-on ahead`);
        assert.equal(seen(yaw, sideOn + margin * 1.1, "front"), "back", `yaw ${yaw}, past side-on behind`);
      }
    }
  });
});
