import type { Cheat, DayChange } from "@infinite-tower/shared";
import type { Mode } from "../../../game/transition.js";
import type { GameUi } from "../../context.js";
import type { AdminState } from "../../state.js";
import type { Store } from "../../store.js";

export const DAY_TIMES = [
  { label: "Dawn", fraction: 0.2 }, { label: "Noon", fraction: 0.5 }, { label: "Dusk", fraction: 0.8 },
  { label: "Midnight", fraction: 0 },
] as const;

export const DAY_SPEEDS = [1, 10, 60, 600] as const;
export type DaySpeed = (typeof DAY_SPEEDS)[number];

export const GIVE_COUNTS = [1, 5, 20] as const;

export const CHEATS_KEY = "infinite-tower:cheats";
const CHEATS_VERSION = 1;

const TOGGLES = ["invulnerable", "keepInventory"] as const;
type Toggle = (typeof TOGGLES)[number];

export interface SavedCheats extends Record<Toggle, boolean> {
  daySpeed: DaySpeed;
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

export type AdminAct = { cheat: Cheat } | { dayTime: number } | { daySpeed: DaySpeed };

export interface AdminOutlet {
  storage: CheatStorage;
  admin: Store<AdminState>;
  send(cheat: Cheat): void;
  setDayClock(change: DayChange): void;
}

export const outletOf = ({ ui, actions }: GameUi): AdminOutlet => ({
  storage: localStorage, admin: ui.admin, send: (cheat) => actions.request({ t: "cheat", cheat }),
  setDayClock: actions.setDayClock,
});

// The time of day is only drawn, so it is set here; the server does each cheat (and ignores them in production).
export function act(to: AdminOutlet, what: AdminAct): void {
  if ("cheat" in what) {
    rememberCheat(to.storage, what.cheat);
    to.send(what.cheat);
  } else if ("dayTime" in what) {
    to.setDayClock({ fraction: what.dayTime });
  } else {
    saveCheats(to.storage, { daySpeed: what.daySpeed });
    to.setDayClock({ speed: what.daySpeed });
    to.admin.set({ daySpeed: what.daySpeed });
  }
}

export interface CheatPlace {
  mode: Mode | null;
  againstEnemies: boolean;
}

const OVERWORLD_ONLY: readonly Cheat["kind"][] = ["encounter", "completeQuest", "faith", "resetSave"];

export function whyNot(kind: Cheat["kind"], at: CheatPlace): string | null {
  if (OVERWORLD_ONLY.includes(kind) && at.mode !== "overworld") return "Only in the overworld.";
  if (kind === "kill" && !(at.mode === "battle" && at.againstEnemies)) return "No enemy to kill here.";
  return null;
}

export function applySavedCheats(to: AdminOutlet): void {
  const saved = loadCheats(to.storage);
  for (const kind of TOGGLES) to.send({ kind, on: saved[kind] });
  act(to, { daySpeed: saved.daySpeed });
}
