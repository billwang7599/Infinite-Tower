import { Body, dampFactor, type System } from "@infinite-tower/shared";
import { BodyNode, DrawOffset } from "../components.js";

/** How fast a correction's offset eases away (about 1/rate seconds). */
const CORRECTION_EASE_RATE = 15;

/** Per render frame: each fighter's drawing goes where the fight left its body (plus your easing correction). */
export function followSystem(): System {
  return (world, dt) => {
    for (const [, { node }, { pos }] of world.query(BodyNode, Body)) node.position.set(pos.x, pos.y, pos.z);
    const k = 1 - dampFactor(CORRECTION_EASE_RATE, dt);
    for (const [, { node }, offset] of world.query(BodyNode, DrawOffset)) {
      offset.x *= k;
      offset.y *= k;
      offset.z *= k;
      node.position.addInPlaceFromFloats(offset.x, offset.y, offset.z);
    }
  };
}
