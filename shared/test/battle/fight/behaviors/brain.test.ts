import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Enemy, FIXED_DT, toSteps, type EnemyData, type EnemyDef } from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, BOAR, enemy, IDLE, LURKER, player, slam, WOLF } from "../fixtures.js";

before(() => initPhysics());

const LUNGE = BOAR.attacks.lunge!, CHARGE = BOAR.attacks.charge!, POUNCE = WOLF.attacks.pounce!;
const SLAM = slam({ knockback: 0 });
const MAX_WAIT_TIME = 10;

function stepsToNextAttack(def: EnemyDef, atM: number, staggerWhen: (it: EnemyData) => boolean): number {
  const fight = new Fight({
    arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })], enemies: [enemy(def, { x: 0, y: 0.05, z: atM })],
  });
  const it = fight.world.require(fight.enemies[0]!, Enemy);
  const until = (done: () => boolean) => {
    for (let i = 0; i < MAX_WAIT_TIME / FIXED_DT && !done(); i++) fight.step([IDLE]);
  };
  until(() => staggerWhen(it));
  assert.ok(staggerWhen(it), `never got to stagger it, ${it.state}`);
  it.poise = -def.poiseRegen;
  fight.step([IDLE]);
  assert.equal(it.state, "staggered");
  until(() => it.state !== "staggered");
  const back = fight.steps;
  until(() => it.state !== "approach");
  return fight.steps - back;
}

describe("staggered mid-attack, an enemy waits that attack's whole cooldown after the stagger", () => {
  const cases: [string, EnemyDef, number, (it: EnemyData) => boolean, number][] = [
    ["a boar winding up its bite", { ...BOAR, attacks: { lunge: LUNGE } }, 2, (it) => it.state === "lungeWindup",
      LUNGE.cooldown],
    ["a boar winding up its charge", { ...BOAR, walkSpeed: 0, attacks: { charge: CHARGE } }, 7,
      (it) => it.state === "chargeWindup", CHARGE.cooldown],
    ["a wolf standing open after its bite", WOLF, 4.5, (it) => it.state === "pounceRecover" && it.stateTime > 0,
      POUNCE.cooldown],
    ["a bog lurker at the end of its recovery", { ...LURKER, attacks: { slam: SLAM } }, 2.5,
      (it) => it.state === "slamRecover" && it.stateTime >= SLAM.recover - 2 * FIXED_DT, SLAM.cooldown],
  ];
  for (const [name, def, atM, staggerWhen, cooldown] of cases) {
    test(name, () => {
      const waited = stepsToNextAttack(def, atM, staggerWhen);
      assert.ok(waited >= toSteps(cooldown) - 1, `attacked again ${waited} steps after`);
    });
  }
});
