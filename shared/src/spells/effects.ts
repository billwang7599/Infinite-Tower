import type { Augment } from "./spell.js";

// Damages and heals are shares of D, a spell's base damage after intellect (spellDamage). All placeholders.
export const REACTIONS = ["conduct", "doused", "fanned", "eclipse"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const HARMFUL_STATUSES = ["burning", "wet", "rooted", "shocked", "marked", "cursed"] as const;
export const STATUSES = [
  ...HARMFUL_STATUSES, "shielded", "empowered", "warded", "hasted", "charged", "siphoning",
] as const;
export type Status = (typeof STATUSES)[number];

export const MAGIC = {
  damage: 10,
  castMoveFactor: 0.4,
  plain: { damage: 0.6 },
  bolt: { speedMps: 20, rangeM: 16, radiusM: 0.3, splitShare: 0.5, splitSpreadRad: 0.25 },
  // Held, a Beam pays its own words' cost times heldCostFactor a second.
  beam: { rangeM: 10, radiusM: 0.35, time: 1, tickTime: 0.5, tickShare: 0.5, heldCostFactor: 2 },
  nova: { radius: 3 },
  cloud: { time: 8, tickTime: 1, tickShare: 0.4 },
  imbue: { hits: 3, time: 8, share: 0.5 },
  // Each is per unit of augmentStrength: Amplify +50% damage, Extend +100% time, Split +2 Bolts, ...
  augments: {
    amplify: 0.5, widen: 0.5, extend: 1, swift: 0.5, delayTime: 1, splitBolts: 2, pierceTargets: 2,
    followTurnRadPerSec: 8,
  },
  objects: { perPlayer: 12, perFight: 60 },
  elements: {
    fire: { damage: 0.8, burnDamagePerSec: 0.25, burnTime: 4 },
    water: { damage: 0.5, wetTime: 6 },
    earth: { damage: 1.2, poiseDamage: 20, rootTime: 2, rootSlow: 0.6 },
    // About 3 m of push at an enemy's usual slowdown.
    air: { damage: 0.4, knockbackSpeed: 12 },
    lightning: { damage: 1, arcRange: 5, arcShare: 0.5, maxShocks: 3, shockTime: 5, stunTime: 1 },
    light: { damage: 0.5, markTime: 8 },
    darkness: { damage: 0.9, healShare: 0.2, curseTime: 6, cursedDamageFactor: 0.85 },
  },
  reactions: {
    conduct: { cooldown: 3, lightningFactor: 1.5, arcs: 2, arcRange: 6, arcShare: 0.5 },
    doused: { cooldown: 2 },
    fanned: { cooldown: 4, burnFactor: 2, spreadRange: 4 },
    eclipse: { cooldown: 5, damage: 1.5, radius: 3 },
  },
  self: {
    fire: { status: "empowered", time: 8, damageDealtFactor: 1.2 },
    water: { status: null, time: 0, heal: 0.3 },
    earth: { status: "warded", time: 6, damageTakenFactor: 0.7 },
    air: { status: "hasted", time: 5, moveFactor: 1.3, dodgeCostFactor: 0.7 },
    lightning: { status: "charged", time: 5, staminaRegenFactor: 1.5 },
    light: { status: "shielded", time: 6, shield: 1 },
    darkness: { status: "siphoning", time: 8, healShare: 0.1 },
  },
} as const;

// Repeats give 100%, then 50%, then 25%, ...
export const augmentStrength = (augments: readonly Augment[], augment: Augment): number =>
  augments.filter((a) => a === augment).reduce((sum, _a, i) => sum + 0.5 ** i, 0);
