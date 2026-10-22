/**
 * Minimal ECS. Engine-agnostic: no Babylon imports, so the server can run it too.
 *
 * - Entity: a number.
 * - Component: plain data, identified by a ComponentType token.
 * - System: a function run by the game in a fixed order.
 *
 * Storage is Map-per-component for now. Everything goes through World's API,
 * so it can move to typed arrays later without touching game code.
 */

export type Entity = number;

export interface ComponentType<T> {
  readonly id: number;
  readonly name: string;
  /** Phantom field so TS can infer T. Never set at runtime. */
  readonly __type?: T;
}

let nextComponentId = 0;
export function defineComponent<T>(name: string): ComponentType<T> {
  return { id: nextComponentId++, name };
}

/** Maps a tuple of ComponentTypes to a tuple of their data types. */
export type DataOf<T extends readonly ComponentType<unknown>[]> = {
  [K in keyof T]: T[K] extends ComponentType<infer U> ? U : never;
};

type RemoveHook<T> = (entity: Entity, data: T) => void;

export class World {
  private nextEntity: Entity = 1;
  private readonly alive = new Set<Entity>();
  private readonly stores = new Map<number, Map<Entity, unknown>>();
  private readonly removeHooks = new Map<number, RemoveHook<unknown>[]>();
  private readonly pendingDestroy = new Set<Entity>();

  spawn(): Entity {
    const e = this.nextEntity++;
    this.alive.add(e);
    return e;
  }

  isAlive(e: Entity): boolean {
    return this.alive.has(e) && !this.pendingDestroy.has(e);
  }

  /** Deferred: the entity is removed at the next flush(), so systems can destroy while iterating. */
  destroy(e: Entity): void {
    if (this.alive.has(e)) this.pendingDestroy.add(e);
  }

  add<T>(e: Entity, type: ComponentType<T>, data: T): T {
    this.store(type).set(e, data);
    return data;
  }

  get<T>(e: Entity, type: ComponentType<T>): T | undefined {
    return this.store(type).get(e);
  }

  /** Like get(), but throws if missing. Use when absence is a bug. */
  require<T>(e: Entity, type: ComponentType<T>): T {
    const data = this.store(type).get(e);
    if (data === undefined) throw new Error(`Entity ${e} has no ${type.name}`);
    return data;
  }

  has(e: Entity, type: ComponentType<unknown>): boolean {
    return this.store(type).has(e);
  }

  remove<T>(e: Entity, type: ComponentType<T>): void {
    const store = this.store(type);
    const data = store.get(e);
    if (data === undefined) return;
    store.delete(e);
    this.runRemoveHooks(type, e, data);
  }

  /** Called when a component is removed or its entity destroyed. Use it to dispose engine resources. */
  onRemove<T>(type: ComponentType<T>, hook: RemoveHook<T>): void {
    const hooks = this.removeHooks.get(type.id) ?? [];
    hooks.push(hook as RemoveHook<unknown>);
    this.removeHooks.set(type.id, hooks);
  }

  /** Iterate entities having all given components: `for (const [e, pos, vel] of world.query(Pos, Vel))`. */
  *query<T extends readonly ComponentType<unknown>[]>(...types: T): Generator<[Entity, ...DataOf<T>]> {
    if (types.length === 0) return;
    // Drive iteration from the smallest store.
    const stores = types.map((t) => this.store(t));
    let smallest = stores[0]!;
    for (const s of stores) if (s.size < smallest.size) smallest = s;

    outer: for (const e of smallest.keys()) {
      if (this.pendingDestroy.has(e)) continue;
      const row: unknown[] = [e];
      for (const s of stores) {
        const d = s.get(e);
        if (d === undefined) continue outer;
        row.push(d);
      }
      yield row as [Entity, ...DataOf<T>];
    }
  }

  /** First match of a query, e.g. the local player. */
  first<T extends readonly ComponentType<unknown>[]>(...types: T): [Entity, ...DataOf<T>] | undefined {
    for (const row of this.query(...types)) return row;
    return undefined;
  }

  /** Apply deferred destroys. The game calls this once per tick, after all systems. */
  flush(): void {
    for (const e of this.pendingDestroy) {
      for (const [typeId, store] of this.stores) {
        const data = store.get(e);
        if (data === undefined) continue;
        store.delete(e);
        for (const hook of this.removeHooks.get(typeId) ?? []) hook(e, data);
      }
      this.alive.delete(e);
    }
    this.pendingDestroy.clear();
  }

  get entityCount(): number {
    return this.alive.size;
  }

  private store<T>(type: ComponentType<T>): Map<Entity, T> {
    let s = this.stores.get(type.id);
    if (!s) {
      s = new Map();
      this.stores.set(type.id, s);
    }
    return s as Map<Entity, T>;
  }

  private runRemoveHooks<T>(type: ComponentType<T>, e: Entity, data: T): void {
    for (const hook of this.removeHooks.get(type.id) ?? []) hook(e, data);
  }
}

export type System = (world: World, dt: number) => void;
