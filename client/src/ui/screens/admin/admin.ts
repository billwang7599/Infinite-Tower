import type { Cheat, DayChange } from "@infinite-tower/shared";

export const DAY_TIMES = [
  { label: "Dawn", fraction: 0.2 }, { label: "Noon", fraction: 0.5 }, { label: "Dusk", fraction: 0.8 },
  { label: "Midnight", fraction: 0 },
] as const;

export const DAY_SPEEDS = [1, 10, 60, 600] as const;

export const GIVE_COUNTS = [1, 5, 20] as const;

export const CHEATS_KEY = "infinite-tower:cheats";
const CHEATS_VERSION = 1;

const TOGGLES = ["invulnerable", "keepInventory"] as const;
type Toggle = (typeof TOGGLES)[number];

export interface SavedCheats extends Record<Toggle, boolean> {
  daySpeed: (typeof DAY_SPEEDS)[number];
  giveCount: (typeof GIVE_COUNTS)[number];
}

export const DEFAULT_CHEATS: SavedCheats = { invulnerable: false, keepInventory: true, daySpeed: 1, giveCount: 1 };

export type CheatStorage = Pick<Storage, "getItem" | "setItem">;

const BOOLEANS = [false, true] as const;
const oneOf = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? value as T : fallback;

export function loadCheats(storage: CheatStorage): SavedCheats {
  let saved: Record<string, unknown> | null;
  try {
    saved = JSON.parse(storage.getItem(CHEATS_KEY) ?? "null");
  } catch {
    return DEFAULT_CHEATS;
  }
  if (saved?.v !== CHEATS_VERSION) return DEFAULT_CHEATS;
  return {
    invulnerable: oneOf(BOOLEANS, saved.invulnerable, DEFAULT_CHEATS.invulnerable),
    keepInventory: oneOf(BOOLEANS, saved.keepInventory, DEFAULT_CHEATS.keepInventory),
    daySpeed: oneOf(DAY_SPEEDS, saved.daySpeed, DEFAULT_CHEATS.daySpeed),
    giveCount: oneOf(GIVE_COUNTS, saved.giveCount, DEFAULT_CHEATS.giveCount),
  };
}

export function saveCheats(storage: CheatStorage, change: Partial<SavedCheats>): void {
  storage.setItem(CHEATS_KEY, JSON.stringify({ v: CHEATS_VERSION, ...loadCheats(storage), ...change }));
}

export function rememberCheat(storage: CheatStorage, cheat: Cheat): void {
  if (cheat.kind === "invulnerable" || cheat.kind === "keepInventory") saveCheats(storage, { [cheat.kind]: cheat.on });
}

export function applySavedCheats(
  storage: CheatStorage, send: (cheat: Cheat) => void, setDayClock: (change: DayChange) => void,
): void {
  const saved = loadCheats(storage);
  for (const kind of TOGGLES) send({ kind, on: saved[kind] });
  setDayClock({ speed: saved.daySpeed });
}
