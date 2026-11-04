import { carriedCounts, itemDef, SLOTS, UNIQUE_ITEMS, type Bag, type ItemId } from "@infinite-tower/shared";
import type { PlayerId, PlayerSave, PlayerStore, UniqueHold } from "../ports.js";

export const UNIQUE_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

export class Uniques {
  readonly ready: Promise<void>;
  private holds: Map<ItemId, UniqueHold> | null = null;

  constructor(
    private readonly store: Pick<PlayerStore, "uniqueHolds" | "holdUnique">,
    private readonly inPlay: () => Iterable<ItemId>,
  ) {
    this.ready = store.uniqueHolds().then((holds) => {
      this.holds = new Map(holds.filter((h) => UNIQUE_ITEMS.includes(h.item)).map((h) => [h.item, h]));
    }, (err: unknown) => console.error("[store] loading unique things' holders failed", err));
  }

  // Never before the holds are loaded (or if they couldn't be): until then nothing unique drops.
  isFree(item: ItemId): boolean {
    if (!this.holds || this.heldNow(item)) return false;
    for (const there of this.inPlay()) if (there === item) return false;
    return true;
  }

  kept(player: PlayerId, save: PlayerSave): PlayerSave {
    if (!this.holds) return save;
    const lost = UNIQUE_ITEMS.filter((item) => this.heldNow(item)?.holder !== player);
    for (const item of lost) if (this.holds?.get(item)?.holder === player) this.let(item);
    if (!lost.some((item) => carries(save, item))) return save;
    const equipment = { ...save.equipment };
    for (const slot of SLOTS) {
      const item = equipment[slot];
      if (item && lost.includes(item)) equipment[slot] = null;
    }
    const inscriptions = save.core.inscriptions.filter((id) => !lost.some((item) => itemDef(item).inscription === id));
    const kept = (grid: Bag) => ({ ...grid, items: grid.items.filter((s) => !lost.includes(s.item)) });
    return { ...save, bag: kept(save.bag), pack: kept(save.pack), equipment, core: { ...save.core, inscriptions } };
  }

  saved(player: PlayerId, save: PlayerSave): void {
    if (!this.holds) return;
    for (const item of UNIQUE_ITEMS) {
      const hold = this.holds.get(item);
      if (carries(save, item)) {
        if (hold?.holder !== player) void this.store.holdUnique(item, player).catch(logFailed);
        this.holds.set(item, { item, holder: player, seenAtMs: Date.now() });
      } else if (hold?.holder === player) this.let(item);
    }
  }

  private heldNow(item: ItemId): UniqueHold | null {
    const hold = this.holds?.get(item);
    return hold && Date.now() - hold.seenAtMs < UNIQUE_HOLD_MS ? hold : null;
  }

  private let(item: ItemId): void {
    this.holds?.delete(item);
    void this.store.holdUnique(item, null).catch(logFailed);
  }
}

const carries = (save: PlayerSave, item: ItemId): boolean =>
  (carriedCounts(save)[item] ?? 0) > 0 || save.core.inscriptions.some((id) => itemDef(item).inscription === id);

const logFailed = (err: unknown) => console.error("[store] saving a unique thing's holder failed", err);
