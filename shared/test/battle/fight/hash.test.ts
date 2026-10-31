import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  ActiveHit, Body, ChargeAttack, Enemy, Health, LungeAttack, Player, PlayerInput, Stamina, WeaponAttack, Wielder,
  type SwingData,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, BOAR, busy, enemy, player, SWORDSMAN } from "./fixtures.js";

before(() => initPhysics());

const newFight = () => new Fight({
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: -5 })], enemies: [enemy(BOAR, { x: 0, y: 0.05, z: 3 })],
});

const SWING: SwingData = {
  attack: "light", way: "lr", dir: { x: 0, z: 1 }, step: 3, driveAt: 2, liveAt: 6,
  liveUntil: 12, endAt: 17, damage: 9, poiseDamage: 12,
};

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

  test("an arena's look and id don't change how the fight runs", () => {
    const a = newFight();
    const b = new Fight({
      arena: { id: "elsewhere", radius: ARENA.radius, look: "mire" },
      players: [player({ x: 0, y: 0.05, z: -5 })], enemies: [enemy(BOAR, { x: 0, y: 0.05, z: 3 })],
    });
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
        p.action = p.action === "dodge" ? "stagger" : "dodge";
      }],
      ["the queued attack", (f) => {
        const p = f.world.require(f.players[0]!, Player);
        p.queued = p.queued === "heavy" ? "light" : "heavy";
      }],
      ["having a swing going", (f) => {
        const w = f.world.require(f.players[0]!, Wielder);
        w.swing = w.swing ? null : { ...SWING };
      }],
      ["the action's clock", (f) => { f.world.require(f.players[0]!, Player).actionTime += 0.05; }],
      ["a buffered press", (f) => { f.world.require(f.players[0]!, Player).dodgeBuffer += 0.05; }],
      ["a buffered kick", (f) => { f.world.require(f.players[0]!, Player).kickBuffer += 0.05; }],
      ["a held block", (f) => {
        const p = f.world.require(f.players[0]!, Player);
        p.blockHeld = !p.blockHeld;
      }],
      ["a swing's way", (f) => { f.world.require(f.players[0]!, Wielder).swing = { ...SWING, way: "brtl" }; }],
      ["a kick under way", (f) => { f.world.require(f.players[0]!, Wielder).kick = { step: 2 }; }],
      ["the chain's last swing", (f) => { f.world.require(f.players[0]!, Wielder).combo = "lr"; }],
      ["the chain's momentum", (f) => { f.world.require(f.players[0]!, Wielder).momentum += 0.5; }],
      ["the time left to chain", (f) => { f.world.require(f.players[0]!, Wielder).comboTime += 0.05; }],
      ["the aimed way", (f) => {
        const p = f.world.require(f.players[0]!, Player);
        p.way = p.way === "tb" ? "lr" : "tb";
      }],
      ["a tap parry's window", (f) => { f.world.require(f.players[0]!, Player).tapParryLeft += 0.05; }],
      ["a held button", (f) => {
        const p = f.world.require(f.players[0]!, Player);
        p.attackHeld = p.attackHeld ? null : "heavy";
      }],
      ["a held block key", (f) => {
        const i = f.world.require(f.players[0]!, PlayerInput);
        i.block = !i.block;
      }],
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
        dirX: 0, dirZ: 1, range: 1, minDot: 0, damage: 5, knockback: 0, lift: 0, poiseDamage: 0, attack: null,
        way: null, alreadyHit: new Set<number>(),
      }); }],
    ];
    const swordChanges: [string, (f: Fight) => void][] = [
      ["the random numbers", (f) => { f.world.require(f.enemies[0]!, Enemy).rng += 1; }],
      ["its weapon attack's cooldown", (f) => { f.world.require(f.enemies[0]!, WeaponAttack).cooldown += 0.05; }],
      ["the swings left in its chain", (f) => { f.world.require(f.enemies[0]!, WeaponAttack).swingsLeft += 1; }],
      ["its last way", (f) => {
        const w = f.world.require(f.enemies[0]!, WeaponAttack);
        w.way = w.way === "lr" ? "rl" : "lr";
      }],
      ["its wait before another kick", (f) => { f.world.require(f.enemies[0]!, WeaponAttack).kickWait += 0.05; }],
      ["kicking", (f) => { f.world.require(f.enemies[0]!, Enemy).state = "kick"; }],
      ["a parry it read", (f) => {
        const w = f.world.require(f.enemies[0]!, WeaponAttack);
        w.parryRead = !w.parryRead;
      }],
      ["a riposte it owes", (f) => {
        const w = f.world.require(f.enemies[0]!, WeaponAttack);
        w.riposte = !w.riposte;
      }],
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

    const swingChanges: [string, (s: SwingData) => void][] = [
      ["its attack", (s) => { s.attack = "heavy"; }],
      ["its way", (s) => { s.way = s.way === "tb" ? "bt" : "tb"; }],
      ["its aim", (s) => { s.dir.x += 0.05; }],
      ["its clock", (s) => { s.step += 1; }],
      ["when its blade goes live", (s) => { s.liveAt += 1; }],
      ["when its blade is done", (s) => { s.liveUntil += 1; }],
      ["when it's over", (s) => { s.endAt += 1; }],
      ["its damage", (s) => { s.damage += 1; }],
      ["its poise damage", (s) => { s.poiseDamage += 1; }],
      ["when it draws back", (s) => { s.driveAt += 1; }],
    ];
    for (const [who, newFight] of [["the player's", busyFight], ["the swordsman's", swordFight]] as const) {
      for (const [what, change] of swingChanges) {
        const fight = newFight();
        const swinging = who === "the player's" ? fight.players[0]! : fight.enemies[0]!;
        const wielder = fight.world.require(swinging, Wielder);
        wielder.swing = { ...SWING, dir: { ...SWING.dir } };
        const before = fight.hash();
        change(wielder.swing);
        assert.notEqual(fight.hash(), before, `${who} swing: ${what}`);
      }
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
