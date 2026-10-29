import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Health, Player, PLAYER, type EnemyDef } from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, BITER, CASTER, enemy, player, run } from "./fixtures.js";

before(() => initPhysics());

function fightAgainst(def: EnemyDef, invulnerable: boolean, enemyZ: number): Fight {
  return new Fight({
    arena: ARENA,
    players: [player({ x: 0, y: 0.05, z: 0 }, { invulnerable })],
    enemies: [enemy(def, { x: 0, y: 0.05, z: enemyZ })],
  });
}

const hpOf = (fight: Fight) => fight.world.require(fight.players[0]!, Health).hp;

describe("an invulnerable player", () => {
  test("takes no damage from bites", () => {
    const hurt = fightAgainst(BITER, false, 2), spared = fightAgainst(BITER, true, 2);
    run(hurt, 3);
    run(spared, 3);
    assert.ok(hpOf(hurt) < PLAYER.maxHp);
    assert.equal(hpOf(spared), PLAYER.maxHp);
  });

  test("takes no damage from skills, burning included", () => {
    const hurt = fightAgainst(CASTER, false, 6), spared = fightAgainst(CASTER, true, 6);
    run(hurt, 6);
    run(spared, 6);
    assert.ok(hpOf(hurt) < PLAYER.maxHp);
    assert.equal(hpOf(spared), PLAYER.maxHp);
  });

  test("is part of the fight's state: saved, loaded and hashed", () => {
    const fight = fightAgainst(BITER, false, 2);
    const before = fight.hash();
    fight.world.require(fight.players[0]!, Player).invulnerable = true;
    assert.notEqual(fight.hash(), before);
    const copy = fightAgainst(BITER, false, 2);
    copy.load(fight.save());
    assert.equal(copy.world.require(copy.players[0]!, Player).invulnerable, true);
    assert.equal(copy.hash(), fight.hash());
  });
});
