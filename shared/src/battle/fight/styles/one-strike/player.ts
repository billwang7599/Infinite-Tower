import { beatCost, ONE_STRIKE, thrustCost } from "../../../../weapons/one-strike.js";
import { Body, OneStrike } from "../../../components.js";
import { PLAYER } from "../../../player.js";
import { spend, startAction } from "../../player/controller.js";
import { startStrikeSwing } from "../../weapons/swing.js";
import type { Style, SwordTurn } from "../styles.js";
import { lineOf } from "./blade.js";

function read({ world, e, player, input, wielder, dt }: SwordTurn): void {
  const blade = world.require(e, OneStrike);
  if (input.line) blade.want = input.line;
  const pressed = (input.attack === "light" || input.attack === "heavy") && input.attack !== player.attackHeld;
  if (pressed) {
    player.queued = input.attack;
    player.attackBuffer = PLAYER.inputBuffer;
  } else if (!wielder.swing && blade.moveSteps === 0) player.attackBuffer = Math.max(0, player.attackBuffer - dt);
  player.attackHeld = input.attack;
}

function pickup({ world, e, player, input }: SwordTurn): boolean {
  const blade = world.require(e, OneStrike), loose = blade.loose, at = world.require(e, Body).pos;
  if (!loose || player.action !== "none" || !player.grounded) return false;
  if (Math.hypot(loose.x - at.x, loose.z - at.z) > ONE_STRIKE.pickup.reachM) return false;
  startAction(world, e, player, "pickup", input.aimX, input.aimZ);
  blade.pickupStep = 0;
  return true;
}

function strike(t: SwordTurn): boolean {
  const { world, e, player, input, wielder, stamina, weapon } = t;
  const blade = world.require(e, OneStrike), dir = { x: input.aimX, z: input.aimZ };
  if (!t.free || wielder.swing || !weapon || player.attackBuffer <= 0 || stamina.value <= 0) return false;
  if (blade.loose) {
    if (player.queued !== "light") return false;
    startAction(world, e, player, "attack", dir.x, dir.z);
    startStrikeSwing(world, e, 1, "punch", null, dir);
  } else {
    const line = lineOf(world, e);
    if (line === null || blade.want !== line) return false;
    if (player.queued === "light") {
      startAction(world, e, player, "attack", dir.x, dir.z);
      startStrikeSwing(world, e, weapon.heft, "thrust", line, dir);
      spend(stamina, thrustCost(weapon));
    } else if (player.queued === "heavy") {
      startAction(world, e, player, "beat", dir.x, dir.z);
      blade.beatStep = 0;
      spend(stamina, beatCost(weapon));
    } else return false;
  }
  player.attackBuffer = 0;
  return true;
}

export const ONE_STRIKE_PLAYER: Pick<Style, "read" | "first" | "last"> = { read, first: pickup, last: strike };
