import { clamp } from "../core/math.js";
import { FIXED_DT } from "../core/time.js";
import type { Hand } from "../items/gear.js";
import { ITEMS, type ItemId } from "../items/items.js";
import type { SwingData } from "../battle/components.js";

// Named by their way across the screen as the player sees it ("tlbr": top-left to bottom-right), an enemy's too, so
// a swing is parried by its reverse ("lr" by "rl"): the blades meet.
export const SWING_DIRS = ["lr", "rl", "tb", "bt", "tlbr", "brtl", "trbl", "bltr"] as const;
export type SwingDir = (typeof SWING_DIRS)[number];
export const ATTACK_KINDS = [...SWING_DIRS, "stab"] as const;
export type AttackKind = (typeof ATTACK_KINDS)[number];

type SwingLine = "horizontal" | "vertical" | "falling" | "rising";

const LINE: Record<SwingDir, SwingLine> = {
  lr: "horizontal", rl: "horizontal", tb: "vertical", bt: "vertical",
  tlbr: "falling", brtl: "falling", trbl: "rising", bltr: "rising",
};
const REVERSE: Record<SwingDir, SwingDir> = {
  lr: "rl", rl: "lr", tb: "bt", bt: "tb", tlbr: "brtl", brtl: "tlbr", trbl: "bltr", bltr: "trbl",
};

/** As the player sees it: x right, y up. */
export const SCREEN_DIR: Record<SwingDir, { x: number; y: number }> = {
  lr: { x: 1, y: 0 }, rl: { x: -1, y: 0 }, tb: { x: 0, y: -1 }, bt: { x: 0, y: 1 },
  tlbr: { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, brtl: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  trbl: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, bltr: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
};

export const isSwing = (attack: AttackKind): attack is SwingDir => attack !== "stab";
export const lineOf = (dir: SwingDir): SwingLine => LINE[dir];
export const reverseOf = (dir: SwingDir): SwingDir => REVERSE[dir];

export const WEAPON_KINDS = ["sword"] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

export interface Weapon {
  kind: WeaponKind;
  /** The blade (m): every attack's reach grows with it. */
  length: number;
  mass: number;
  /** From the hand to its centre of mass (m). */
  balanceM: number;
  /** At the starter sword's momentum. */
  damage: number;
}

export const WEAPONS = {
  sword: { kind: "sword", length: 1.1, mass: ITEMS.sword.weight, balanceM: 0.25, damage: 9 },
  "kobold-blade": { kind: "sword", length: 1.1, mass: ITEMS["kobold-blade"].weight, balanceM: 0.25, damage: 14 },
  longsword: { kind: "sword", length: 1.4, mass: ITEMS.longsword.weight, balanceM: 0.3, damage: 11 },
  greatsword: { kind: "sword", length: 1.9, mass: ITEMS.greatsword.weight, balanceM: 0.45, damage: 16 },
  "kobold-greatsword": {
    kind: "sword", length: 1.9, mass: ITEMS["kobold-greatsword"].weight, balanceM: 0.45, damage: 14,
  },
} as const satisfies Partial<Record<ItemId, Weapon>>;
export type WeaponId = keyof typeof WEAPONS;

export const isWeapon = (item: ItemId | null): item is WeaponId => item !== null && Object.hasOwn(WEAPONS, item);

/** The right hand's first. */
export const weaponItemIn = (hands: Record<Hand, ItemId | null>): WeaponId | null =>
  isWeapon(hands.rightHand) ? hands.rightHand : isWeapon(hands.leftHand) ? hands.leftHand : null;

export function weaponIn(hands: Record<Hand, ItemId | null>): Weapon | null {
  const item = weaponItemIn(hands);
  return item && WEAPONS[item];
}

/**
 * Each line's hit shape: its reach as a share of arm plus blade, and its arc (degrees, all of it). Horizontal
 * swings are wide and short, vertical ones narrow and long; the stab is a ray `STAB_WIDTH` either side.
 */
const SHAPES: Record<SwingLine, { reachFactor: number; arcDeg: number }> = {
  horizontal: { reachFactor: 1, arcDeg: 160 },
  falling: { reachFactor: 1.15, arcDeg: 110 },
  rising: { reachFactor: 1.15, arcDeg: 110 },
  vertical: { reachFactor: 1.3, arcDeg: 60 },
};
const STAB_REACH_FACTOR = 1.75;
const STAB_WIDTH = 0.15;

/**
 * What an attack hits. An arc: targets whose surface is within `range` of the attacker's center, no more than the
 * angle `minDot` (a cosine) off the aim. A ray: within `width` of the line from the center `range` along the aim.
 */
export interface HitShape { shape: "arc" | "ray"; range: number; minDot: number; width: number }

export function attackShape(attack: AttackKind, armReachM: number, weapon: Pick<Weapon, "length">): HitShape {
  const reach = armReachM + weapon.length;
  if (!isSwing(attack)) return { shape: "ray", range: reach * STAB_REACH_FACTOR, minDot: 1, width: STAB_WIDTH };
  const { reachFactor, arcDeg } = SHAPES[LINE[attack]];
  return { shape: "arc", range: reach * reachFactor, minDot: Math.cos((arcDeg / 2) * (Math.PI / 180)), width: 0 };
}

/** The starter sword's at strength 10, × the time factor: from rest a swing is set, then driven to impact. */
export const SWING = {
  setTime: 0.15,
  driveTime: 0.2,
  stabDrawTime: 0.2,
  /** A blade moving its way loops round to the swing's start this long, at its own from-rest impact speed. */
  loopTime: 0.1,
  activeTime: 0.1,
  gapTime: 0.25,
  maxFlow: 1.25,
  /** Braking a blade costs this share of what giving it as much energy would. */
  brakeEffort: 0.5,
  minTimeFactor: 0.5,
  maxTimeFactor: 3,
} as const;

/** In the screen plane: ±1 a swing's ends, 0 the guard; velocity in shares of the weapon's from-rest impact speed. */
export interface Blade { x: number; y: number; vx: number; vy: number }
export const restingBlade = (): Blade => ({ x: 0, y: 0, vx: 0, vy: 0 });

export function followingBlade(attack: AttackKind, speed: number): Blade {
  if (!isSwing(attack)) return restingBlade();
  const way = SCREEN_DIR[attack];
  return { x: way.x, y: way.y, vx: way.x * speed, vy: way.y * speed };
}

const STARTER: Weapon = WEAPONS.sword;
const AVERAGE_STRENGTH = 10;
// About the hand: the balance point's mass, plus the blade's own as a rod.
const inertiaOf = (w: Weapon): number => w.mass * (w.balanceM * w.balanceM + (w.length * w.length) / 12);

export interface SwingPlan {
  windupTime: number;
  driveTime: number;
  followTime: number;
  timeFactor: number;
  /** In shares of the from-rest impact speed, as is `flow`. */
  startSpeed: number;
  flow: number;
  /** Against the starter sword's opening swing at strength 10, as is `effort` (energy added, braking too). */
  momentum: number;
  effort: number;
}

/** From a speed of u the drive ends at √(u² + 1), capped at maxFlow. */
export function planSwing(weapon: Weapon, strength: number, blade: Blade, attack: AttackKind): SwingPlan {
  const inertia = inertiaOf(weapon) / inertiaOf(STARTER);
  const rawTimeFactor = Math.sqrt(inertia / (strength / AVERAGE_STRENGTH));
  const timeFactor = clamp(rawTimeFactor, SWING.minTimeFactor, SWING.maxTimeFactor);
  const massRatio = weapon.mass / STARTER.mass;
  const speedFactor = Math.sqrt(Math.sqrt(strength / AVERAGE_STRENGTH)) / Math.sqrt(massRatio);
  // Too heavy to swing in the clamped time: the wielder pays for the speed it lacks.
  const lacking = Math.max(1, rawTimeFactor / timeFactor);
  const heft = inertia * speedFactor * speedFactor * lacking * lacking;
  const speed = Math.hypot(blade.vx, blade.vy), { driveTime } = SWING;
  const plan = (prep: number, startSpeed: number, braked: number): SwingPlan => {
    const flow = Math.max(startSpeed, Math.min(SWING.maxFlow, Math.hypot(startSpeed, 1)));
    const drive = driveTime / (startSpeed + flow);
    return {
      windupTime: (prep + drive) * timeFactor, driveTime: drive * timeFactor, followTime: flow * driveTime * timeFactor,
      timeFactor, startSpeed, flow, momentum: massRatio * speedFactor * flow,
      effort: heft * (1 + SWING.brakeEffort * braked * braked),
    };
  };

  if (!isSwing(attack)) return plan(speed * driveTime + SWING.stabDrawTime, 0, speed);
  const way = SCREEN_DIR[attack];
  const stopped = plan(speed * driveTime + SWING.setTime * Math.sqrt(Math.hypot(way.x + blade.x, way.y + blade.y)), 0,
    speed);
  const carried = blade.vx * way.x + blade.vy * way.y;
  if (carried <= 0) return stopped;
  const sideways = Math.hypot(blade.vx - way.x * carried, blade.vy - way.y * carried);
  const looped = plan(sideways * driveTime + SWING.loopTime / carried, carried, sideways);
  return looped.windupTime < stopped.windupTime ? looped : stopped;
}

/** `turn`: share of the half-turn from start to far side (from rest: a third driven, live, follow-through each). */
export function strokeOf(swing: SwingData): { set: number; turn: number; follow: number } {
  const step = Math.min(swing.step, swing.stoppedAt ?? Infinity);
  const { driveAt, liveAt, liveUntil, endAt, startSpeed: u, flow: v } = swing;
  const driveSteps = Math.max(1, liveAt - driveAt), stroke = ((u + v) / 2) * driveSteps;
  if (step < driveAt) return { set: step / driveAt, turn: 0, follow: 0 };
  const s = Math.min(1, (step - driveAt) / driveSteps);
  let gone = (u * s + ((v - u) / 2) * s * s) * driveSteps;
  const live = Math.min(step, liveUntil) - liveAt;
  if (live > 0) gone += v * live;
  const followSteps = Math.max(1, endAt - liveUntil), f = clamp((step - liveUntil) / followSteps, 0, 1);
  if (f > 0) gone += v * followSteps * (f - (f * f) / 2);
  return { set: 1, turn: gone / stroke / 3, follow: f };
}

export function stoppedBlade(swing: SwingData): Blade {
  if (!isSwing(swing.attack)) return restingBlade();
  const way = SCREEN_DIR[swing.attack], along = -Math.cos(Math.PI * strokeOf(swing).turn);
  return { x: way.x * along, y: way.y * along, vx: 0, vy: 0 };
}

/** The step of an attack (0 is the step it starts on) its blade goes live on, for a start of `startup` seconds. */
export const liveStep = (startup: number): number => Math.round(startup / FIXED_DT);

/** The first step on which a clock counted up by FIXED_DT from 0 reaches `seconds` (as a state's clock does). */
export function stepsUntil(seconds: number): number {
  let t = 0, steps = 0;
  for (; t < seconds; steps++) t += FIXED_DT;
  return steps;
}

export const PARRY = {
  /** A swing is parried when the reverse swing's blade went live no more than this long before it lands. */
  window: 0.15,
  /** × the blades' momentum ratio, clamped. Knocked back this far (m), taking this much more damage. */
  stunTime: 1,
  minStunScale: 0.5,
  maxStunScale: 2,
  knockbackDist: 1.5,
  bonusDamage: 1.5,
  /** How fast (m/s²) the knocked-back attacker slides to a stop. */
  slideDecel: 30,
  /** A player parried by an enemy is staggered this long, knocked back at this speed (m/s). */
  playerStaggerTime: 0.5,
  playerKnockbackSpeed: 6,
  /** Only an attacker within this cosine of where the parrier faces can be parried. */
  minDot: 0.5,
} as const;
