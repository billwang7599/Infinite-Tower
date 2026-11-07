import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, type TransformNode } from "@babylonjs/core";
import { Body, Skilled, Wielder, World, type Entity, type SkilledData } from "@infinite-tower/shared";
import { Blend } from "../../../src/modes/battle/context.js";
import { fighter } from "../../../src/visuals/battle/battle.js";
import { clash, parried, strike } from "../../../src/visuals/battle/impact.js";
import type { ArenaScene } from "../../../src/visuals/battle/scene.js";
import { swingAt } from "../../fixtures/swings.js";

describe("nothing pauses the fight: weapon contact never holds a fighter's drawing", () => {
  for (const [what, contact] of [
    ["a hit", strike], ["a blocked hit", clash], ["a parry", (s, w, a, b) => parried(s, w, b, a)],
  ] as [string, typeof clash][]) {
    test(`${what}: both are drawn every frame, where the fight has them`, () => {
      const scene = new Scene(new NullEngine()), world = new World(), sparks = () => {};
      const view = { eye: { x: 0, y: 1.6, z: -1 }, at: { x: 0, y: 1, z: 3 } };
      const ctx = {
        scene, nodes: new Map<Entity, TransformNode>(), impacts: new Map(), hitStops: new Map(),
        skills: { bursts: { sparks, parry: sparks, guardBroken: sparks } },
        battle: { blend: new Blend(), corrections: [], view },
      } as unknown as ArenaScene;
      const drawnFrames = new Map<Entity, number>();
      const visual = fighter<Entity>("test", {
        spawn: (_ctx, _world, e) => e, frame: (e) => drawnFrames.set(e, (drawnFrames.get(e) ?? 0) + 1), dispose() {},
      });
      const spawn = (z: number) => {
        const e = world.spawn();
        world.add(e, Body, { pos: { x: 0, y: 0.9, z }, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.9, collider: 0 });
        world.add(e, Wielder, { hands: { rightHand: "sword", leftHand: null, active: "rightHand" }, armReachM: 0.7,
          swing: swingAt("light", "lr", 6), combo: null, comboTime: 0, momentum: 0, feintRecoverSteps: 0 });
        world.add(e, Skilled, { chanting: false, casting: null } as unknown as SkilledData);
        return e;
      };
      const by = spawn(0), target = spawn(1.5), both = [by, target];
      const drawn = both.map((e) => visual.spawn(ctx, world, e));
      contact(ctx, world, by, target);
      for (let i = 1; i <= 30; i++) {
        for (const e of both) world.require(e, Body).pos.x += 0.02;
        drawn.forEach((d, j) => visual.frame(d, world, both[j]!, 1 / 120));
        for (const e of both) {
          assert.equal(drawnFrames.get(e), i, `${e === by ? "the attacker" : "the target"} drawn on frame ${i}`);
        }
        const node = ctx.nodes.get(by)!.position, pos = world.require(by, Body).pos;
        assert.ok(Math.abs(node.x - pos.x) < 1e-9, `the attacker's body where the fight has it on frame ${i}`);
      }
      scene.dispose();
    });
  }
});
