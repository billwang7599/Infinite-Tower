import type { ShownStat } from "../battle/stats.js";
import type { Status } from "../battle/statuses.js";
import { itemDef, ITEM_IDS, type ItemId } from "../items/items.js";
import { CORE_STEPS, STEP_NAMES, type CoreState } from "./core.js";

export interface InscriptionDef {
  status: Status;
  stats?: Partial<Record<ShownStat, number>>;
}

export const INSCRIPTIONS = {
  grit: { status: "grit", stats: { strength: 4, vitality: 4 } },
  embers: { status: "embers" },
  "last-breath": { status: "lastBreath" },
  "red-blade": { status: "redBlade" },
  "first-door": { status: "firstDoor" },
} as const satisfies Record<string, InscriptionDef>;

export type InscriptionId = keyof typeof INSCRIPTIONS;
export const INSCRIPTION_IDS = Object.keys(INSCRIPTIONS) as InscriptionId[];

export const EMBERS = { burnTime: 3 } as const;
export const FIRST_DOOR = { hpLeft: 1, openTime: 2 } as const;

export const isInscription = (id: unknown): id is InscriptionId =>
  typeof id === "string" && (INSCRIPTION_IDS as readonly string[]).includes(id);

export function sigilOf(id: InscriptionId): ItemId {
  return ITEM_IDS.find((item) => itemDef(item).inscription === id)!;
}

export function inscriptionSlots(core: CoreState): number {
  const step = Math.min(core.steps, CORE_STEPS - 1);
  return 1 + step + Math.floor(step / STEP_NAMES.length);
}

export function carve(core: CoreState, id: InscriptionId): CoreState | null {
  if (core.inscriptions.includes(id) || core.inscriptions.length >= inscriptionSlots(core)) return null;
  return { ...core, inscriptions: [...core.inscriptions, id] };
}

export function uncarve(core: CoreState, id: InscriptionId): CoreState | null {
  if (!core.inscriptions.includes(id)) return null;
  return { ...core, inscriptions: core.inscriptions.filter((carved) => carved !== id) };
}

export function inscriptionStat(inscriptions: readonly InscriptionId[], stat: ShownStat): number {
  let sum = 0;
  for (const id of inscriptions) sum += (INSCRIPTIONS[id] as InscriptionDef).stats?.[stat] ?? 0;
  return sum;
}

export function keptInscriptions(saved: unknown): InscriptionId[] {
  return Array.isArray(saved) ? [...new Set(saved.filter(isInscription))] : [];
}
