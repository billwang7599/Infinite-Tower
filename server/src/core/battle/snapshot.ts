/** Builds what a `battleState` says about the fight: everyone rounded for drawing, and what happened, by index. */
import {
  Body, Enemy, Health, Player, roundTo, type BattleEvent, type EnemySnap, type Entity, type FighterSnap,
  type PlayerSnap, type World,
} from "@infinite-tower/shared";
import type { FightEvent } from "@infinite-tower/shared/fight";

/** 2 decimals: 1 cm, 0.01 s, 0.01 rad, far below what can be seen (see game/snapshot.ts). */
const forWire = (x: number) => roundTo(x, 2);

function fighterSnap(world: World, e: Entity): FighterSnap {
  const { pos, vel } = world.require(e, Body), health = world.require(e, Health);
  return {
    x: forWire(pos.x), y: forWire(pos.y), z: forWire(pos.z), vx: forWire(vel.x), vy: forWire(vel.y),
    vz: forWire(vel.z), hp: forWire(health.hp), flash: forWire(health.flash),
  };
}

export function enemySnap(world: World, e: Entity): EnemySnap {
  const enemy = world.require(e, Enemy);
  return { ...fighterSnap(world, e), yaw: forWire(enemy.yaw), state: enemy.state, stateTime: forWire(enemy.stateTime) };
}

export function playerSnap(world: World, e: Entity): PlayerSnap {
  const player = world.require(e, Player);
  return {
    ...fighterSnap(world, e), action: player.action, actionTime: forWire(player.actionTime),
    dirX: forWire(player.actionDir.x), dirZ: forWire(player.actionDir.z), grounded: player.grounded,
    invuln: forWire(world.require(e, Health).invuln),
  };
}

/** `event`, its fighters as indices into `fighters` (the players in seat order, then the enemies). */
export function battleEvent(fighters: readonly Entity[], event: FightEvent): BattleEvent {
  if (event.type === "slam") return { type: "slam", fighter: fighters.indexOf(event.enemy) };
  return { type: "hit", target: fighters.indexOf(event.target), team: event.team, damage: event.damage };
}
