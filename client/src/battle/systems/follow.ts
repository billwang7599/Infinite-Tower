import { Body, type System } from "@infinite-tower/shared";
import { BodyNode } from "../components.js";

/** Per render frame: each fighter's drawing goes where the fight left its body. */
export function followSystem(): System {
  return (world) => {
    for (const [, { node }, { pos }] of world.query(BodyNode, Body)) node.position.set(pos.x, pos.y, pos.z);
  };
}
