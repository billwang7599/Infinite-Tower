import {
  emptyBag, packFor, IDLE_INPUT, newCore, type PlayerAction, type PlayerData, type SwingDir,
} from "@infinite-tower/shared";
import { armed } from "./armed.js";

export function playerDoing(action: PlayerAction, t: number, way: SwingDir | null = null): PlayerData {
  return {
    grounded: true, airTime: 0, last: IDLE_INPUT, perfectBlockLeft: 0, sinceBlockPress: 1, way, jumpBuffer: 0,
    attackBuffer: 0, dodgeBuffer: 0, castBuffer: 0, queued: null, castQueued: null, brokenOff: false, writing: null,
    using: null, book: [], burden: "light",
    gear: { bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment: armed() }, core: newCore(), action,
    actionTime: t, actionDir: { x: 0, z: 1 }, invulnerable: false, leftArena: false,
  };
}
