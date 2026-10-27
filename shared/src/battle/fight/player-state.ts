/**
 * A player's exact state, out of a fight and back into one (the shapes are battle/snapshot.ts's): the server sends
 * each player their own with every `battleState`, and their client writes it over its prediction before replaying
 * the inputs the server hasn't run yet.
 */
import type { Entity } from "../../core/ecs.js";
import { ActiveHit, Body, Health, Player, Stamina } from "../components.js";
import type { PlayerState } from "../snapshot.js";
import type { Fight } from "./fight.js";

export function readPlayerState(fight: Fight, e: Entity): PlayerState {
  const { world } = fight;
  const { pos, vel } = world.require(e, Body);
  const { burden: _, actionDir, ...player } = world.require(e, Player);
  const { max: _max, ...health } = world.require(e, Health);
  const { max: _maxStamina, ...stamina } = world.require(e, Stamina);
  return { pos: { ...pos }, vel: { ...vel }, player: { ...player, actionDir: { ...actionDir } }, health, stamina };
}

/**
 * Makes player `e` exactly as `state` says, collider included. A live slash's hitbox is dropped: the controller makes
 * it again on the swing's next active step, and only the server's fight lands hits.
 */
export function writePlayerState(fight: Fight, e: Entity, state: PlayerState): void {
  const { world } = fight;
  const body = world.require(e, Body);
  Object.assign(body.pos, state.pos);
  Object.assign(body.vel, state.vel);
  fight.physics.place(body.collider, body.pos);
  Object.assign(world.require(e, Player), state.player, { actionDir: { ...state.player.actionDir } });
  Object.assign(world.require(e, Health), state.health);
  Object.assign(world.require(e, Stamina), state.stamina);
  world.remove(e, ActiveHit);
}
