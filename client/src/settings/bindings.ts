/**
 * Every action, its default keys, and the player's changes. Game code asks about actions (core/actions.ts), so a
 * change applies at once. Keys are KeyboardEvent.code (physical position, any layout). Mouse buttons are fixed;
 * they're listed so the settings screen can show them. Three groups: general works in the overworld and in the
 * arena, the other two only there; so a general key is on nothing else, but the overworld and the arena may share
 * keys. The arena is keyboard-first: the left hand on WASD, the right on the sword's U I O / J K L / M , . grid.
 */
import { MAX_KEYS_PER_ACTION, type SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

interface ActionDef {
  label: string;
  keys: readonly string[];
  /** MouseEvent.button: 0 left (trackpad tap), 1 middle (wheel click), 2 right (two-finger tap). */
  mouse?: readonly number[];
}

export const ACTIONS = {
  general: {
    menu: { label: "Settings", keys: ["Escape"] },
    forward: { label: "Move forward (up)", keys: ["KeyW"] },
    back: { label: "Move back (down)", keys: ["KeyS"] },
    left: { label: "Move left", keys: ["KeyA"] },
    right: { label: "Move right", keys: ["KeyD"] },
    character: { label: "Character panel", keys: ["KeyC"] },
    inventory: { label: "Inventory", keys: ["KeyB"] },
  },
  /** Turn acts on what's dragged, or else on the selected item; use on the selected item. */
  overworld: {
    rest: { label: "Rest at a campfire", keys: ["KeyE"] },
    turnItem: { label: "Turn an item in the bag", keys: ["KeyR"], mouse: [2] },
    useItem: { label: "Use the selected item (eat)", keys: ["Enter"] },
  },
  /** Swings are named by how they cross the screen, listed in the order of their keys' grid. */
  battle: {
    swingTLBR: { label: "Swing top-left to bottom-right", keys: ["KeyU"] },
    swingTB: { label: "Swing top to bottom", keys: ["KeyI"] },
    swingTRBL: { label: "Swing top-right to bottom-left", keys: ["KeyO"] },
    swingLR: { label: "Swing left to right", keys: ["KeyJ"], mouse: [0] },
    stab: { label: "Stab", keys: ["KeyK"] },
    swingRL: { label: "Swing right to left", keys: ["KeyL"] },
    swingBLTR: { label: "Swing bottom-left to top-right", keys: ["KeyM"] },
    swingBT: { label: "Swing bottom to top", keys: ["Comma"] },
    swingBRTL: { label: "Swing bottom-right to top-left", keys: ["Period"] },
    block: { label: "Block (hold)", keys: ["ShiftLeft", "ShiftRight"] },
    dodge: { label: "Dodge", keys: ["KeyF"], mouse: [2] },
    jump: { label: "Jump", keys: ["Space"] },
    turnLeft: { label: "Turn camera left", keys: ["KeyQ", "ArrowLeft"] },
    turnRight: { label: "Turn camera right", keys: ["KeyE", "ArrowRight"] },
    lookUp: { label: "Tilt camera up", keys: ["ArrowUp"] },
    lookDown: { label: "Tilt camera down", keys: ["ArrowDown"] },
    leave: { label: "Leave a finished fight", keys: ["Enter"] },
  },
} as const satisfies Record<string, Record<string, ActionDef>>;

export type Group = keyof typeof ACTIONS;
export type Action<G extends Group> = G extends Group ? keyof (typeof ACTIONS)[G] & string : never;
export type ActionRef = { [G in Group]: { group: G; action: Action<G> } }[Group];
export type KeyMap = { readonly [G in Group]: { readonly [A in Action<G>]: readonly string[] } };

export const GROUPS = Object.keys(ACTIONS) as Group[];
/** Esc always opens and closes the settings (and closes the bag); the OS keys belong to system shortcuts. */
const RESERVED = new Set(["Escape", "MetaLeft", "MetaRight"]);

export const isBindable = (code: string): boolean => !RESERVED.has(code);
/** An action on a reserved key (the settings, on Esc) keeps it: shown, like the mouse buttons, but not changed. */
export const isFixed = (ref: ActionRef): boolean => !actionDef(ref).keys.some(isBindable);

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
 * What `bind` did. A key does one thing wherever it works, so it comes off any other action there (`takenFrom`: a
 * general key may come off both an overworld and a battle action); an action it was the only key of gets the
 * replaced key instead (`gave`). Adding a key that is another action's only key is refused, since that would leave
 * the other action with none (so is a swap that would put the replaced key on two actions); so is adding a key to an
 * action that already has MAX_KEYS_PER_ACTION (`full`: replace one of its keys instead).
 */
export type BindResult =
  | { ok: true; takenFrom: ActionRef[]; gave: string | null }
  | { ok: false; onlyKeyOf: ActionRef }
  | { ok: false; full: true };

export class KeyBindings extends Store<KeyMap> {
  constructor() {
    super(buildMap(defaultKeys));
  }

  /**
   * Only the actions they changed are saved, so a new default reaches everything they didn't touch; anything
   * unreadable falls back to the defaults, and actions saved where they used to be (MOVED_FROM) load where they are
   * now. Saved keys that now put one key on two actions working together (saved before the defaults moved) send
   * general back to its defaults if it clashes with another group's defaults, and then any group still clashing.
   */
  restore(saved: unknown): void {
    const defaults = buildMap(defaultKeys);
    let map = buildMap((ref) => {
      const keys = savedKeys(saved, ref);
      return isKeyList(keys) && !isFixed(ref) ? keys : defaultKeys(ref);
    });
    if (PLACES.some((place) => clashes(map.general, defaults[place]))) map = { ...map, general: defaults.general };
    for (const place of PLACES) if (clashes(map.general, map[place])) map = { ...map, [place]: defaults[place] };
    this.set(map);
  }

  /** What `restore` takes: the actions that differ from the defaults. */
  toSaved(): NonNullable<SavedSettings["bindings"]> {
    const changed: NonNullable<SavedSettings["bindings"]> = {};
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
    const map = this.get();
    if (isFixed(ref) || !isBindable(key) || key === replace) return { ok: true, takenFrom: [], gave: null };

    const owners = holders(map, ref.group, key, ref);
    const swapped = owners.filter((o) => keysOf(map, o).length === 1);
    const stuck = swapped.find((o) => replace === null || holders(map, o.group, replace, ref).length > 0);
    if (stuck) return { ok: false, onlyKeyOf: stuck };

    const kept = keysOf(map, ref).filter((k) => k !== key);
    const at = replace === null ? -1 : kept.indexOf(replace);
    if (at < 0 && kept.length >= MAX_KEYS_PER_ACTION) return { ok: false, full: true };
    if (at >= 0) kept[at] = key;
    else kept.push(key);

    let next = withKeys(map, ref, kept);
    for (const o of owners) {
      next = withKeys(next, o, swapped.includes(o) ? [replace!] : keysOf(map, o).filter((k) => k !== key));
    }
    this.set(next);
    return { ok: true, takenFrom: owners, gave: swapped.length > 0 ? replace : null };
  }

  /** Drop one key, as long as the action keeps at least one. */
  unbind(ref: ActionRef, key: string): void {
    const own = keysOf(this.get(), ref);
    if (own.length <= 1) return;
    this.set(withKeys(this.get(), ref, own.filter((k) => k !== key)));
  }

  reset(): void {
    this.set(buildMap(defaultKeys));
  }

  isDefault(): boolean {
    const map = this.get();
    return GROUPS.every((group) => actionsOf(group).every((ref) => sameKeys(keysOf(map, ref), defaultKeys(ref))));
  }
}

type Keys = { readonly [action: string]: readonly string[] };
const groupOf = (map: KeyMap, group: Group): Keys => map[group];
const defaultKeys = (ref: ActionRef): readonly string[] => actionDef(ref).keys;
const sameKeys = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((k, i) => k === b[i]);

/** Where the player can be: each works with general's keys and its own. */
const PLACES = ["overworld", "battle"] as const;
/** The groups whose keys work together with `group`'s, so no key may be on two of their actions. */
const together = (group: Group): readonly Group[] => (group === "general" ? GROUPS : ["general", group]);

/** The actions other than `except` that have `key` among the groups working together with `group`. */
function holders(map: KeyMap, group: Group, key: string, except: ActionRef): ActionRef[] {
  return together(group).flatMap(actionsOf).filter((a) => !sameAction(a, except) && keysOf(map, a).includes(key));
}

const withKeys = (map: KeyMap, ref: ActionRef, keys: readonly string[]): KeyMap =>
  ({ ...map, [ref.group]: { ...map[ref.group], [ref.action]: keys } });

function buildMap(keysFor: (ref: ActionRef) => readonly string[]): KeyMap {
  const map: Record<string, Record<string, readonly string[]>> = {};
  for (const group of GROUPS) {
    const keys: Record<string, readonly string[]> = {};
    for (const ref of actionsOf(group)) keys[ref.action] = keysFor(ref);
    map[group] = keys;
  }
  return map as unknown as KeyMap;
}

/** Any key on two actions among these groups. */
function clashes(...groups: Keys[]): boolean {
  const all = groups.flatMap((g) => Object.values(g).flat());
  return new Set(all).size !== all.length;
}

const prop = (o: unknown, key: string): unknown =>
  typeof o === "object" && o !== null ? (o as Record<string, unknown>)[key] : undefined;

/**
 * Where actions used to be saved ("group.action"), tried in order when they have nothing saved where they are now:
 * the overworld was the field, movement and the panels were per mode, and the bag had a group of its own.
 */
const MOVED_FROM: Partial<Record<string, readonly string[]>> = {
  "general.forward": ["battle.forward", "overworld.up", "field.up"],
  "general.back": ["battle.back", "overworld.down", "field.down"],
  "general.left": ["battle.left", "overworld.left", "field.left"],
  "general.right": ["battle.right", "overworld.right", "field.right"],
  "general.character": ["overworld.character", "field.character"],
  "general.inventory": ["overworld.inventory", "field.inventory"],
  "overworld.rest": ["field.rest"],
  "overworld.turnItem": ["bag.turn"],
  "overworld.useItem": ["bag.use"],
};

function savedKeys(saved: unknown, ref: ActionRef): unknown {
  const at = `${ref.group}.${ref.action}`;
  return [at, ...MOVED_FROM[at] ?? []]
    .map((place) => place.split("."))
    .map(([group, action]) => prop(prop(saved, group!), action!))
    .find((keys) => keys !== undefined);
}

const isKeyList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length >= 1 && v.length <= MAX_KEYS_PER_ACTION && new Set(v).size === v.length
  && v.every((k) => typeof k === "string" && isBindable(k));
