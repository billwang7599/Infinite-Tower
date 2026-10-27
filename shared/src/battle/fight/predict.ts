/**
 * One predicted step of one player (Fight.predict): the parts of a fight's step that are that player's own, in the
 * same order, so with nobody touching them it comes out exactly as the server's step does.
 */
import type { Entity, World } from "../../core/ecs.js";
import { Body, Health, Player } from "../components.js";
import { tickHealthTimers } from "./combat.js";
import type { ArenaPhysics } from "./physics/arena-physics.js";
import { predictMove } from "./physics/move.js";
import { controlPlayer } from "./player/controller.js";
import { groundPlayer } from "./player/ground.js";

export function predictPlayer(world: World, physics: ArenaPhysics, e: Entity, dt: number): void {
  controlPlayer(world, e, dt);
  predictMove(physics, world, e, dt);
  groundPlayer(physics, world.require(e, Player), world.require(e, Body), dt);
  tickHealthTimers(world.require(e, Health), dt);
}
