import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  dodgeCost, FIXED_DT, Player, PLAYER, Stamina, type PlayerAction, type PlayerInputData, type Vitals,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightSnapshot } from "@infinite-tower/shared/fight";
import { ARENA, dumpState, enemy, input, player, STATS, STATUE } from "../fixtures.js";

await initPhysics();

/** What the player does on each step (1 is the fight's first). */
type Script = (step: number) => PlayerInputData;

/** The slash's first step (the player has landed by then). */
const SLASH_AT = 5;

/** Steps from a slash's first step to the first one on which it lets another action start (`chainAfter`). */
const stepsUntil = (time: number): number => {
  let t = 0, n = 0;
  for (; t < time; n++) t += FIXED_DT;
  return n;
};
const LOCKED_STEPS = stepsUntil(PLAYER.slash.chainAfter);
/** The first step a dodge can start on after the slash at SLASH_AT. */
const LET_GO_AT = SLASH_AT + LOCKED_STEPS;

/** Slashes on SLASH_AT; `presses` says what else is pressed on which step (a tap: held that step only). */
const slashThen = (presses: Record<number, Partial<PlayerInputData>>): Script =>
  (step) => input({ ...(step === SLASH_AT ? { attack: true } : {}), ...presses[step] });

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

describe("a dodge pressed during a slash (the user's call: it waits for the slash, then goes)", () => {
  test("the setup: a slash on SLASH_AT that lets go some steps later", () => {
    const { actions, dodgeStarts } = play(slashThen({}));
    assert.equal(actions[SLASH_AT - 1], "slash");
    assert.ok(LOCKED_STEPS > 2, `${LOCKED_STEPS} steps`);
    assert.deepEqual(dodgeStarts, []);
  });

  test("pressed on any step of the slash, its first to its last, it starts on the step the slash lets go", () => {
    for (let k = 1; k < LOCKED_STEPS; k++) {
      const { actions, dodgeStarts, staminas } = play(slashThen({ [SLASH_AT + k]: { dodge: true } }));
      assert.deepEqual(actions.slice(SLASH_AT - 1, LET_GO_AT - 1), Array(LOCKED_STEPS).fill("slash"),
        `pressed ${k} steps in: the slash isn't cut short`);
      assert.deepEqual(dodgeStarts, [LET_GO_AT], `pressed ${k} steps in`);
      assert.equal(staminas[LET_GO_AT - 1], STATS.stamina - PLAYER.slash.cost - dodgeCost("light")!,
        `pressed ${k} steps in: one slash and one dodge paid for`);
    }
  });

  test("pressed once the slash has let go, it starts at once, as before", () => {
    for (let k = LOCKED_STEPS; k < LOCKED_STEPS + 5; k++) {
      assert.deepEqual(play(slashThen({ [SLASH_AT + k]: { dodge: true } })).dodgeStarts, [SLASH_AT + k]);
    }
  });

  test("held through the slash, or tapped twice in it, it's still one dodge", () => {
    const held: Script = (step) => input({ attack: step === SLASH_AT, dodge: step > SLASH_AT && step < 80 });
    assert.deepEqual(play(held).dodgeStarts, [LET_GO_AT]);
    const twice = slashThen({ [SLASH_AT + 1]: { dodge: true }, [LET_GO_AT - 2]: { dodge: true } });
    assert.deepEqual(play(twice).dodgeStarts, [LET_GO_AT]);
  });

  test("with another slash buffered too, the dodge goes first and the slash isn't kept for after it", () => {
    for (const attackAt of [SLASH_AT + 2, LET_GO_AT - 1]) {
      const script = slashThen({ [SLASH_AT + 1]: { dodge: true }, [attackAt]: { attack: true } });
      const { actions, dodgeStarts } = play(script);
      assert.deepEqual(dodgeStarts, [LET_GO_AT], `slash pressed on ${attackAt}`);
      assert.ok(!actions.slice(LET_GO_AT).includes("slash"), `slash pressed on ${attackAt}`);
    }
  });

  test("if the player can't dodge when the slash lets go (no stamina), the press isn't kept: it runs out", () => {
    // Enough for the slash (it refills a little first), which leaves none.
    const tired = newFight({ hp: PLAYER.maxHp, stamina: 1 });
    const { actions, dodgeStarts, staminas } = play(slashThen({ [SLASH_AT + 1]: { dodge: true } }), 200, tired);
    assert.equal(actions[SLASH_AT - 1], "slash");
    assert.equal(staminas[LET_GO_AT - 1], 0);
    assert.ok(tired.world.require(tired.players[0]!, Stamina).value > dodgeCost("light")!, "stamina came back");
    assert.deepEqual(dodgeStarts, []);
  });

  test("a waiting dodge is in the state and the hash: saved and loaded, or rolled back, it plays on the same", () => {
    const script = slashThen({ [SLASH_AT + 1]: { dodge: true } });
    const right = play(script);
    for (const at of [SLASH_AT + 1, SLASH_AT + 3, LET_GO_AT - 1]) {
      const first = play(script, at);
      const unpressed = play(slashThen({}), at);
      assert.notEqual(first.fight.hash(), unpressed.fight.hash(), `step ${at}: the waiting dodge is in the hash`);

      const loaded = newFight();
      loaded.load(wire(first.fight.save()));
      const went = play(script, 90, loaded);
      assert.deepEqual(went.dodgeStarts, [LET_GO_AT], `loaded at ${at}`);
      assert.equal(dumpState(went.fight), dumpState(right.fight), `loaded at ${at}`);
      assert.equal(went.fight.hash(), right.fight.hash(), `loaded at ${at}`);

      // A copy that went its own way (it never pressed dodge, and ran on past the slash) rolled back to step `at`.
      const wrong = play(slashThen({}), LET_GO_AT + 10).fight;
      wrong.load(wire(first.fight.save()));
      const rolledBack = play(script, 90, wrong);
      assert.deepEqual(rolledBack.dodgeStarts, [LET_GO_AT], `rolled back at ${at}`);
      assert.equal(dumpState(rolledBack.fight), dumpState(right.fight), `rolled back at ${at}`);
    }
  });
});
