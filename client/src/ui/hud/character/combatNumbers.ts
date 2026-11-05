import {
  blessingsOf, coreStats, dodgeCost, drawCost, drawTime, feltHeft, FIXED_DT, gearBurden, guardOf, guardRaiseTime,
  GUARDS, isWeapon, ITEMS, knockbackTakenFactor, meleeOf, modsFrom, parryWindowTime, passivesOf, perfectBlockTime,
  rangedOf,
  staminaRegenPerSec, STRIKES, strikeCost, WEAPONS, windupTime, type Carried, type CoreState, type Faith,
  type GuardKind, type Hand, type MeleeMoves, type Strike, type Weapon, type WeaponId,
} from "@infinite-tower/shared";

export interface StrikeNumbers { windupTime: number; liveTime: number; recoverTime: number; stamina: number }

export interface HeldNumbers {
  hand: Hand;
  item: WeaponId;
  weight: number;
  heft: number;
  feltHeft: number;
  strikes: Record<Strike, StrikeNumbers> | null;
  parryTime: number | null;
  draw: { minTime: number; fullTime: number; stamina: number } | null;
}

export type GuardNumbers = (typeof GUARDS)[GuardKind] & {
  kind: GuardKind; raiseTime: number; perfectTime: number; arcDeg: number;
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
function strikeNumbers(weapon: Weapon, moves: MeleeMoves, strike: Strike, strength: number): StrikeNumbers {
  const steps = moves.steps(weapon, windupTime(strike, "opening"), strike === "heavy", strength);
  return {
    windupTime: steps.liveAt * FIXED_DT, liveTime: (steps.liveUntil - steps.liveAt) * FIXED_DT,
    recoverTime: (steps.endAt - steps.liveUntil) * FIXED_DT, stamina: strikeCost(weapon, strike, strength),
  };
}

function heldNumbers(hand: Hand, item: WeaponId, strength: number): HeldNumbers {
  const weapon = WEAPONS[item], melee = meleeOf(weapon), ranged = rangedOf(weapon);
  return {
    hand, item, weight: ITEMS[item].weight, heft: weapon.heft, feltHeft: feltHeft(weapon, strength),
    strikes: melee && Object.fromEntries(
      STRIKES.map((strike) => [strike, strikeNumbers(weapon, melee, strike, strength)]),
    ) as Record<Strike, StrikeNumbers>,
    parryTime: melee && parryWindowTime(weapon),
    draw: ranged && {
      minTime: drawTime(ranged, weapon, strength, "minTime"), fullTime: drawTime(ranged, weapon, strength, "fullTime"),
      stamina: drawCost(ranged, weapon, strength),
    },
  };
}

export function combatNumbers(gear: Carried, core: CoreState, faith: Faith): CombatNumbers {
  const stats = coreStats(core), { equipment } = gear, guarded = guardOf(equipment);
  const mods = modsFrom(passivesOf(core.inscriptions, blessingsOf(faith)));
  return {
    held: HANDS.flatMap((hand) => {
      const item = equipment[hand];
      return isWeapon(item) ? [heldNumbers(hand, item, stats.strength)] : [];
    }),
    guard: guarded && {
      kind: guarded.kind, ...GUARDS[guarded.kind], raiseTime: guardRaiseTime(guarded.guard, stats.strength),
      perfectTime: perfectBlockTime(guarded.guard),
      arcDeg: (2 * Math.acos(GUARDS[guarded.kind].minDot) * 180) / Math.PI,
    },
    dodgeStamina: dodgeCost(gearBurden(gear, stats)),
    staminaRegenPerSec: staminaRegenPerSec(stats, mods.staminaRegenFactor),
    knockbackTakenFactor: knockbackTakenFactor(stats) * mods.knockbackFactor,
  };
}
