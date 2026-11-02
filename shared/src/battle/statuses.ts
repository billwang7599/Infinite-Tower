export interface StatMods {
  damageDealtFactor: number;
  damageTakenFactor: number;
  moveFactor: number;
  dodgeCostFactor: number;
  attackCostFactor: number;
  staminaRegenFactor: number;
  knockbackFactor: number;
  stunTimeFactor: number;
  lifesteal: number;
  weaponLifesteal: number;
  weaponBurnPerSec: number;
  burnTakenFactor: number;
  /** HP paid for each point of stamina an attack or dodge costs beyond what's left; 0: none can be. */
  hpPerStaminaShort: number;
}

const ADDED: readonly (keyof StatMods)[] = ["lifesteal", "weaponLifesteal", "weaponBurnPerSec", "hpPerStaminaShort"];

export const NO_MODS: Readonly<StatMods> = {
  damageDealtFactor: 1, damageTakenFactor: 1, moveFactor: 1, dodgeCostFactor: 1, attackCostFactor: 1,
  staminaRegenFactor: 1, knockbackFactor: 1, stunTimeFactor: 1, lifesteal: 0, weaponLifesteal: 0,
  weaponBurnPerSec: 0, burnTakenFactor: 1, hpPerStaminaShort: 0,
};

// "absorbs": its amount soaks up damage (a shield); the others hurt or heal their amount a second.
export type StatusAmount = "absorbs" | "hurtsPerSec" | "healsPerSec";

export interface StatusDef {
  harmful: boolean;
  mods?: Partial<StatMods>;
  maxStacks?: number;
  amount?: StatusAmount;
}

export const STATUS_DEFS = {
  burning: { harmful: true, amount: "hurtsPerSec" },
  wet: { harmful: true },
  rooted: { harmful: true, mods: { moveFactor: 0.4 } },
  shocked: { harmful: true, maxStacks: 3 },
  marked: { harmful: true },
  cursed: { harmful: true, mods: { damageDealtFactor: 0.85 } },
  shielded: { harmful: false, amount: "absorbs" },
  empowered: { harmful: false, mods: { damageDealtFactor: 1.2 } },
  warded: { harmful: false, mods: { damageTakenFactor: 0.7, knockbackFactor: 0 } },
  hasted: { harmful: false, mods: { moveFactor: 1.3, dodgeCostFactor: 0.7 } },
  charged: { harmful: false, mods: { staminaRegenFactor: 1.5 } },
  siphoning: { harmful: false, mods: { lifesteal: 0.1 } },
  frenzy: { harmful: false, maxStacks: 3, mods: { damageDealtFactor: 1.1, attackCostFactor: 0.85 } },
  renewal: { harmful: false, amount: "healsPerSec" },
  bulwark: { harmful: false, mods: { stunTimeFactor: 0.5, knockbackFactor: 0 } },
  bloodrage: { harmful: false, mods: { damageDealtFactor: 1.35, damageTakenFactor: 1.25 } },
  grit: { harmful: false },
  embers: { harmful: false, mods: { weaponBurnPerSec: 3, burnTakenFactor: 0 } },
  lastBreath: { harmful: false, mods: { hpPerStaminaShort: 0.5 } },
  redBlade: { harmful: false, mods: { weaponLifesteal: 0.25 } },
  firstDoor: { harmful: false },
  openedDoor: { harmful: false, mods: { damageTakenFactor: 0 } },
  kaelithsEdge: { harmful: false, mods: { damageDealtFactor: 1.1 } },
  brannocsAnvil: { harmful: false, mods: { damageTakenFactor: 0.9, knockbackFactor: 0.5 } },
  haldisHearth: { harmful: false, mods: { staminaRegenFactor: 1.2 } },
} as const satisfies Record<string, StatusDef>;

export type Status = keyof typeof STATUS_DEFS;
export const STATUSES = Object.keys(STATUS_DEFS) as Status[];
export const HARMFUL_STATUSES = STATUSES.filter((s) => STATUS_DEFS[s].harmful);

export const statusDef = (status: Status): StatusDef => STATUS_DEFS[status];
export const maxStacksOf = (status: Status): number => statusDef(status).maxStacks ?? 1;

export interface StatusOn {
  status: Status;
  // null: permanent (an inscription, a blessing).
  left: number | null;
  time: number | null;
  stacks: number;
  amount: number;
}

export const statusOn = (on: readonly StatusOn[], status: Status): StatusOn | undefined =>
  on.find((o) => o.status === status);

export function timeLeft(on: readonly StatusOn[], status: Status): number {
  const found = statusOn(on, status);
  return found === undefined ? 0 : found.left ?? Infinity;
}

export const stacksOf = (on: readonly StatusOn[], status: Status): number => statusOn(on, status)?.stacks ?? 0;

export function applyStatus(on: StatusOn[], status: Status, time: number | null, amount = 0): StatusOn {
  const found = statusOn(on, status);
  if (found === undefined) {
    const fresh: StatusOn = { status, left: time, time, stacks: 1, amount };
    on.push(fresh);
    return fresh;
  }
  const permanent = found.left === null || time === null;
  if (permanent || time >= found.left!) {
    found.left = permanent ? null : time;
    found.time = found.left;
  }
  found.stacks = Math.min(maxStacksOf(status), found.stacks + 1);
  found.amount = amount;
  return found;
}

export function endStatus(on: StatusOn[], status: Status): void {
  const i = on.findIndex((o) => o.status === status);
  if (i >= 0) on.splice(i, 1);
}

export function cleanse(on: StatusOn[]): void {
  for (let i = on.length - 1; i >= 0; i--) {
    if (statusDef(on[i]!.status).harmful && on[i]!.left !== null) on.splice(i, 1);
  }
}

export function modsFrom(on: readonly StatusOn[]): StatMods {
  const mods = { ...NO_MODS };
  for (const { status, stacks } of on) {
    const own = statusDef(status).mods ?? {};
    for (const key of Object.keys(own) as (keyof StatMods)[]) {
      // Multiplied out rather than **, so every engine gets the same bits.
      for (let i = 0; i < stacks; i++) mods[key] = ADDED.includes(key) ? mods[key] + own[key]! : mods[key] * own[key]!;
    }
  }
  return mods;
}
