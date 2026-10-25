import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  FIXED_DT, World, stepWalker, type LevelLayout, type Vec2, type WalkInput,
} from "@infinite-tower/shared";
import { FieldActor, FieldPos } from "../../src/field/components.js";
import { Prediction } from "../../src/field/prediction.js";
import type { FieldView } from "../../src/field/scene.js";
import { FakeNet } from "../fixtures/fake-net.js";

/** Walkable x ∈ [-9, 9], z ∈ [-4, 4]. */
const LEVEL: LevelLayout = {
  id: "test", name: "Test", theme: "grass-field",
  halfWidth: 10, halfDepth: 5, border: 1, playerSpeed: 5,
  grass: [], campfires: [],
};

const RIGHT: WalkInput = { moveX: 1, moveZ: 0 };
const UP_LEFT: WalkInput = { moveX: -1, moveZ: 1 };
const STILL: WalkInput = { moveX: 0, moveZ: 0 };

function setup(level: LevelLayout | null = LEVEL, start: Vec2 = { x: 0, z: 0 }) {
  const world = new World();
  const player = world.spawn();
  const pos = world.add(player, FieldPos, { ...start });
  const actor = world.add(player, FieldActor, { vx: 0, vz: 0, facing: 1, alert: false, target: null });
  const view = { level } as FieldView;
  const net = new FakeNet();
  const prediction = new Prediction(world, view, player, net.asConnection());
  return { prediction, pos, actor, view, net };
}

/** Where shared stepWalker takes `from` with these inputs: what the server will compute. */
function walk(from: Vec2, inputs: WalkInput[]): Vec2 {
  const pos = { ...from };
  for (const input of inputs) stepWalker(LEVEL, pos, input, FIXED_DT);
  return pos;
}

describe("Prediction.step", () => {
  test("standing still sends nothing and doesn't move", () => {
    const { prediction, pos, net } = setup();
    prediction.step(STILL);
    prediction.step(STILL);
    assert.deepEqual(net.sent, []);
    assert.deepEqual(pos, { x: 0, z: 0 });
  });

  test("standing still stops the player", () => {
    const { prediction, actor } = setup();
    prediction.step(RIGHT);
    prediction.step(STILL);
    assert.equal(actor.vx, 0);
    assert.equal(actor.vz, 0);
  });

  test("each moving input is sent with the next sequence number", () => {
    const { prediction, net } = setup();
    prediction.step(RIGHT);
    prediction.step(STILL);
    prediction.step(UP_LEFT);
    prediction.step({ moveX: 0, moveZ: -0.5 });
    assert.deepEqual(net.sent, [
      { t: "input", seq: 1, moveX: 1, moveZ: 0 },
      { t: "input", seq: 2, moveX: -1, moveZ: 1 },
      { t: "input", seq: 3, moveX: 0, moveZ: -0.5 },
    ]);
  });

  test("moves the player locally exactly as the shared walking rules do", () => {
    const { prediction, pos, actor } = setup();
    const inputs = [RIGHT, RIGHT, UP_LEFT, { moveX: 0.3, moveZ: -0.7 }, STILL, UP_LEFT];
    for (const input of inputs) prediction.step(input);
    assert.deepEqual(pos, walk({ x: 0, z: 0 }, inputs));
    const vel = { vx: 0, vz: 0 };
    stepWalker(LEVEL, { x: 0, z: 0 }, UP_LEFT, FIXED_DT, vel);
    assert.deepEqual({ vx: actor.vx, vz: actor.vz }, vel);
  });

  test("stops at the level's edge, like the server", () => {
    const { prediction, pos } = setup(LEVEL, { x: 8.99, z: 0 });
    const inputs = Array.from({ length: 30 }, () => RIGHT);
    for (const input of inputs) prediction.step(input);
    assert.deepEqual(pos, walk({ x: 8.99, z: 0 }, inputs));
    assert.equal(pos.x, LEVEL.halfWidth - LEVEL.border);
  });

  test("facing follows moveX, and a near-zero moveX keeps it", () => {
    const { prediction, actor } = setup();
    prediction.step({ moveX: -1, moveZ: 0 });
    assert.equal(actor.facing, -1);
    prediction.step({ moveX: 0.05, moveZ: 1 });
    assert.equal(actor.facing, -1);
    prediction.step({ moveX: 0.5, moveZ: 0 });
    assert.equal(actor.facing, 1);
    prediction.step({ moveX: 0, moveZ: -1 });
    assert.equal(actor.facing, 1);
  });

  test("with no level yet, nothing moves and nothing is sent", () => {
    const { prediction, pos, net } = setup(null);
    for (const input of [RIGHT, UP_LEFT]) prediction.step(input);
    assert.deepEqual({ pos, sent: net.sent }, { pos: { x: 0, z: 0 }, sent: [] });
  });

  test("once the level arrives: walks, sends from sequence number 1, replays nothing from before", () => {
    const { prediction, pos, view, net } = setup(null);
    prediction.step(UP_LEFT);
    view.level = LEVEL;
    prediction.step(RIGHT);
    assert.deepEqual(net.sent, [{ t: "input", seq: 1, moveX: 1, moveZ: 0 }]);
    prediction.reconcile(0, { x: 2, z: 1 });
    assert.deepEqual(pos, walk({ x: 2, z: 1 }, [RIGHT]));
  });
});

describe("Prediction.reconcile", () => {
  test("restarts from the server's position and replays only the inputs after ack", () => {
    const { prediction, pos } = setup();
    const inputs = [RIGHT, RIGHT, UP_LEFT, UP_LEFT, RIGHT];
    for (const input of inputs) prediction.step(input);
    const at = { x: 3, z: -2 };
    prediction.reconcile(2, at);
    assert.deepEqual(pos, walk(at, inputs.slice(2)));
  });

  test("does not change the given position object", () => {
    const { prediction, pos } = setup();
    prediction.step(RIGHT);
    const at = { x: 3, z: -2 };
    prediction.reconcile(0, at);
    assert.deepEqual(at, { x: 3, z: -2 });
    assert.notEqual(pos, at);
  });

  test("with everything acked, the player is where the server says", () => {
    const { prediction, pos } = setup();
    prediction.step(RIGHT);
    prediction.step(UP_LEFT);
    prediction.reconcile(2, { x: -1, z: 1.5 });
    assert.deepEqual(pos, { x: -1, z: 1.5 });
  });

  test("acked inputs are not replayed again later", () => {
    const { prediction, pos } = setup();
    const inputs = [RIGHT, UP_LEFT, RIGHT, UP_LEFT];
    for (const input of inputs) prediction.step(input);
    prediction.reconcile(3, { x: 1, z: 1 });
    prediction.reconcile(1, { x: 2, z: 2 });
    assert.deepEqual(pos, walk({ x: 2, z: 2 }, inputs.slice(3)));
  });

  test("standing still in between doesn't add anything to replay", () => {
    const { prediction, pos } = setup();
    prediction.step(RIGHT);
    prediction.step(STILL);
    prediction.step(STILL);
    prediction.step(UP_LEFT);
    prediction.reconcile(0, { x: 0, z: 0 });
    assert.deepEqual(pos, walk({ x: 0, z: 0 }, [RIGHT, UP_LEFT]));
  });

  test("when the server agrees, nothing visibly corrects", () => {
    const { prediction, pos } = setup();
    const inputs = [RIGHT, UP_LEFT, RIGHT, RIGHT];
    for (const input of inputs) prediction.step(input);
    const before = { ...pos };
    prediction.reconcile(2, walk({ x: 0, z: 0 }, inputs.slice(0, 2)));
    assert.deepEqual(pos, before);
  });
});

describe("Prediction.reset", () => {
  test("puts the player where the server says and stops them", () => {
    const { prediction, pos, actor } = setup();
    prediction.step(RIGHT);
    prediction.reset({ x: -7, z: 3 });
    assert.deepEqual(pos, { x: -7, z: 3 });
    assert.equal(actor.vx, 0);
    assert.equal(actor.vz, 0);
  });

  test("drops the unconfirmed inputs", () => {
    const { prediction, pos } = setup();
    prediction.step(RIGHT);
    prediction.step(RIGHT);
    prediction.reset({ x: -7, z: 3 });
    prediction.reconcile(0, { x: -6, z: 3 });
    assert.deepEqual(pos, { x: -6, z: 3 });
  });

  test("sequence numbers keep counting after a reset", () => {
    const { prediction, net } = setup();
    prediction.step(RIGHT);
    prediction.reset({ x: 0, z: 0 });
    prediction.step(RIGHT);
    assert.deepEqual(net.sent.map((m) => (m.t === "input" ? m.seq : null)), [1, 2]);
  });
});
