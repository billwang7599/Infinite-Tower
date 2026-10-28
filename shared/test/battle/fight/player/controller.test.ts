import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CHAIN, dodgeCost, FIXED_DT, Player, PLAYER, Stamina, STARTER_SWORD, startupTime, type PlayerAction, type PlayerInputData, type Vitals,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightSnapshot } from "@infinite-tower/shared/fight";
import { ARENA, dumpState, enemy, input, player, STATS, STATUE } from "../fixtures.js";

await initPhysics();

/** What the player does on each step (1 is the fight's first). */
type Script = (step: number) => PlayerInputData;

/** The swing's first step (the player has landed by then). */
const SWING_AT = 5;

/** Steps from a swing's first step to the first one on which it lets another action start (once its blade is done). */
const stepsUntil = (time: number): number => {
  let t = 0, n = 0;
  for (; t < time; n++) t += FIXED_DT;
  return n;
};
const LOCKED_STEPS = stepsUntil(startupTime("opening", 0, STARTER_SWORD.speed) + CHAIN.activeTime);
/** The first step a dodge can start on after the swing at SWING_AT. */
const LET_GO_AT = SWING_AT + LOCKED_STEPS;

/** Swinges on SWING_AT; `presses` says what else is pressed on which step (a tap: held that step only). */
const swingThen = (presses: Record<number, Partial<PlayerInputData>>): Script =>
  (step) => input({ ...(step === SWING_AT ? { attack: "lr" } : {}), ...presses[step] });

const newFight = (vitals?: Vitals) => new Fight({
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, vitals ? { vitals } : {})],
  enemies: [enemy(STATUE, { x: 0, y: 0.05, z: 6 })],
});

interface Played { fight: Fight; actions: PlayerAction[]; dodgeStarts: number[]; staminas: number[] }

/** Steps `fight` from where it is to step `to` with `script`, noting the player's action after each step. */
function play(script: Script, to = 90, fight = newFight()): Played {
  const me = fight.players[0]!;
  const played: Played = { fight, actions: [], dodgeStarts: [], staminas: [] };
  let last: PlayerAction = fight.world.require(me, Player).action;
  while (fight.steps < to) {
    fight.step([script(fight.steps + 1)]);
    const { action } = fight.world.require(me, Player);
    if (action === "dodge" && last !== "dodge") played.dodgeStarts.push(fight.steps);
    played.actions.push(action);
    played.staminas.push(fight.world.require(me, Stamina).value);
    last = action;
  }
  return played;
}

/** Through JSON, as it goes over the wire. */
const wire = (snap: FightSnapshot): FightSnapshot => JSON.parse(JSON.stringify(snap));

describe("a dodge pressed during a swing (the user's call: it waits for the swing, then goes)", () => {
  test("the setup: a swing on SWING_AT that lets go some steps later", () => {
    const { actions, dodgeStarts } = play(swingThen({}));
    assert.equal(actions[SWING_AT - 1], "attack");
    assert.ok(LOCKED_STEPS > 2, `${LOCKED_STEPS} steps`);
    assert.deepEqual(dodgeStarts, []);
  });

  test("pressed on any step of the swing, its first to its last, it starts on the step the swing lets go", () => {
    for (let k = 1; k < LOCKED_STEPS; k++) {
      const { actions, dodgeStarts, staminas } = play(swingThen({ [SWING_AT + k]: { dodge: true } }));
      assert.deepEqual(actions.slice(SWING_AT - 1, LET_GO_AT - 1), Array(LOCKED_STEPS).fill("attack"),
        `pressed ${k} steps in: the swing isn't cut short`);
      assert.deepEqual(dodgeStarts, [LET_GO_AT], `pressed ${k} steps in`);
      assert.equal(staminas[LET_GO_AT - 1], STATS.stamina - PLAYER.swing.cost - dodgeCost("light")!,
        `pressed ${k} steps in: one swing and one dodge paid for`);
    }
  });

  test("pressed once the swing has let go, it starts at once, as before", () => {
    for (let k = LOCKED_STEPS; k < LOCKED_STEPS + 5; k++) {
      assert.deepEqual(play(swingThen({ [SWING_AT + k]: { dodge: true } })).dodgeStarts, [SWING_AT + k]);
    }
  });

  test("held through the swing, or tapped twice in it, it's still one dodge", () => {
    const held: Script = (step) =>
      input({ attack: step === SWING_AT ? "lr" : null, dodge: step > SWING_AT && step < 80 });
    assert.deepEqual(play(held).dodgeStarts, [LET_GO_AT]);
    const twice = swingThen({ [SWING_AT + 1]: { dodge: true }, [LET_GO_AT - 2]: { dodge: true } });
    assert.deepEqual(play(twice).dodgeStarts, [LET_GO_AT]);
  });

  test("with another swing buffered too, the dodge goes first and the swing isn't kept for after it", () => {
    for (const attackAt of [SWING_AT + 2, LET_GO_AT - 1]) {
      const script = swingThen({ [SWING_AT + 1]: { dodge: true }, [attackAt]: { attack: "lr" } });
      const { actions, dodgeStarts } = play(script);
      assert.deepEqual(dodgeStarts, [LET_GO_AT], `swing pressed on ${attackAt}`);
      assert.ok(!actions.slice(LET_GO_AT).includes("attack"), `swing pressed on ${attackAt}`);
    }
  });

  test("if the player can't dodge when the swing lets go (no stamina), the press isn't kept: it runs out", () => {
    // Enough for the swing (it refills a little first), which leaves none.
    const tired = newFight({ hp: PLAYER.maxHp, stamina: 1 });
    const { actions, dodgeStarts, staminas } = play(swingThen({ [SWING_AT + 1]: { dodge: true } }), 200, tired);
    assert.equal(actions[SWING_AT - 1], "attack");
    assert.equal(staminas[LET_GO_AT - 1], 0);
    assert.ok(tired.world.require(tired.players[0]!, Stamina).value > dodgeCost("light")!, "stamina came back");
    assert.deepEqual(dodgeStarts, []);
  });

  test("a waiting dodge is in the state and the hash: saved and loaded, or rolled back, it plays on the same", () => {
    const script = swingThen({ [SWING_AT + 1]: { dodge: true } });
    const right = play(script);
    for (const at of [SWING_AT + 1, SWING_AT + 3, LET_GO_AT - 1]) {
      const first = play(script, at);
      const unpressed = play(swingThen({}), at);
      assert.notEqual(first.fight.hash(), unpressed.fight.hash(), `step ${at}: the waiting dodge is in the hash`);

      const loaded = newFight();
      loaded.load(wire(first.fight.save()));
      const went = play(script, 90, loaded);
      assert.deepEqual(went.dodgeStarts, [LET_GO_AT], `loaded at ${at}`);
      assert.equal(dumpState(went.fight), dumpState(right.fight), `loaded at ${at}`);
      assert.equal(went.fight.hash(), right.fight.hash(), `loaded at ${at}`);

      // A copy that went its own way (it never pressed dodge, and ran on past the swing) rolled back to step `at`.
      const wrong = play(swingThen({}), LET_GO_AT + 10).fight;
      wrong.load(wire(first.fight.save()));
      const rolledBack = play(script, 90, wrong);
      assert.deepEqual(rolledBack.dodgeStarts, [LET_GO_AT], `rolled back at ${at}`);
      assert.equal(dumpState(rolledBack.fight), dumpState(right.fight), `rolled back at ${at}`);
    }
  });
});

describe("what the player holds", () => {
  const unarmed = (wields: { sword: boolean; spellbook: boolean }) => new Fight({
    arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, { wields })],
    enemies: [enemy(STATUE, { x: 0, y: 0.05, z: 6 })],
  });
  const actionsOf = (fight: Fight, press: Partial<PlayerInputData>) => {
    const held = (step: number) => input(step >= SWING_AT && step < SWING_AT + 30 ? press : {});
    return new Set(play(held, 40, fight).actions);
  };

  test("no sword: no swing, no stab and no block", () => {
    for (const press of [{ attack: "lr" }, { attack: "stab" }, { block: true }] as const) {
      const seen = actionsOf(unarmed({ sword: false, spellbook: true }), press);
      assert.deepEqual([...seen], ["none"], JSON.stringify(press));
    }
  });

  test("no spellbook: no casting, but the sword still swings", () => {
    const cast = { segments: [{ form: "bolt", elements: ["fire"], augments: [] }] } as const;
    assert.deepEqual([...actionsOf(unarmed({ sword: true, spellbook: false }), { cast })], ["none"]);
    assert.ok(actionsOf(unarmed({ sword: true, spellbook: false }), { attack: "lr" }).has("attack"));
  });

  test("with both, the same presses do what they always did", () => {
    const both = { sword: true, spellbook: true };
    assert.ok(actionsOf(unarmed(both), { attack: "lr" }).has("attack"));
    assert.ok(actionsOf(unarmed(both), { block: true }).has("block"));
  });
});
