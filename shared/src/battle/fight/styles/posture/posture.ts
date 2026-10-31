import type { Entity, System, World } from "../../../../core/ecs.js";
import { POSTURE, recoveryPerSec } from "../../../../weapons/posture.js";
import { weaponIn } from "../../../../weapons/weapons.js";
import { Enemy, Health, Player, Posture, WeaponAttack, Wielder } from "../../../components.js";
import { stagger } from "../../combat.js";
import type { FightEvent } from "../../context.js";

export function spawnPosture(world: World, e: Entity): void {
  const max = world.get(e, Enemy)?.def.posture ?? POSTURE.max;
  world.add(e, Posture, { value: 0, max, calmTime: 0, brokenTime: 0, streak: 0, streakTime: 0, connected: false });
}

export function guarding(world: World, e: Entity): boolean {
  const hands = world.get(e, Wielder)?.hands;
  if (!hands || !weaponIn(hands)) return false;
  const player = world.get(e, Player);
  if (player) return player.action === "block";
  return world.get(e, Enemy)?.state === "approach" && world.has(e, WeaponAttack);
}

export function addPosture(world: World, events: FightEvent[], e: Entity, amount: number, by: Entity): void {
  const posture = world.get(e, Posture);
  if (!posture || amount <= 0 || posture.brokenTime > 0 || world.require(e, Health).hp <= 0) return;
  posture.value = Math.min(posture.max, posture.value + amount);
  posture.calmTime = 0;
  if (posture.value < posture.max) return;
  const time = world.has(e, Player) ? POSTURE.broken.playerTime : POSTURE.broken.enemyTime;
  posture.brokenTime = time;
  stagger(world, e, time);
  events.push({ type: "posture", by, target: e, what: "broken" });
}

export function postureSystem(): System {
  return (world, dt) => {
    for (const [e, posture, health] of world.query(Posture, Health)) {
      posture.streakTime += dt;
      if (posture.streakTime > POSTURE.deflect.streakTime) posture.streak = 0;
      if (posture.brokenTime > 0) {
        posture.brokenTime = Math.max(0, posture.brokenTime - dt);
        if (posture.brokenTime === 0) posture.value = posture.max * POSTURE.broken.afterShare;
        continue;
      }
      posture.calmTime += dt;
      if (posture.calmTime < POSTURE.recovery.delayTime || health.hp <= 0) continue;
      const perSec = recoveryPerSec(health.hp / health.max, guarding(world, e));
      posture.value = Math.max(0, posture.value - perSec * dt);
    }
  };
}
