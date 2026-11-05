import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";
import { AVERAGE_STAT, BOW, drawTime, loosedSpeed, WEAPONS, type PlayerAction } from "@infinite-tower/shared";
import {
  AIM_HUD, aimHud, aimLayout, meterSpan, onScreen, ringLights, wedgeOf,
} from "../../../src/visuals/battle/overlay.js";
import { playerDoing } from "../../fixtures/players.js";
import { swingAt, waySwingAt } from "../../fixtures/swings.js";

describe("your own aim ring", () => {
  test("lights the wedge on the side the aimed swing comes from", () => {
    assert.equal(wedgeOf("rl"), 0);
    assert.equal(wedgeOf("trbl"), 1);
    assert.equal(wedgeOf("tb"), 2);
    assert.equal(wedgeOf("tlbr"), 3);
    assert.equal(wedgeOf("lr"), 4);
    assert.equal(wedgeOf("bltr"), 5);
    assert.equal(wedgeOf("brtl"), 7);
  });

  test("shows the aim with no swing going, not only on attack", () => {
    assert.deepEqual(ringLights("lr", null), { lit: 4, stab: false });
  });

  test("a stab shows the centre mark only while it winds up", () => {
    const { liveAt } = swingAt("light", "stab", 0);
    assert.equal(ringLights("tb", waySwingAt("stab", 0)).stab, true);
    assert.equal(ringLights("tb", waySwingAt("stab", liveAt)).stab, false);
    assert.equal(ringLights("tb", waySwingAt("lr", 0)).stab, false);
  });
});

describe("the aim HUD: the ring at the bottom centre, the crosshair at the centre", () => {
  const AIMING: PlayerAction[] = ["draw", "loose", "chant", "cast", "beam"];
  const NOT_AIMING: PlayerAction[] = ["none", "attack", "block", "dodge", "stagger", "bag", "use", "write"];

  test("the ring shows the aim with a sword out, standing, while the fight goes on", () => {
    assert.deepEqual(aimHud(playerDoing("none", 0, "tb"), 10, null, "lr", true).ring, { lit: 4, stab: false });
  });

  test("no ring with no sword in hand, once down, or once the fight is decided", () => {
    assert.equal(aimHud(playerDoing("none", 0, null), 10, null, "lr", true).ring, null);
    assert.equal(aimHud(playerDoing("none", 0, "tb"), 0, null, "lr", true).ring, null);
    assert.equal(aimHud(playerDoing("none", 0, "tb"), 10, null, "lr", false).ring, null);
  });

  test("the crosshair shows while a bow is drawn and a skill is chanted, cast or streamed, and not otherwise", () => {
    for (const action of AIMING) assert.equal(aimHud(playerDoing(action, 0), 10, null, "tb", true).crosshair, true);
    for (const action of NOT_AIMING) {
      assert.equal(aimHud(playerDoing(action, 0), 10, null, "tb", true).crosshair, false, action);
    }
  });

  test("no crosshair once down or once the fight is decided", () => {
    assert.equal(aimHud(playerDoing("draw", 0), 0, null, "tb", true).crosshair, false);
    assert.equal(aimHud(playerDoing("draw", 0), 10, null, "tb", false).crosshair, false);
  });

  test("casting with a sword in hand shows both", () => {
    const hud = aimHud(playerDoing("cast", 0, "tb"), 10, null, "tb", true);
    assert.ok(hud.ring && hud.crosshair);
  });

  test("the crosshair sits at the overlay's centre whatever its size", () => {
    assert.deepEqual(aimLayout(1920, 1080, 1).crosshair, { x: 960, y: 540 });
    assert.deepEqual(aimLayout(2732, 1536, 2).crosshair, { x: 1366, y: 768 });
  });

  test("the ring sits centred above the bottom edge, by the HUD's pixels", () => {
    assert.deepEqual(aimLayout(1920, 1080, 1).ring, { x: 960, y: 1080 - AIM_HUD.ringAboveBottomPx });
    assert.deepEqual(aimLayout(2732, 1536, 2).ring, { x: 1366, y: 1536 - 2 * AIM_HUD.ringAboveBottomPx });
  });

  test("the ring stays whole on screen, and the stab's mark fits inside its wedges", () => {
    assert.ok(AIM_HUD.ringAboveBottomPx > AIM_HUD.ringRadiusPx + AIM_HUD.wedgeLengthPx / 2);
    assert.ok(AIM_HUD.stabPx < AIM_HUD.ringRadiusPx - AIM_HUD.wedgeLengthPx / 2);
  });

  test("neighbouring wedges keep a gap between them", () => {
    const spacingPx = 2 * AIM_HUD.ringRadiusPx * Math.sin(Math.PI / 8);
    assert.ok(spacingPx > AIM_HUD.wedgeLengthPx + AIM_HUD.ringEdgePx);
  });
});

describe("the draw meter, in the ring's place while a bow is in hand", () => {
  const BOW_ITEM = WEAPONS["training-bow"], STRENGTH = AVERAGE_STAT;
  const FULL = drawTime(BOW, BOW_ITEM, STRENGTH, "fullTime"), MIN = drawTime(BOW, BOW_ITEM, STRENGTH, "minTime");
  const hud = (action: PlayerAction, t: number, hp = 10, fighting = true) =>
    aimHud(playerDoing(action, t), hp, null, "tb", fighting, BOW_ITEM, STRENGTH);
  const speedShare = (t: number) => loosedSpeed(BOW, BOW_ITEM, STRENGTH, t) / BOW_ITEM.powerMps!;
  const near = (got: number | undefined, want: number) => assert.ok(Math.abs((got ?? NaN) - want) < 1e-12, `${got}`);

  test("with a bow in hand it shows, and the ring doesn't", () => {
    const { meter, ...rest } = hud("none", 0);
    assert.deepEqual(rest, { ring: null, crosshair: false });
    assert.equal(meter?.share, 0);
    near(meter?.minShare, speedShare(MIN));
  });

  test("it fills with the speed the arrow would leave at, and stays full past the full draw", () => {
    near(hud("draw", FULL / 2).meter?.share, speedShare(FULL / 2));
    assert.ok(speedShare(FULL / 2) < 0.5);
    assert.equal(hud("draw", FULL).meter?.share, 1);
    assert.equal(hud("draw", 3 * FULL).meter?.share, 1);
  });

  test("it marks the least draw, where a release looses at once", () => {
    near(hud("draw", 0).meter?.minShare, speedShare(MIN));
    assert.ok(speedShare(MIN) > 0 && speedShare(MIN) < 1);
  });

  test("it's empty while the next arrow is nocked", () => {
    assert.equal(hud("loose", 0.1).meter?.share, 0);
  });

  test("none with a sword in hand, once down, or once the fight is decided", () => {
    assert.equal(aimHud(playerDoing("none", 0, "tb"), 10, null, "tb", true, WEAPONS.sword, STRENGTH).meter, null);
    assert.equal(hud("draw", 0.5, 0).meter, null);
    assert.equal(hud("draw", 0.5, 10, false).meter, null);
  });

  test("it lies level across the ring's place, centred, its marks inside it", () => {
    const layout = aimLayout(1920, 1080, 1), span = meterSpan(layout);
    assert.equal((span.left + span.right) / 2, layout.ring.x);
    assert.equal(span.y, layout.ring.y);
    assert.equal(span.right - span.left, AIM_HUD.meterLengthPx);
    const doubled = meterSpan(aimLayout(2732, 1536, 2));
    assert.equal(doubled.right - doubled.left, 2 * AIM_HUD.meterLengthPx);
  });
});

describe("where the overlay puts a point in the world", () => {
  // The engine renders small (the pixel art); the overlay is full size, the same shape.
  const engine = new NullEngine({
    renderWidth: 640, renderHeight: 360, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 1,
  });
  const camera = new UniversalCamera("camera", new Vector3(0, 0, -10), new Scene(engine));
  camera.setTarget(Vector3.Zero());
  camera.fov = 0.8;
  const pxPerMAt10M = 1080 / 2 / Math.tan(camera.fov / 2) / 10;
  // Babylon's matrices are 32-bit floats.
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;

  test("what the camera looks at is the overlay's centre, scaled to the overlay's size", () => {
    const at = onScreen({ x: 0, y: 0, z: 0 }, camera, 1920, 1080)!;
    assert.ok(near(at.x, 960) && near(at.y, 540), `${at.x}, ${at.y}`);
    assert.ok(near(at.pxPerM, pxPerMAt10M), String(at.pxPerM));
  });

  test("right and up in the view are right and up on screen, a metre across the scale's pixels", () => {
    const at = onScreen({ x: 1, y: 1, z: 0 }, camera, 1920, 1080)!;
    assert.ok(near(at.x, 960 + pxPerMAt10M), String(at.x));
    assert.ok(near(at.y, 540 - pxPerMAt10M), String(at.y));
  });

  test("farther away is smaller", () => {
    assert.ok(near(onScreen({ x: 0, y: 0, z: 10 }, camera, 1920, 1080)!.pxPerM, pxPerMAt10M / 2));
  });

  test("behind the camera, or nearer than it draws, isn't on screen", () => {
    assert.equal(onScreen({ x: 0, y: 0, z: -12 }, camera, 1920, 1080), null);
    assert.equal(onScreen({ x: 0, y: 0, z: -10 + camera.minZ / 2 }, camera, 1920, 1080), null);
  });
});
