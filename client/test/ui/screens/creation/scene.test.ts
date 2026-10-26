import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GREETING, SAVE_FAILED } from "../../../../src/ui/screens/creation/lines.js";
import { nextScene, START, type Scene, type SceneEvent } from "../../../../src/ui/screens/creation/scene.js";

const play = (events: SceneEvent[], from: Scene = START): Scene => events.reduce(nextScene, from);
const advance: SceneEvent = { type: "advance" };
const greeted = play(GREETING.map(() => advance));

describe("the creation scene", () => {
  test("greets a line at a time, then opens the panel", () => {
    assert.equal(play(GREETING.slice(1).map(() => advance)).step, "greet");
    assert.equal(play([advance]).line, 1);
    assert.equal(greeted.step, "make");
  });

  test("Begin asks to confirm; Not yet goes back to the panel, Yes saves", () => {
    const asked = play([{ type: "begin" }], greeted);
    assert.equal(asked.step, "confirm");
    assert.equal(play([{ type: "answer", yes: false }], asked).step, "make");
    assert.equal(play([{ type: "answer", yes: true }], asked).step, "saving");
  });

  test("saved: the farewell, then the white clears", () => {
    const saving = play([{ type: "begin" }, { type: "answer", yes: true }], greeted);
    const bye = play([{ type: "saved" }], saving);
    assert.equal(bye.step, "farewell");
    assert.equal(play([advance], bye).step, "out");
  });

  test("no answer from the server: back to the panel with an error, which the next Begin clears", () => {
    const failed = play([{ type: "begin" }, { type: "answer", yes: true }, { type: "timedOut" }], greeted);
    assert.deepEqual([failed.step, failed.error], ["make", SAVE_FAILED]);
    assert.equal(play([{ type: "begin" }], failed).error, null);
  });

  test("events that don't fit the step change nothing", () => {
    assert.equal(play([{ type: "saved" }, { type: "begin" }]), START);
    assert.equal(play([advance, { type: "timedOut" }], greeted), greeted);
    const out = play([{ type: "begin" }, { type: "answer", yes: true }, { type: "saved" }, advance], greeted);
    assert.equal(play([advance, { type: "saved" }], out), out);
  });
});
