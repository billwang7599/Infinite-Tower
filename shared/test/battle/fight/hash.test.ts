import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  ActiveHit, Body, ChargeAttack, Enemy, Health, LungeAttack, Player, PlayerInput, Stamina, SwordAttack,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, BOAR, busy, enemy, player, SWORDSMAN } from "./fixtures.js";

before(() => initPhysics());

const newFight = () => new Fight({
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: -5 })], enemies: [enemy(BOAR, { x: 0, y: 0.05, z: 3 })],
});

function busyFight(steps = 240, fight = newFight()): Fight {
  while (fight.steps < steps) fight.step([busy(fight.steps + 1)]);
  return fight;
}

describe("a fight's hash", () => {
  test("two fights given the same inputs hash the same at every step", () => {
    const a = newFight(), b = newFight();
    for (let step = 1; step <= 600; step++) {
      a.step([busy(step)]);
      b.step([busy(step)]);
      assert.equal(a.hash(), b.hash(), `step ${step}`);
    }
  });

  test("is a whole number that survives JSON", () => {
    const hash = busyFight().hash();
    assert.ok(Number.isSafeInteger(hash));
    assert.equal(JSON.parse(JSON.stringify(hash)), hash);
  });

  test("a change to anything that matters changes it", () => {
    const changes: [string, (f: Fight) => void][] = [
      ["the step", (f) => { f.steps++; }],
      ["the outcome", (f) => { f.outcome.state = "won"; }],
      ["the outcome's clock", (f) => { f.outcome.stateTime += 0.05; }],
      ["the player's position", (f) => { f.world.require(f.players[0]!, Body).pos.x += 0.02; }],
      ["the player's velocity", (f) => { f.world.require(f.players[0]!, Body).vel.z += 0.02; }],
      ["the player's hp", (f) => { f.world.require(f.players[0]!, Health).hp -= 1; }],
      ["the player's stamina", (f) => { f.world.require(f.players[0]!, Stamina).value -= 1; }],
      ["the stamina's regen delay", (f) => { f.world.require(f.players[0]!, Stamina).regenDelay += 0.1; }],
      ["the player's invulnerability", (f) => { f.world.require(f.players[0]!, Health).invuln += 0.1; }],
      ["the player's hitstun", (f) => { f.world.require(f.players[0]!, Health).hitstun += 0.1; }],
      ["the player's action", (f) => {
        const p = f.world.require(f.players[0]!, Player);
        p.action = p.action === "dodge" ? "block" : "dodge";
      }],
      ["the attack", (f) => {
        const p = f.world.require(f.players[0]!, Player);
        p.attack = p.attack === "lr" ? "tb" : "lr";
      }],
      ["the attack's startup", (f) => { f.world.require(f.players[0]!, Player).startup += 0.05; }],
      ["the attack's power", (f) => { f.world.require(f.players[0]!, Player).power += 0.25; }],
      ["the queued attack", (f) => {
        const p = f.world.require(f.players[0]!, Player);
        p.queued = p.queued === "stab" ? "bt" : "stab";
      }],
      ["the chain", (f) => {
        const p = f.world.require(f.players[0]!, Player);
        p.combo = p.combo === "rl" ? "lr" : "rl";
      }],
      ["the chain's clock", (f) => { f.world.require(f.players[0]!, Player).comboTime += 0.05; }],
      ["the momentum", (f) => { f.world.require(f.players[0]!, Player).momentum += 0.25; }],
      ["the action's clock", (f) => { f.world.require(f.players[0]!, Player).actionTime += 0.05; }],
      ["a buffered press", (f) => { f.world.require(f.players[0]!, Player).dodgeBuffer += 0.05; }],
      ["a held button", (f) => {
        const p = f.world.require(f.players[0]!, Player);
        p.attackHeld = p.attackHeld ? null : "tb";
      }],
      ["a held block", (f) => { const i = f.world.require(f.players[0]!, PlayerInput); i.block = !i.block; }],
      ["being on the ground", (f) => { const p = f.world.require(f.players[0]!, Player); p.grounded = !p.grounded; }],
      ["the player's input", (f) => { f.world.require(f.players[0]!, PlayerInput).moveX += 0.5; }],
      ["the boar's position", (f) => { f.world.require(f.enemies[0]!, Body).pos.z -= 0.02; }],
      ["the boar's hp", (f) => { f.world.require(f.enemies[0]!, Health).hp -= 1; }],
      ["the boar's state", (f) => { f.world.require(f.enemies[0]!, Enemy).state = "stunned"; }],
      ["the boar's state clock", (f) => { f.world.require(f.enemies[0]!, Enemy).stateTime += 0.05; }],
      ["the boar's facing", (f) => { f.world.require(f.enemies[0]!, Enemy).yaw += 0.05; }],
      ["the boar's poise", (f) => { f.world.require(f.enemies[0]!, Enemy).poise -= 1; }],
      ["the boar's armour", (f) => { const e = f.world.require(f.enemies[0]!, Enemy); e.armored = !e.armored; }],
      ["the lunge's cooldown", (f) => { f.world.require(f.enemies[0]!, LungeAttack).cooldown += 0.05; }],
      ["the charge's cooldown", (f) => { f.world.require(f.enemies[0]!, ChargeAttack).cooldown += 0.05; }],
      ["the charge's direction", (f) => { f.world.require(f.enemies[0]!, ChargeAttack).dir.x += 0.05; }],
      ["a live hitbox", (f) => { f.world.add(f.enemies[0]!, ActiveHit, {
        shape: "arc", dirX: 0, dirZ: 1, range: 1, minDot: 0, width: 0, damage: 5, knockback: 0, lift: 0, poiseDamage: 0,
        attack: null, alreadyHit: new Set<number>(),
      }); }],
    ];
    const swordChanges: [string, (f: Fight) => void][] = [
      ["the sword's random numbers", (f) => { f.world.require(f.enemies[0]!, SwordAttack).rng += 1; }],
      ["the sword's cooldown", (f) => { f.world.require(f.enemies[0]!, SwordAttack).cooldown += 0.05; }],
      ["the sword's parry cooldown", (f) => { f.world.require(f.enemies[0]!, SwordAttack).parryCooldown += 0.05; }],
      ["the swing it's on", (f) => {
        const s = f.world.require(f.enemies[0]!, SwordAttack);
        s.attack = s.attack === "lr" ? "stab" : "lr";
      }],
      ["the swings left in its chain", (f) => { f.world.require(f.enemies[0]!, SwordAttack).swingsLeft += 1; }],
      ["being parried", (f) => { f.world.require(f.enemies[0]!, Enemy).state = "parried"; }],
    ];
    const swordFight = () => busyFight(240, new Fight({
      arena: ARENA, players: [player({ x: 0, y: 0.05, z: -3 })], enemies: [enemy(SWORDSMAN, { x: 0, y: 0.05, z: 3 })],
    }));
    for (const [what, change] of [...changes, ...swordChanges]) {
      const fight = swordChanges.some(([w]) => w === what) ? swordFight() : busyFight();
      const before = fight.hash();
      change(fight);
      assert.notEqual(fight.hash(), before, what);
    }
  });

  test("differences far below a centimetre (another machine's last bit) don't count", () => {
    const fight = busyFight();
    const body = fight.world.require(fight.players[0]!, Body);
    body.pos.x = 1.2;
    const before = fight.hash();
    body.pos.x = 1.2 + 1e-6;
    assert.equal(fight.hash(), before);
  });
});
