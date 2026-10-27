/** Minimal ECS: an entity is a number, a component plain data, a system a function run in a fixed order. */

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

  /** Throws if missing. */
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
    this.runRemoveHooks(type.id, e, data);
  }

  /** Called when a component is removed or its entity destroyed: for disposing engine resources. */
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

  first<T extends readonly ComponentType<unknown>[]>(...types: T): [Entity, ...DataOf<T>] | undefined {
    for (const row of this.query(...types)) return row;
    return undefined;
  }

  /** Applies deferred destroys: once per tick, after all systems. */
  flush(): void {
    for (const e of this.pendingDestroy) {
      for (const [typeId, store] of this.stores) {
        const data = store.get(e);
        if (data === undefined) continue;
        store.delete(e);
        this.runRemoveHooks(typeId, e, data);
      }
      this.alive.delete(e);
    }
    this.pendingDestroy.clear();
  }

  private store<T>(type: ComponentType<T>): Map<Entity, T> {
    let s = this.stores.get(type.id);
    if (!s) {
      s = new Map();
      this.stores.set(type.id, s);
    }
    return s as Map<Entity, T>;
  }

  private runRemoveHooks(typeId: number, e: Entity, data: unknown): void {
    for (const hook of this.removeHooks.get(typeId) ?? []) hook(e, data);
  }
}

export type System = (world: World, dt: number) => void;
