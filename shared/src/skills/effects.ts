import type { Segment, SkillElement } from "./skill.js";
import type { Status } from "../battle/statuses.js";

// Damages and heals are shares of D, a skill's base damage after skillpower (skillDamage). All placeholders.
export const REACTIONS = ["conduct", "doused", "fanned", "eclipse"] as const;
export type Reaction = (typeof REACTIONS)[number];

interface Fusion {
  elements: readonly [SkillElement, SkillElement];
  status: Status;
  time: number;
  healPerSec: number;
}

export const SKILL_EFFECTS = {
  damage: 10,
  castMoveFactor: 0.4,
  plain: { damage: 0.6 },
  bolt: {
    speedMps: 20, rangeM: 16, radiusM: 0.3,
    splitDamageFactor: 0.9, splitRadiusFactor: 0.8,
    // Split Bolts start in an upright circle round the caster, its radius splitRingPerRootM × √bolts within these.
    splitRingMinM: 1.5, splitRingMaxM: 3, splitRingPerRootM: 0.75, splitGroundM: 0.3,
    splitGapRadii: 2, splitSpotTries: 8,
    splitFocusM: 10, splitJitterM: 0.5,
    // Homing split Bolts aim side by side, this many radii apart, at their target, closing in over its last metres.
    followGapRadii: 4, followRowMaxM: 3, followMergeM: 2.5,
  },
  // Held, a Beam pays its own words' cost times heldCostFactor a second.
  beam: { rangeM: 10, radiusM: 0.35, time: 1, tickTime: 0.5, tickShare: 0.5, heldCostFactor: 2 },
  nova: { radius: 3 },
  cloud: { time: 8, tickTime: 1, tickShare: 0.4 },
  imbue: { hits: 3, time: 8, share: 0.5 },
  // Per modifier word: Amplify +50% damage, Extend +100% time, Delay +1 s, Pierce +2 enemies, ...
  modifiers: {
    amplify: 0.5, widen: 0.5, extend: 1, swift: 0.5, delayTime: 1, pierceTargets: 2,
    followTurnRadPerSec: 3,
  },
  objects: { perPlayer: 12, perFight: 60 },
  elements: {
    fire: { damage: 0.8, burnDamagePerSec: 0.25, burnTime: 4 },
    water: { damage: 0.5, wetTime: 6 },
    earth: { damage: 1.2, poiseDamage: 20, rootTime: 2 },
    // About 3 m of push at an enemy's usual slowdown.
    air: { damage: 0.4, knockbackSpeed: 12 },
    lightning: { damage: 1, arcRange: 5, arcShare: 0.5, shockTime: 5, stunTime: 1 },
    light: { damage: 0.5, markTime: 8 },
    darkness: { damage: 0.9, healShare: 0.2, curseTime: 6 },
  },
  reactions: {
    conduct: { cooldown: 3, lightningFactor: 1.5, arcs: 2, arcRange: 6, arcShare: 0.5 },
    doused: { cooldown: 2 },
    fanned: { cooldown: 4, burnFactor: 2, spreadRange: 4 },
    eclipse: { cooldown: 5, damage: 1.5, radius: 3 },
  },
  // `shield`, `heal` and `healPerSec` are shares of D.
  self: {
    fire: { status: "empowered", time: 8 },
    water: { status: null, time: 0, heal: 0.3 },
    earth: { status: "warded", time: 6 },
    air: { status: "hasted", time: 5 },
    lightning: { status: "charged", time: 5 },
    light: { status: "shielded", time: 6, shield: 1 },
    darkness: { status: "siphoning", time: 8 },
  },
  fusions: [
    { elements: ["fire", "air"], status: "frenzy", time: 10, healPerSec: 0 },
    { elements: ["water", "light"], status: "renewal", time: 8, healPerSec: 0.2 },
    { elements: ["earth", "lightning"], status: "bulwark", time: 6, healPerSec: 0 },
    { elements: ["darkness", "fire"], status: "bloodrage", time: 8, healPerSec: 0 },
  ] as readonly Fusion[],
} as const;

// A guard on the server's work, not a game rule: past it, new skill objects don't spawn.
export const MAX_LIVE_SHOTS = 256;

export interface Shot {
  bolts: number;
  boltRadiusM: number;
  damageFactor: number;
  widenFactor: number;
  longerFactor: number;
  /** 0: no cloud. */
  cloudTime: number;
  swiftFactor: number;
  delayTime: number;
  pierceTargets: number;
  followTurnRadPerSec: number;
}

export function shotOf(segment: Segment): Shot {
  const A = SKILL_EFFECTS.modifiers, B = SKILL_EFFECTS.bolt;
  const shot: Shot = {
    bolts: 1, boltRadiusM: B.radiusM, damageFactor: 1, widenFactor: 1, longerFactor: 1, cloudTime: 0,
    swiftFactor: 1, delayTime: 0, pierceTargets: 0, followTurnRadPerSec: 0,
  };
  for (const modifier of segment.modifiers) {
    switch (modifier) {
      case "amplify": shot.damageFactor *= 1 + A.amplify; break;
      case "widen": shot.widenFactor *= 1 + A.widen; break;
      case "extend":
        shot.longerFactor *= 1 + A.extend;
        shot.cloudTime = shot.cloudTime === 0 ? SKILL_EFFECTS.cloud.time : shot.cloudTime * (1 + A.extend);
        break;
      case "swift": shot.swiftFactor *= 1 + A.swift; break;
      case "delay": shot.delayTime += A.delayTime; break;
      case "pierce": shot.pierceTargets += A.pierceTargets; break;
      case "follow": shot.followTurnRadPerSec += A.followTurnRadPerSec; break;
      case "split":
        shot.bolts *= 2;
        shot.boltRadiusM *= B.splitRadiusFactor;
        shot.damageFactor *= B.splitDamageFactor;
        break;
    }
  }
  return shot;
}
