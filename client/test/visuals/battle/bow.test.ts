import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  NullEngine, Scene, StandardMaterial, TransformNode, UniversalCamera, Vector3, VertexBuffer,
} from "@babylonjs/core";
import {
  BOW, flightAfter, Projectile, WEAPONS, World, type Entity, type ProjectileData, type Vec3,
} from "@infinite-tower/shared";
import {
  ARROW_M, ARROW_REST, arrowVisual, buildBow, LEAVE_BOW_TIME, pullString, TRAIL, type HeldBow,
} from "../../../src/visuals/battle/bow.js";
import { WEAPON_LOOKS } from "../../../src/visuals/battle/weapons.js";
import type { ArenaScene } from "../../../src/visuals/battle/scene.js";

const SHOOTER = 1 as Entity;
const ARROW = BOW.projectile, { lifeTime, stuckTime } = ARROW, speedMps = WEAPONS["training-bow"].powerMps ?? 0;
const near = (a: Vector3, b: Vector3, what: string, within = 1e-6) =>
  assert.ok(Vector3.Distance(a, b) < within, `${what}: ${a.toString()} vs ${b.toString()}`);

const scene = new Scene(new NullEngine());
const camera = new UniversalCamera("camera", new Vector3(1.5, 1.6, -1), scene);
camera.setTarget(new Vector3(0, 1, 10));
const nocked = new TransformNode("nocked", scene);
nocked.position.set(-0.3, 1.2, 0.4);
const ctx = {
  scene, camera, sky: { castShadows() {} }, bows: new Map([[SHOOTER, { nocked } as HeldBow]]),
  materials: { arrowTrail: new StandardMaterial("arrow-trail", scene) },
} as unknown as ArenaScene;
const world = new World();

const fly = (o: ProjectileData, dt: number) => {
  Object.assign(o, flightAfter(ARROW, o.pos, o.vel, dt));
  o.left -= dt;
};
const fightsNock = ({ pos, vel }: { pos: Vec3; vel: Vec3 }) =>
  new Vector3(pos.x, pos.y, pos.z).subtract(new Vector3(vel.x, vel.y, vel.z).normalize().scale(ARROW_M));

describe("an arrow in flight", () => {
  const loosed = (t: number, shooter = SHOOTER): { e: Entity; o: ProjectileData } => {
    const e = world.spawn();
    const o = world.add<ProjectileData>(e, Projectile, {
      shooter, weapon: "training-bow", ...flightAfter(ARROW, { x: 0, y: 0.85, z: 0.6 }, { x: 0, y: 2, z: speedMps }, t),
      damage: 1, left: lifeTime - t, stuck: false,
    });
    return { e, o };
  };

  test("is drawn leaving from the bow's nock, then eases onto the fight's path and keeps to it", () => {
    const { e, o } = loosed(0), drawn = arrowVisual.spawn(ctx, world, e);
    near(drawn.root.position, nocked.position, "on the string");
    let off = Vector3.Distance(drawn.root.position, fightsNock(o));
    for (let t = 0; t < LEAVE_BOW_TIME - 1e-9; t += 0.02) {
      fly(o, 0.02);
      arrowVisual.frame(drawn, world, e, 0.02);
      const now = Vector3.Distance(drawn.root.position, fightsNock(o));
      assert.ok(now < off, `closing in at ${t}`);
      off = now;
    }
    fly(o, 0.01);
    arrowVisual.frame(drawn, world, e, 0.01);
    near(drawn.root.position, fightsNock(o), "on the fight's path");
    arrowVisual.dispose(drawn);
  });

  test("drawn again mid-ease (the fight reloaded), it stays where it was", () => {
    const first = loosed(0), drawn = arrowVisual.spawn(ctx, world, first.e);
    fly(first.o, LEAVE_BOW_TIME / 2);
    arrowVisual.frame(drawn, world, first.e, LEAVE_BOW_TIME / 2);
    const again = loosed(LEAVE_BOW_TIME / 2), redrawn = arrowVisual.spawn(ctx, world, again.e);
    near(redrawn.root.position, drawn.root.position, "the same place");
    for (const d of [drawn, redrawn]) arrowVisual.dispose(d);
  });

  test("first seen past the ease, or loosed by someone with no bow drawn, it's where the fight has it", () => {
    for (const { e, o } of [loosed(LEAVE_BOW_TIME + 0.05), loosed(0, 99 as Entity)]) {
      const drawn = arrowVisual.spawn(ctx, world, e);
      near(drawn.root.position, fightsNock(o), `shooter ${o.shooter}`);
      arrowVisual.dispose(drawn);
    }
  });
});

describe("an arrow's trail", () => {
  const STEP_S = TRAIL.lengthS / 20;

  const flown = (forS: number, stepS = STEP_S) => {
    const e = world.spawn();
    const o = world.add<ProjectileData>(e, Projectile, {
      shooter: SHOOTER, weapon: "training-bow", pos: { x: 0, y: 0.85, z: 0.6 }, vel: { x: 1, y: 6, z: speedMps },
      damage: 1, left: lifeTime, stuck: false,
    });
    const drawn = arrowVisual.spawn(ctx, world, e), nocks = [drawn.root.position.clone()];
    for (let i = 0; i < Math.round(forS / stepS); i++) {
      fly(o, stepS);
      arrowVisual.frame(drawn, world, e, stepS);
      nocks.push(drawn.root.position.clone());
    }
    return { o, e, drawn, nocks };
  };
  const offPath = (p: Vector3, path: Vector3[]) => Math.min(...path.slice(1).map((b, i) => {
    const a = path[i]!, ab = b.subtract(a);
    const t = Math.min(1, Math.max(0, Vector3.Dot(p.subtract(a), ab) / ab.lengthSquared()));
    return Vector3.Distance(p, a.add(ab.scale(t)));
  }));
  type Drawn = ReturnType<typeof flown>["drawn"];
  const edges = (drawn: Drawn) => {
    const at = drawn.trail.mesh.getVerticesData(VertexBuffer.PositionKind)!;
    return Array.from({ length: TRAIL.points }, (_, i) =>
      [Vector3.FromArray(at, i * 6), Vector3.FromArray(at, i * 6 + 3)] as const);
  };
  const middles = (drawn: Drawn) => edges(drawn).map(([a, b]) => Vector3.Center(a, b));
  const widths = (drawn: Drawn) => edges(drawn).map(([a, b]) => Vector3.Distance(a, b));
  const alphas = (drawn: Drawn) => {
    const colors = drawn.trail.mesh.getVerticesData(VertexBuffer.ColorKind)!;
    return Array.from({ length: TRAIL.points }, (_, i) => colors[i * 8 + 3]!);
  };

  test("streaks back from the nock along where it was drawn over the last TRAIL.lengthS", () => {
    const { drawn, nocks } = flown(0.5), path = middles(drawn);
    assert.ok(drawn.trail.mesh.isEnabled());
    near(path[0]!, drawn.root.position, "from the nock", 1e-4);
    near(path.at(-1)!, nocks.at(-1 - Math.round(TRAIL.lengthS / STEP_S))!, "to where it was then", 1e-4);
    for (const p of path) assert.ok(offPath(p, nocks) < 1e-3, `${p.toString()} on the path`);
    arrowVisual.dispose(drawn);
  });

  test("fades from the nock to nothing at its end", () => {
    const { drawn } = flown(0.5), faded = alphas(drawn);
    assert.ok(Math.abs(faded[0]! - TRAIL.alpha) < 1e-6);
    faded.slice(1).forEach((a, i) => assert.ok(a < faded[i]!, `fading at ${i + 1}`));
    assert.ok(faded.at(-1)! < 1e-6);
    arrowVisual.dispose(drawn);
  });

  test("fresh off the bow, it reaches back only to the bow and fades in from there", () => {
    const { drawn, nocks } = flown(LEAVE_BOW_TIME / 2, STEP_S / 10), path = middles(drawn);
    near(path.at(-1)!, nocked.position, "back to the string", 1e-4);
    for (const p of path) assert.ok(offPath(p, nocks) < 1e-3, `${p.toString()} on the path`);
    assert.ok(alphas(drawn).at(-1)! < 1e-6);
    arrowVisual.dispose(drawn);
  });

  test("is gone once the arrow sticks", () => {
    const { o, e, drawn } = flown(0.3);
    assert.ok(drawn.trail.mesh.isEnabled());
    Object.assign(o, { vel: { x: 0, y: 0, z: 0 }, stuck: true, left: stuckTime });
    arrowVisual.frame(drawn, world, e, STEP_S);
    assert.ok(!drawn.trail.mesh.isEnabled());
    arrowVisual.dispose(drawn);
  });

  test("is TRAIL.widthM wide, or TRAIL.minWidthPx pixels where that's wider, so it shows far off", () => {
    const from = camera.position.clone();
    const metresPerPx = (2 * Math.tan(camera.fov / 2)) / scene.getEngine().getRenderHeight();
    for (const [eye, far] of [[from, false], [new Vector3(0, 1.6, -80), true]] as const) {
      camera.position.copyFrom(eye);
      const { drawn } = flown(0.1), floors = middles(drawn).map((p) =>
        TRAIL.minWidthPx * metresPerPx * Vector3.Distance(p, camera.position));
      widths(drawn).forEach((w, i) => assert.ok(Math.abs(w - Math.max(TRAIL.widthM, floors[i]!)) < 1e-6, `${w} m`));
      assert.ok(far ? floors.every((f) => f > TRAIL.widthM) : floors.some((f) => f < TRAIL.widthM));
      arrowVisual.dispose(drawn);
    }
    camera.position.copyFrom(from);
  });
});

describe("a held bow", () => {
  const look = WEAPON_LOOKS["training-bow"], { braceM, drawM } = look.bow!, hand = new TransformNode("hand", scene);
  const material = new StandardMaterial("stave", scene);
  const { held } = buildBow(scene, hand, { ...look, bow: look.bow! }, material, material);

  test("the string is pulled back with the draw, the nocked arrow on it, over the bow hand beside the stave", () => {
    for (const pull of [0, 0.5, 1]) {
      pullString(held, pull, true);
      near(held.nocked.position, new Vector3(ARROW_REST.x, ARROW_REST.y, -braceM - drawM * pull), `drawn ${pull}`);
      held.strings.forEach((string, i) =>
        near(string.position, Vector3.Center(held.tips[i]!, held.nocked.position), `run ${i}, tip to nock`));
    }
    assert.ok(ARROW_REST.y > 0 && ARROW_REST.x !== 0, "over the hand, beside the stave");
  });

  test("the limbs bend further back the further it's drawn, the string's ends going with their tips", () => {
    const tipsAt = (pull: number) => {
      pullString(held, pull, true);
      return held.tips.map((t) => t.clone());
    };
    const [rest, half, full] = [0, 0.5, 1].map(tipsAt);
    for (const i of [0, 1]) {
      assert.ok(full![i]!.z < half![i]!.z && half![i]!.z < rest![i]!.z, `tip ${i} back`);
      assert.ok(Math.abs(full![i]!.y) < Math.abs(rest![i]!.y), `tip ${i} in`);
      near(held.path[i === 0 ? 0 : held.path.length - 1]!, full![i]!, `the stave's end ${i}`);
    }
  });
});
