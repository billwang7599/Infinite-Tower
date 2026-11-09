import {
  appliedStrength, damp, drawnShare, FighterStats, isMelee, Player, weaponIn, Wielder, type Entity, type World,
} from "@infinite-tower/shared";

export interface BowDraw { drawn: number; nocked: boolean; loosedTime: number | null }

export function bowDrawOf(world: World, e: Entity): BowDraw | null {
  const player = world.get(e, Player), hands = world.require(e, Wielder).hands, weapon = weaponIn(hands);
  if (!weapon || isMelee(weapon)) return null;
  const loosedTime = player?.action === "loose" ? player.actionTime : null;
  if (player?.action !== "draw") return { drawn: 0, nocked: false, loosedTime };
  const strength = appliedStrength(hands, world.get(e, FighterStats)?.strength ?? 0);
  const drawn = drawnShare(weapon, player.actionTime, strength);
  return { drawn, nocked: true, loosedTime: null };
}

export const BOW_MOTION = {
  raiseRate: 26, handRate: 40, flickRate: 30, snap: { share: 0.15, hz: 12, decayTime: 0.05 },
} as const;

export interface BowMotion {
  raise: number; raiseVel: number; hand: number; handVel: number; goal: number; string: number; flick: number;
  loosed: boolean; sinceLoose: number;
}

export const restingBow = (): BowMotion => ({
  raise: 0, raiseVel: 0, hand: 0, handVel: 0, goal: 0, string: 0, flick: 0, loosed: false, sinceLoose: 1,
});

export const shownPull = (drawn: number): number => 1 - (1 - drawn) ** 2;

function spring(x: number, vel: number, goal: number, rate: number, dt: number): [number, number] {
  const off = x - goal, fade = Math.exp(-rate * dt), k = (vel + rate * off) * dt;
  return [goal + (off + k) * fade, (vel - rate * k) * fade];
}

export function moveBow(m: BowMotion, draw: BowDraw | null, dt: number): void {
  const nocked = draw?.nocked ?? false, loosedTime = draw?.loosedTime ?? null;
  if (nocked) {
    m.loosed = false;
    m.goal = shownPull(draw!.drawn);
  } else if (loosedTime !== null && !m.loosed) {
    m.loosed = true;
    m.goal = m.hand;
    m.handVel = 0;
  } else if (!m.loosed) m.goal = 0;
  m.sinceLoose = loosedTime ?? m.sinceLoose + dt;
  [m.raise, m.raiseVel] = spring(m.raise, m.raiseVel, nocked || loosedTime !== null ? 1 : 0, BOW_MOTION.raiseRate, dt);
  [m.hand, m.handVel] = spring(m.hand, m.handVel, m.goal, BOW_MOTION.handRate, dt);
  if (nocked || loosedTime !== null) m.flick = damp(m.flick, nocked ? 0 : 1, BOW_MOTION.flickRate, dt);
  const { share, hz, decayTime } = BOW_MOTION.snap, t = m.sinceLoose;
  m.string = m.loosed ? -share * m.goal * Math.exp(-t / decayTime) * Math.sin(2 * Math.PI * hz * t)
    : nocked ? Math.min(m.hand, m.goal) : m.hand;
}
