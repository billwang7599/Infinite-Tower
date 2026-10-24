/**
 * Key bindings: every keyboard action, its default keys, and the player's changes (saved on the server with the
 * rest of their settings, settings.ts). The settings screen edits them; game code reads `bindings.get()` every
 * tick, so a change applies at once.
 * Keys are KeyboardEvent.code (physical position, any layout). Mouse buttons are fixed; they're listed here
 * so the settings screen can show them next to the keys.
 *
 * The defaults give the arena two equal setups: keyboard only (laptop: left hand on WASD + Space, right hand
 * on the home row, vim-style H/L turn the camera) and keyboard + mouse / trackpad.
 */
import { Store } from "../ui/store.js";

interface ActionDef {
  label: string;
  keys: readonly string[];
  /** MouseEvent.button: 0 left (trackpad tap), 1 middle (wheel click), 2 right (two-finger tap). */
  mouse?: readonly number[];
}

export const ACTIONS = {
  field: {
    up: { label: "Walk up", keys: ["KeyW", "ArrowUp"] },
    down: { label: "Walk down", keys: ["KeyS", "ArrowDown"] },
    left: { label: "Walk left", keys: ["KeyA", "ArrowLeft"] },
    right: { label: "Walk right", keys: ["KeyD", "ArrowRight"] },
  },
  battle: {
    forward: { label: "Move forward", keys: ["KeyW"] },
    back: { label: "Move back", keys: ["KeyS"] },
    left: { label: "Move left", keys: ["KeyA"] },
    right: { label: "Move right", keys: ["KeyD"] },
    jump: { label: "Jump", keys: ["Space"] },
    attack: { label: "Attack", keys: ["KeyJ"], mouse: [0] },
    dodge: { label: "Dodge", keys: ["KeyK", "ShiftLeft", "ShiftRight"], mouse: [2] },
    turnLeft: { label: "Turn camera left", keys: ["KeyH", "ArrowLeft"] },
    turnRight: { label: "Turn camera right", keys: ["KeyL", "ArrowRight"] },
    lookUp: { label: "Tilt camera up", keys: ["ArrowUp"] },
    lookDown: { label: "Tilt camera down", keys: ["ArrowDown"] },
    leave: { label: "Leave a finished fight", keys: ["Enter", "KeyE"] },
  },
} as const satisfies Record<string, Record<string, ActionDef>>;

export type Group = keyof typeof ACTIONS;
export type Action<G extends Group> = keyof (typeof ACTIONS)[G] & string;
export type ActionRef = { [G in Group]: { group: G; action: Action<G> } }[Group];
export type KeyMap = { readonly [G in Group]: { readonly [A in Action<G>]: readonly string[] } };

export const GROUPS = Object.keys(ACTIONS) as Group[];
export const MAX_KEYS = 3;
/** Esc always opens and closes the settings; the OS keys belong to system shortcuts. */
const RESERVED = new Set(["Escape", "MetaLeft", "MetaRight"]);

export const isBindable = (code: string): boolean => !RESERVED.has(code);

export function actionsOf(group: Group): ActionRef[] {
  return Object.keys(ACTIONS[group]).map((action) => ({ group, action }) as ActionRef);
}

export function keysOf(map: KeyMap, ref: ActionRef): readonly string[] {
  return groupOf(map, ref.group)[ref.action]!;
}

export const sameAction = (a: ActionRef, b: ActionRef): boolean => a.group === b.group && a.action === b.action;

export function actionDef(ref: ActionRef): ActionDef {
  return (ACTIONS[ref.group] as Record<string, ActionDef>)[ref.action]!;
}

/**
 * What `bind` did. A key does one thing per mode, so it comes off any other action there (`takenFrom`); if
 * that was the other action's only key, it gets the replaced key instead (`gave`). Adding a key that is
 * another action's only key is refused, since that would leave the other action with none.
 */
export type BindResult =
  | { ok: true; takenFrom: ActionRef | null; gave: string | null }
  | { ok: false; onlyKeyOf: ActionRef };

export class KeyBindings extends Store<KeyMap> {
  constructor() {
    super(buildMap(defaultKeys));
  }

  /**
   * Take the player's saved keys. Only the actions they changed are saved, so a new default reaches everything
   * they didn't touch; anything unreadable (an older format, an action that's gone) falls back to the defaults.
   */
  restore(saved: unknown): void {
    this.set(buildMap((ref) => {
      const keys = prop(prop(saved, ref.group), ref.action);
      return isKeyList(keys) ? keys : defaultKeys(ref);
    }));
  }

  /** What `restore` takes: the actions that differ from the defaults. */
  toSaved(): Record<string, Record<string, string[]>> {
    const changed: Record<string, Record<string, string[]>> = {};
    for (const group of GROUPS) {
      for (const ref of actionsOf(group)) {
        const keys = keysOf(this.get(), ref);
        if (!sameKeys(keys, defaultKeys(ref))) (changed[group] ??= {})[ref.action] = [...keys];
      }
    }
    return changed;
  }

  /** Put `key` on an action, in place of `replace` or (null) added after its keys. */
  bind(ref: ActionRef, key: string, replace: string | null): BindResult {
    const keys = groupOf(this.get(), ref.group);
    const own = keys[ref.action]!;
    if (!isBindable(key) || key === replace) return { ok: true, takenFrom: null, gave: null };

    const owner = Object.keys(keys).find((a) => a !== ref.action && keys[a]!.includes(key));
    const ownerRef = owner === undefined ? null : ({ group: ref.group, action: owner } as ActionRef);
    const swap = ownerRef !== null && keys[owner!]!.length === 1;
    if (swap && replace === null) return { ok: false, onlyKeyOf: ownerRef };

    const next = { ...keys };
    if (owner !== undefined) next[owner] = swap ? [replace!] : keys[owner]!.filter((k) => k !== key);
    const kept = own.filter((k) => k !== key);
    const at = replace === null ? -1 : kept.indexOf(replace);
    if (at >= 0) kept[at] = key;
    else if (kept.length < MAX_KEYS) kept.push(key);
    next[ref.action] = kept;

    this.update(ref.group, next);
    return { ok: true, takenFrom: ownerRef, gave: swap ? replace : null };
  }

  /** Drop one key, as long as the action keeps at least one. */
  unbind(ref: ActionRef, key: string): void {
    const keys = groupOf(this.get(), ref.group);
    const own = keys[ref.action]!;
    if (own.length <= 1) return;
    this.update(ref.group, { ...keys, [ref.action]: own.filter((k) => k !== key) });
  }

  reset(): void {
    this.set(buildMap(defaultKeys));
  }

  isDefault(): boolean {
    return GROUPS.every((group) => actionsOf(group).every((ref) => sameKeys(keysOf(this.get(), ref), defaultKeys(ref))));
  }

  private update(group: Group, keys: Record<string, readonly string[]>): void {
    this.set({ [group]: keys } as Partial<KeyMap>);
  }
}

type Keys = Record<string, readonly string[]>;
const groupOf = (map: KeyMap, group: Group): Keys => map[group] as Keys;
const defaultKeys = (ref: ActionRef): readonly string[] => actionDef(ref).keys;
const sameKeys = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((k, i) => k === b[i]);

function buildMap(keysFor: (ref: ActionRef) => readonly string[]): KeyMap {
  const map: Record<string, Keys> = {};
  for (const group of GROUPS) {
    const keys: Record<string, readonly string[]> = {};
    for (const ref of actionsOf(group)) keys[ref.action] = keysFor(ref);
    map[group] = keys;
  }
  return map as unknown as KeyMap;
}

const prop = (o: unknown, key: string): unknown =>
  typeof o === "object" && o !== null ? (o as Record<string, unknown>)[key] : undefined;

const isKeyList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length >= 1 && v.length <= MAX_KEYS && new Set(v).size === v.length
  && v.every((k) => typeof k === "string" && isBindable(k));
