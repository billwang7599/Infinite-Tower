import type { System } from "../../../core/ecs.js";
import { turnToward } from "../../../core/math.js";
import { skillCost, wordsOf, type Skill } from "../../../skills/skill.js";
import { Enemy, SkillAttack, SkillObject, Skilled, Stamina } from "../../components.js";
import { FighterStats, staminaRegenPerSec } from "../../stats.js";
import { PLAYER } from "../../player.js";
import { chant, interrupt, releaseChant, startCast } from "../skills/skilled.js";
import { approachSpeed } from "./brain.js";
import { enter, roll } from "./common.js";

/** Starts only when facing the target this squarely (cos of the angle). */
const MIN_FACING_DOT = 0.8;

export function skillAttackSystem(): System {
  return (world, dt) => {
    const casters = world.query(SkillAttack, Enemy, Skilled, Stamina, FighterStats);
    for (const [e, attack, enemy, skilled, stamina, stats] of casters) {
      const def = attack.def, sense = enemy.sense;
      if (enemy.state === "approach" || enemy.state === "skillChant" || enemy.state === "skillCast") {
        skilled.aim = { x: Math.sin(sense.toYaw), z: Math.cos(sense.toYaw) };
      }
      switch (enemy.state) {
        case "approach": {
          if ([...world.query(SkillObject)].some(([, o]) => o.caster === e)) break;
          attack.cooldown -= dt;
          const ready = sense.targetAlive && attack.cooldown <= 0 && sense.dist <= def.rangeM;
          if (!ready || sense.facingDot < MIN_FACING_DOT) break;
          const modifiers = def.extras.filter((extra) => roll(enemy) < extra.chance).map((extra) => extra.modifier);
          const skill: Skill = { segments: [{ ...def.skill, modifiers: [...def.skill.modifiers, ...modifiers] }] };
          if (stamina.value < skillCost(skill)) break;
          attack.cooldown = def.cooldown;
          if (sense.dist <= def.quickCastM) {
            if (startCast(world, e, skill)) enter(world, e, enemy, "skillCast");
          } else {
            attack.toSay = wordsOf(skill);
            chant(world, e, []);
            enter(world, e, enemy, "skillChant");
          }
          break;
        }
        case "skillChant": {
          enemy.yaw = turnToward(enemy.yaw, sense.toYaw, enemy.def.turnRate * dt);
          enemy.move.speed = Math.min(0, approachSpeed(enemy, stats));
          if (!skilled.chanting) {
            enter(world, e, enemy, "approach");
            break;
          }
          const said = Math.floor(enemy.stateTime / def.wordTime + 1e-6);
          if (said > attack.toSay.length) {
            if (releaseChant(world, e)) enter(world, e, enemy, "skillCast");
            else {
              interrupt(skilled);
              enter(world, e, enemy, "approach");
            }
          } else if (said > skilled.words.length) chant(world, e, attack.toSay.slice(0, said));
          break;
        }
        case "skillCast":
          enemy.yaw = turnToward(enemy.yaw, sense.toYaw, enemy.def.turnRate * dt);
          if (!skilled.casting) enter(world, e, enemy, "approach");
          break;
      }
      // Stamina comes back as a player's does: not while winding up, and only a while after.
      if (enemy.state === "skillCast") stamina.regenDelay = PLAYER.staminaRegenDelay;
      else if (stamina.regenDelay > 0) stamina.regenDelay -= dt;
      else {
        const regenPerSec = staminaRegenPerSec(PLAYER.staminaRegenPerSec, stats);
        stamina.value = Math.min(stamina.max, stamina.value + regenPerSec * dt);
      }
    }
  };
}
