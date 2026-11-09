import {
  appliedStrength, blessingsOf, blockStaminaShare, coreStats, dodgeCost, drawCost, drawTime, FIXED_DT,
  gearBurden, gripOf, guardOf, guardRaiseTime, GUARDS, isWeapon, ITEMS, knockbackTakenFactor, loosedDamage, meleeOf,
  modsFrom, parryWindowTime, passivesOf, perfectBlockTime, rangedOf, scaleDamage, staminaRegenPerSec, STRIKES,
  strikeCost, strikeDamage, WEAPONS, windupTime, type Carried, type CoreState, type Damage, type Faith, type Grip,
  type GuardKind, type Hand, type MeleeMoves, type Stats, type Strike, type Weapon, type WeaponId,
} from "@infinite-tower/shared";

export interface StrikeNumbers {
  windupTime: number; liveTime: number; recoverTime: number; stamina: number; damage: Damage;
}

export interface HeldNumbers {
  hand: Hand;
  item: WeaponId;
  grip: Grip;
  appliedStrength: number;
  weight: number;
  heft: number;
  minStrength: number;
  strikes: Record<Strike, StrikeNumbers> | null;
  parryTime: number | null;
  draw: { minTime: number; fullTime: number; stamina: number; damage: Damage } | null;
}

export type GuardNumbers = (typeof GUARDS)[GuardKind] & {
  kind: GuardKind; grip: Grip; raiseTime: number; perfectTime: number; arcDeg: number;
  blockStaminaShare: number;
};

export interface CombatNumbers {
  held: HeldNumbers[];
  guard: GuardNumbers | null;
  /** null: too loaded to dodge. */
  dodgeStamina: number | null;
  staminaRegenPerSec: number;
  knockbackTakenFactor: number;
}

const HANDS: readonly Hand[] = ["rightHand", "leftHand"];

// A chain's first strike: later ones wind up by how they follow the last.
function strikeNumbers(
  weapon: Weapon, moves: MeleeMoves, strike: Strike, stats: Stats, dealtFactor: number,
): StrikeNumbers {
  const { strength } = stats, steps = moves.steps(weapon, windupTime(strike, "opening"), strike === "heavy");
  return {
    windupTime: steps.liveAt * FIXED_DT, liveTime: (steps.liveUntil - steps.liveAt) * FIXED_DT,
    recoverTime: (steps.endAt - steps.liveUntil) * FIXED_DT, stamina: strikeCost(weapon, strike, strength),
    damage: scaleDamage(strikeDamage(weapon, strike, 1, stats), dealtFactor),
  };
}

function heldNumbers(hand: Hand, item: WeaponId, grip: Grip, stats: Stats, dealtFactor: number): HeldNumbers {
  const weapon = WEAPONS[item], melee = meleeOf(weapon), ranged = rangedOf(weapon), { strength } = stats;
  const fullTime = ranged ? drawTime(ranged, weapon, "fullTime") : 0;
  return {
    hand, item, grip, appliedStrength: strength, weight: ITEMS[item].weight, heft: weapon.heft,
    minStrength: weapon.minStrength,
    strikes: melee && Object.fromEntries(
      STRIKES.map((strike) => [strike, strikeNumbers(weapon, melee, strike, stats, dealtFactor)]),
    ) as Record<Strike, StrikeNumbers>,
    parryTime: melee && parryWindowTime(weapon),
    draw: ranged && {
      minTime: drawTime(ranged, weapon, "minTime"), fullTime, stamina: drawCost(ranged, weapon, strength),
      damage: scaleDamage(loosedDamage(ranged, weapon, fullTime, stats), dealtFactor),
    },
  };
}

export function combatNumbers(gear: Carried, core: CoreState, faith: Faith): CombatNumbers {
  const stats = coreStats(core), { equipment } = gear, guarded = guardOf(equipment), grip = gripOf(equipment);
  const mods = modsFrom(passivesOf(core.inscriptions, blessingsOf(faith)));
  const applied = { ...stats, strength: appliedStrength(equipment, stats.strength) };
  return {
    held: HANDS.flatMap((hand) => {
      const item = equipment[hand];
      return isWeapon(item) && grip ? [heldNumbers(hand, item, grip, applied, mods.damageDealtFactor)] : [];
    }),
    guard: guarded && grip && {
      kind: guarded.kind, grip, ...GUARDS[guarded.kind], raiseTime: guardRaiseTime(guarded.guard),
      perfectTime: perfectBlockTime(guarded.guard),
      arcDeg: (2 * Math.acos(GUARDS[guarded.kind].minDot) * 180) / Math.PI,
      blockStaminaShare: blockStaminaShare(GUARDS[guarded.kind], applied.strength),
    },
    dodgeStamina: dodgeCost(gearBurden(gear, stats)),
    staminaRegenPerSec: staminaRegenPerSec(stats, mods.staminaRegenFactor),
    knockbackTakenFactor: knockbackTakenFactor(stats) * mods.knockbackFactor,
  };
}
