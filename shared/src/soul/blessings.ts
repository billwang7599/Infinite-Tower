import type { Status } from "../battle/statuses.js";

export const GODS = [
  "valdris", "brannoc", "thalor", "aurel", "calyx", "haldis", "kaelith", "ithra", "nyra", "morvane", "skadrin", "vesk",
] as const;
export type God = (typeof GODS)[number];

export type Faith = Partial<Record<God, number>>;

export const BLESSING_FAITH = 100;

export const BLESSINGS = {
  kaelith: { status: "kaelithsEdge" },
  brannoc: { status: "brannocsAnvil" },
  haldis: { status: "haldisHearth" },
} as const satisfies Partial<Record<God, { status: Status }>>;

export type BlessingGod = keyof typeof BLESSINGS;

const blesses = (god: God): god is BlessingGod => Object.hasOwn(BLESSINGS, god);

export const blessingsOf = (faith: Faith): BlessingGod[] =>
  GODS.filter((god): god is BlessingGod => blesses(god) && (faith[god] ?? 0) >= BLESSING_FAITH);

export const addFaith = (faith: Faith, god: God, amount: number): Faith =>
  ({ ...faith, [god]: Math.max(0, (faith[god] ?? 0) + amount) });

export function keptFaith(saved: unknown): Faith {
  const given = (saved !== null && typeof saved === "object" ? saved : {}) as Record<string, unknown>;
  const faith: Faith = {};
  for (const god of GODS) {
    const n = given[god];
    if (typeof n === "number" && Number.isFinite(n) && n > 0) faith[god] = Math.floor(n);
  }
  return faith;
}
