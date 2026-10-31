import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ATTACK_KINDS, ATTACKS, DEFLECT_STEPS, emptyBag, GUARD_SIDES, newCore, starterEquipment, SWING_DIRS, WAYS,
  type GuardSide,
  type PlayerAction, type PlayerData, type SwingData, type SwingDir,
} from "@infinite-tower/shared";
import { facingSeen, playerBlade, spritePose, TURN_MARGIN_RAD } from "../../../src/visuals/battle/pose.js";
import {
  DEFLECT_BLADE, GRAB_BLADE, MOTIONS, POSTURE_GUARD_BLADE, REELING_BLADE, REST_BLADE,
} from "../../../src/visuals/battle/weapons.js";
import { BATTLE_FRAMES } from "../../../src/visuals/characters.js";
import { swingAt, swingSteps, waySwingAt } from "../../fixtures/swings.js";

function playerDoing(
  action: PlayerAction, t: number, guard: GuardSide | null = null, way: SwingDir | null = null,
): PlayerData {
  return {
    grounded: true, airTime: 0, jumpHeld: false, attackHeld: null, dodgeHeld: false, guardBreakHeld: false,
    blockHeld: false, kickHeld: false, kickBuffer: 0, tapParryLeft: 0, sinceBlockPress: 1, way, perilousHeld: null,
    perilousBuffer: 0, perilousQueued: null, sinceGuardPressSteps: 99, sinceGuardReleaseSteps: 99,
    deflectWindowSteps: DEFLECT_STEPS.window,
    jumpBuffer: 0, attackBuffer: 0, dodgeBuffer: 0, guardBreakBuffer: 0, castBuffer: 0, queued: null, castQueued: null,
    writeHeld: false, gearHeld: false, useHeld: false, wordsHeld: false, brokenOff: false, writing: null, using: null,
    book: [],
    burden: "light", gear: { bag: emptyBag(), equipment: starterEquipment() }, core: newCore(),
    action, actionTime: t, actionDir: { x: 0, z: 1 }, guard, invulnerable: false, leftArena: false,
  };
}
const ATTACKING = playerDoing("attack", 0);
const holding = (swing: SwingData | null) => ({ swing });
const SWING_POSES = {
  light: { left: "swing-lr", top: "swing-tb", right: "swing-rl" },
  heavy: { left: "swing-tlbr", top: "swing-tb", right: "swing-trbl" },
} as const;

describe("the player's sprite", () => {
  test("every attack plays its pose's frames in turn: wind-up, strike as its blade goes live, follow-through", () => {
    for (const attack of ATTACK_KINDS) {
      for (const side of GUARD_SIDES) {
        const steps = swingSteps(attack, side), what = `${attack} from ${side}`;
        const poses = steps.map((swing) => spritePose(ATTACKING, holding(swing), true, 1));
        const { driveAt, liveAt } = steps[0]!;
        for (const pose of poses) {
          assert.equal(pose.pose, SWING_POSES[attack][side], what);
          assert.ok(pose.scaleX > 0, `${what} isn't mirrored`);
        }
        assert.deepEqual(poses.map((p) => p.frame), poses.map((p) => p.frame).sort(), `${what}: in order`);
        assert.equal(poses[driveAt]!.frame, 0, `${what}: wound up as the drive starts`);
        assert.equal(poses[liveAt]!.frame, 1, `${what}: striking as it goes live`);
        assert.ok(poses.some((pose) => pose.frame === 2), `${what} follows through`);
      }
    }
  });

  test("on guard, the blade is held on its side; unlocked, at rest", () => {
    for (const side of GUARD_SIDES) {
      assert.deepEqual(spritePose(playerDoing("none", 1, side), holding(null), true, 1).pose, `guard-${side}`);
    }
    assert.equal(spritePose(playerDoing("none", 1), holding(null), true, 1).pose, "stand");
  });

  test("recoiling, knocked back for half of it, then stumbling; down when dead", () => {
    const pose = (action: PlayerAction, stagger = { left: 0, of: 0 }) => {
      const { pose, frame } = spritePose(playerDoing(action, 0.1), holding(null), true, 1, stagger);
      return [pose, frame];
    };
    const of = ATTACKS.light.recoilTime;
    assert.deepEqual(pose("recoil", { left: of * 0.6, of }), ["stagger", 0]);
    assert.deepEqual(pose("recoil", { left: of * 0.4, of }), ["stagger", 1]);
    assert.deepEqual(spritePose(playerDoing("none", 0.1), holding(null), false, 1).pose, "down");
    assert.deepEqual(spritePose(ATTACKING, holding(swingAt("light", "left", 3)), false, 1).pose, "down");
  });

  test("parried or guard broken, it staggers as when recoiling; held by a guard break, knocked back throughout", () => {
    const of = 0.6;
    for (const [left, frame] of [[of * 0.6, 0], [of * 0.4, 1]] as const) {
      const { pose, frame: shown } = spritePose(playerDoing("stagger", 0.1), holding(null), true, 1, { left, of });
      assert.deepEqual([pose, shown], ["stagger", frame]);
    }
    const held = spritePose(playerDoing("grabbed", 0.1, "left"), holding(null), true, 1);
    assert.deepEqual([held.pose, held.frame], ["stagger", 0]);
  });

  test("guard breaking, it reaches out to grab", () => {
    assert.equal(spritePose(playerDoing("grab", 0.1, "top"), holding(null), true, 1).pose, "grab");
  });

  test("the hybrid's swings take the drawn swing nearest their way; a stab the overhead one", () => {
    const pose = (way: (typeof WAYS)[number]) => spritePose(ATTACKING, holding(waySwingAt(way, 2)), true, 1).pose;
    assert.equal(pose("lr"), "swing-lr");
    assert.equal(pose("trbl"), "swing-trbl");
    assert.equal(pose("bt"), "swing-tb");
    assert.equal(pose("brtl"), "swing-rl");
    assert.equal(pose("stab"), "swing-tb");
  });

  test("the hybrid: aimed, held on the side the swing will come from; blocking, up top; kicking, reaching", () => {
    assert.equal(spritePose(playerDoing("none", 1, null, "lr"), holding(null), true, 1).pose, "guard-left");
    assert.equal(spritePose(playerDoing("none", 1, null, "brtl"), holding(null), true, 1).pose, "guard-right");
    assert.equal(spritePose(playerDoing("block", 1, null, "lr"), holding(null), true, 1).pose, "guard-top");
    assert.equal(spritePose(playerDoing("kick", 0.1, null, "lr"), holding(null), true, 1).pose, "grab");
  });

  test("every frame it picks is drawn", () => {
    const all = ATTACK_KINDS.flatMap((attack) => GUARD_SIDES.flatMap((side) => swingSteps(attack, side)))
      .map((swing) => spritePose(ATTACKING, holding(swing), true, 1));
    for (const guard of [...GUARD_SIDES, null]) {
      for (const action of ["recoil", "stagger", "grabbed", "grab", "none"] as const) {
        for (const left of [0, 0.2, 0.4, 0.8]) {
          all.push(spritePose(playerDoing(action, 0.1, guard), holding(null), true, 1, { left, of: 0.8 }));
        }
      }
    }
    all.push(spritePose(playerDoing("none", 0), holding(null), false, 1));
    for (const way of WAYS) {
      for (let step = 0; step < waySwingAt(way, 0).endAt; step++) {
        all.push(spritePose(ATTACKING, holding(waySwingAt(way, step)), true, 1));
      }
    }
    for (const action of ["block", "kick", "none"] as const) {
      for (const way of SWING_DIRS) all.push(spritePose(playerDoing(action, 0.1, null, way), holding(null), true, 1));
    }
    for (const { pose, frame } of all) assert.ok(frame >= 0 && frame < BATTLE_FRAMES[pose], `${pose} ${frame}`);
  });
});

describe("the player's blade", () => {
  const blade = (player: PlayerData, swing: SwingData | null = null, alive = true) =>
    playerBlade(player, holding(swing), alive, MOTIONS.sword);
  const guarding = (side: GuardSide | null) => blade(playerDoing("none", 1, side));

  test("on guard it's held out on the guard's side, unlocked at rest, eased there (after a feint or a parry too)", () => {
    assert.ok(guarding("left").blade.x < -0.5);
    assert.ok(guarding("right").blade.x > 0.5);
    assert.ok(guarding("top").blade.y > 0.7);
    assert.deepEqual(guarding(null).blade, REST_BLADE.blade);
    for (const side of [...GUARD_SIDES, null]) assert.equal(guarding(side).exact, false);
  });

  test("winding up, it's drawn back toward the side the cut comes from", () => {
    for (const attack of ATTACK_KINDS) {
      for (const side of GUARD_SIDES) {
        const steps = swingSteps(attack, side), what = `${attack} from ${side}`;
        const mid = blade(playerDoing("attack", 0.1, side), steps[steps[0]!.driveAt >> 1]!);
        assert.equal(mid.exact, false, what);
        assert.ok(mid.blade.z < guarding(side).blade.z, `${what}: drawn back`);
        if (side === "top") assert.ok(mid.blade.y > 0.5, `${what}: overhead`);
        else assert.equal(Math.sign(mid.blade.x), side === "left" ? -1 : 1, `${what}: on its side`);
      }
    }
  });

  test("a heavy is drawn back further than a light", () => {
    const wound = (attack: "light" | "heavy") => {
      const steps = swingSteps(attack, "top");
      return blade(playerDoing("attack", 0.1, "top"), steps[steps[0]!.driveAt - 1]!).blade;
    };
    assert.ok(wound("heavy").z < wound("light").z);
  });

  test("from the drive on it's exactly where its stroke is: straight ahead mid-cut, then through to the far side", () => {
    for (const side of ["left", "right"] as const) {
      const steps = swingSteps("light", side), { driveAt, liveAt, liveUntil, endAt } = steps[0]!;
      const player = playerDoing("attack", 0.1, side);
      assert.equal(blade(player, steps[driveAt]!).exact, true, side);
      assert.ok(blade(player, steps[(liveAt + liveUntil) >> 1]!).blade.z > 0.9, `${side}: ahead mid-cut`);
      const end = blade(player, steps[endAt - 1]!).blade;
      assert.ok(side === "left" ? end.x > 0.5 : end.x < -0.5, `${side}: on the far side`);
    }
  });

  test("the hybrid's aim holds it out on that side, as For Honor's guard would", () => {
    assert.deepEqual(blade(playerDoing("none", 1, null, "lr")).blade, guarding("left").blade);
    assert.deepEqual(blade(playerDoing("none", 1, null, "rl")).blade, guarding("right").blade);
    assert.deepEqual(blade(playerDoing("block", 1, null, "lr")).blade, guarding("top").blade);
  });

  test("a hybrid swing's blade sweeps its way; a stab points straight ahead", () => {
    const { liveAt, liveUntil, endAt } = waySwingAt("bt", 0);
    const rising = blade(playerDoing("attack", 0.1), waySwingAt("bt", endAt - 1)).blade;
    assert.ok(rising.y > 0.5, "a rising cut ends up high");
    const stab = blade(playerDoing("attack", 0.1), waySwingAt("stab", (liveAt + liveUntil) >> 1)).blade;
    assert.ok(stab.z > 0.95, "ahead");
  });

  test("Posture's guard holds it across the body; a press just made snaps it forward to deflect", () => {
    const posture = (player: PlayerData) => playerBlade(player, holding(null), true, MOTIONS.sword, true).blade;
    assert.deepEqual(posture(playerDoing("block", 1)), POSTURE_GUARD_BLADE);
    assert.notDeepEqual(POSTURE_GUARD_BLADE, guarding("top").blade);
    const pressed = { ...playerDoing("block", 0), sinceGuardPressSteps: 0 };
    assert.deepEqual(posture(pressed), DEFLECT_BLADE);
    assert.ok(DEFLECT_BLADE.z > POSTURE_GUARD_BLADE.z, "forward");
    assert.deepEqual(posture({ ...pressed, sinceGuardPressSteps: DEFLECT_STEPS.window + 1 }), POSTURE_GUARD_BLADE);
    assert.deepEqual(posture(playerDoing("none", 1)), REST_BLADE.blade, "idle, at rest");
    assert.deepEqual(blade(playerDoing("block", 1)).blade, guarding("top").blade, "the hybrid's block stays up top");
  });

  test("knocked back, parried or held it reels, as an enemy's does; guard breaking it's lowered; dead it lies flat", () => {
    for (const action of ["recoil", "stagger", "grabbed"] as const) {
      assert.deepEqual(blade(playerDoing(action, 0.1, "left"), swingAt("light", "left", 3)).blade, REELING_BLADE);
    }
    assert.deepEqual(blade(playerDoing("grab", 0.1, "top")).blade, GRAB_BLADE);
    assert.deepEqual(blade(playerDoing("kick", 0.1, null, "lr")).blade, GRAB_BLADE);
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
