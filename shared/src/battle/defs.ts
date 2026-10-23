/**
 * Shapes of server-owned content. The values live in server/src/content and reach the client in
 * messages (the client needs them to draw and, for now, to run the fight).
 */

export interface ArenaDef {
  radius: number;
}

export interface BoarAttackDef {
  range: number;
  /** Minimum cos(angle) to the target: the width of the hit arc. */
  minDot: number;
  windup: number;
  recover: number;
  damage: number;
  knockback: number;
  lift: number;
  cooldown: number;
}

export interface BoarDef {
  name: string;
  maxHp: number;
  radius: number;
  mass: number;
  walkSpeed: number;
  /** rad/s */
  turnRate: number;
  /** Poise breaks after enough hits in quick succession -> stagger. */
  poise: number;
  poiseRegen: number;
  staggerTime: number;
  gore: BoarAttackDef & {
    /** Start the attack within this center distance. */
    trigger: number;
    active: number;
    lunge: number;
  };
  charge: BoarAttackDef & {
    minDist: number;
    maxDist: number;
    /** Stops tracking the player this long before the charge starts: the dodge cue. */
    lockAt: number;
    speed: number;
    maxTime: number;
    /** Stunned this long after slamming into the arena wall. */
    stun: number;
  };
}
