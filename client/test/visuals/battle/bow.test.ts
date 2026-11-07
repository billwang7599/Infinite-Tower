import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { BOW, Projectile, World, type Entity, type ProjectileData } from "@infinite-tower/shared";
import { ARROW_M, arrowVisual, LEAVE_BOW_TIME, type HeldBow } from "../../../src/visuals/battle/bow.js";
import type { ArenaScene } from "../../../src/visuals/battle/scene.js";

const SHOOTER = 1 as Entity;
const { speedMps, lifeTime } = BOW.projectile;
const near = (a: Vector3, b: Vector3, what: string) =>
  assert.ok(Vector3.Distance(a, b) < 1e-6, `${what}: ${a.toString()} vs ${b.toString()}`);

describe("an arrow in flight", () => {
  const scene = new Scene(new NullEngine());
  const nocked = new TransformNode("nocked", scene);
  nocked.position.set(-0.3, 1.2, 0.4);
  const ctx = {
    scene, sky: { castShadows() {} }, bows: new Map([[SHOOTER, { nocked } as HeldBow]]),
  } as unknown as ArenaScene;
  const world = new World();

  const loosed = (t: number, shooter = SHOOTER): { e: Entity; o: ProjectileData } => {
    const e = world.spawn();
    const o = world.add(e, Projectile, {
      shooter, weapon: "training-bow", pos: { x: 0, y: 0.85, z: 0.6 + speedMps * t },
      vel: { x: 0, y: 0, z: speedMps }, damage: 1, left: lifeTime - t, stuck: false,
    });
    return { e, o };
  };
  const fly = (o: ProjectileData, dt: number) => {
    o.pos.z += speedMps * dt;
    o.left -= dt;
  };
  const fightsNock = (o: ProjectileData) => new Vector3(o.pos.x, o.pos.y, o.pos.z - ARROW_M);

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
