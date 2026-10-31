import {
  actionDef, actionsOf, GROUPS, keysOf, MENUS, type Action, type Group, type KeyBindings, type KeyMap,
  type MenuAction,
} from "../settings/bindings.js";
import { nextPressOrder, type Buttons } from "./buttons.js";
import type { Keyboard } from "./keyboard.js";
import type { Mouse } from "./mouse.js";
import type { MouseSettings } from "../settings/mouse.js";

type OverworldAction = Action<"general" | "overworld">;
const BAG_ACTIONS = ["inventory", "character", "turnItem", "useItem"] as const satisfies readonly OverworldAction[];
const CHANT_ACTIONS = [
  "chant", "dodge", "forward", "back", "left", "right",
] as const satisfies readonly Action<"general" | "battle">[];
const BATTLE_BAG_ACTIONS = [
  "inventory", "turnItem", "useItem", "dodge", "forward", "back", "left", "right",
] as const satisfies readonly Action<Group>[];

interface LayerActions {
  title: MenuAction<"title">;
  creation: MenuAction<"creation">;
  settings: "menu";
  admin: MenuAction<"admin"> | "adminPanel";
  bag: MenuAction<"bag"> | (typeof BAG_ACTIONS)[number];
  chant: MenuAction<"chant"> | (typeof CHANT_ACTIONS)[number];
  battleBag: MenuAction<"battleBag"> | (typeof BATTLE_BAG_ACTIONS)[number];
  leaveArena: MenuAction<"leaveArena"> | "leave";
  dialogue: MenuAction<"dialogue"> | "interact";
  questbook: MenuAction<"questbook"> | "questbook";
  skillbook: MenuAction<"skillbook">;
  chat: MenuAction<"chat">;
  overworld: OverworldAction;
  battle: Action<"general" | "battle">;
}
export type Layer = keyof LayerActions;
export type ActionName = LayerActions[Layer];
type WorldAction = LayerActions["overworld" | "battle"];

const AXES = {
  x: ["left", "right"], z: ["back", "forward"], turn: ["turnLeft", "turnRight"], look: ["lookUp", "lookDown"],
} as const satisfies Record<string, readonly [WorldAction, WorldAction]>;

// After a flick, movement the same way is the same flick until the mouse rests restMs; turning away flicks at once.
export const FLICK = { distancePx: 40, windowMs: 150, restMs: 100 } as const;
const FLICK_GUARDS: readonly (WorldAction | null)[] = ["guardRight", null, "guardLeft", "guardTop"];

export interface Polled {
  held: ReadonlySet<WorldAction>;
  pressed: readonly WorldAction[];
  move: { x: number; z: number };
  turn: number;
  look: number;
}

// Returning false leaves the key to the page.
type Handler = (repeat: boolean) => boolean | void;

// A key on actions in two groups (R: turn an item, or chant) means the first group's that the layer keeps.
const GROUPS_OF: Partial<Record<Layer, readonly Group[]>> = {
  settings: ["general"], admin: ["general"], bag: ["overworld"], overworld: ["overworld"], battle: ["battle"],
  chant: ["battle"], battleBag: ["overworld", "battle"], leaveArena: ["battle"], dialogue: ["overworld", "battle"],
  questbook: ["general"],
};
const KEPT: Partial<Record<Layer, readonly ActionName[]>> = {
  settings: ["menu"], admin: ["adminPanel"], bag: BAG_ACTIONS, chant: CHANT_ACTIONS, battleBag: BATTLE_BAG_ACTIONS,
  leaveArena: ["leave"], dialogue: ["interact"], questbook: ["questbook"],
};
const FIXED = new Map(Object.entries(MENUS).map(([layer, actions]) => [layer as Layer, new Map(
  Object.entries<readonly string[]>(actions).flatMap(([action, keys]) => keys.map((k) => [k, action as ActionName])),
)]));
// Only these read held keys and taps: under a screen or the overworld's bag you stand still. The fight holds a
// chanter, and anyone in the bag, still.
const WORLD: readonly Layer[] = ["overworld", "battle", "chant", "battleBag"];
// Keys the browser would otherwise use in the world (scrolling, moving focus, Firefox's quick find).
const SWALLOW = new Set([
  "Space", "Semicolon", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Quote", "Slash",
]);

export class Actions {
  private layers: readonly Layer[] = ["title"];
  private readonly handlers = new Set<{ action: ActionName; handle: Handler }>();
  private readonly devices: readonly Buttons[];
  private mapped: KeyMap | null = null;
  private readonly maps = {} as Record<Group, Map<string, string>>;
  private flicks: [WorldAction, number][] = [];
  private sweep: { dx: number; dy: number; atMs: number }[] = [];
  private flickedWay: { x: number; y: number } | null = null;
  private lastMoveMs = -Infinity;

  constructor(
    private readonly bindings: KeyBindings, private readonly keyboard: Keyboard, private readonly mouse: Mouse,
    private readonly mouseSettings: MouseSettings,
  ) {
    this.devices = [keyboard, mouse];
    keyboard.listen((key, repeat) => this.keydown(key, repeat));
    mouse.onMove((dx, dy, atMs) => this.moved(dx, dy, atMs));
  }

  // Bottom first; only the top one gets keys.
  setLayers(layers: readonly Layer[]): void {
    if (layers.length === this.layers.length && layers.every((l, i) => l === this.layers[i])) return;
    this.layers = layers;
    for (const d of this.devices) d.clearPressed();
    this.flicks = [];
    this.mouse.setLockable(this.top === "battle", this.mouseSettings.get().autoLock);
  }

  on(action: ActionName, handle: Handler): () => void {
    const handler = { action, handle };
    this.handlers.add(handler);
    return () => void this.handlers.delete(handler);
  }

  captureKey(take: (key: string) => boolean): () => void {
    return this.keyboard.captureKey(take);
  }

  // Once per tick: it clears the presses.
  poll(): Polled {
    const presses: [WorldAction, number][] = [
      ...this.devices.flatMap((d) => [...d.presses].flatMap(([key, order]) => {
        const action = this.worldAction(key);
        return action ? [[action, order] as [WorldAction, number]] : [];
      })),
      ...this.flicks,
    ];
    for (const d of this.devices) d.clearPressed();
    this.flicks = [];
    const pressed = presses.sort((a, b) => a[1] - b[1]).map(([action]) => action);
    const held = this.heldActions();
    const axis = (name: keyof typeof AXES) => Number(held.has(AXES[name][1])) - Number(held.has(AXES[name][0]));
    return { held, pressed, move: { x: axis("x"), z: axis("z") }, turn: axis("turn"), look: axis("look") };
  }

  // Every frame, not per tick: movement is an amount, so a snapshot would count it again.
  lookDelta(): { dx: number; dy: number } {
    const delta = this.mouse.consumeDelta();
    return this.top === "battle" ? delta : { dx: 0, dy: 0 };
  }

  private heldActions(): Set<WorldAction> {
    return new Set(this.devices.flatMap((d) => [...d.held].flatMap((key) => this.worldAction(key) ?? [])));
  }

  private moved(dx: number, dy: number, atMs: number): void {
    const held = this.top === "battle" ? this.heldActions() : null;
    if (!held || held.has("dragCamera")) {
      this.sweep = [];
      return;
    }
    if (atMs - this.lastMoveMs > FLICK.restMs) this.flickedWay = null;
    this.lastMoveMs = atMs;
    const way = this.flickedWay;
    if (way && dx * way.x + dy * way.y > 0) return;
    this.sweep = this.sweep.filter((m) => atMs - m.atMs < FLICK.windowMs);
    this.sweep.push({ dx, dy, atMs });
    const x = this.sweep.reduce((sum, m) => sum + m.dx, 0), y = this.sweep.reduce((sum, m) => sum + m.dy, 0);
    const length = Math.hypot(x, y);
    if (length < FLICK.distancePx / this.mouseSettings.get().flickSensitivity) return;
    const guard = FLICK_GUARDS[(Math.round(Math.atan2(y, x) / (Math.PI / 2)) + 4) % 4];
    if (guard) this.flicks.push([guard, nextPressOrder()]);
    this.flickedWay = { x: x / length, y: y / length };
    this.sweep = [];
  }

  private get top(): Layer {
    return this.layers.at(-1)!;
  }

  private of(layer: Layer, key: string): ActionName | undefined {
    const fixed = FIXED.get(layer)?.get(key);
    if (fixed) return fixed;
    for (const group of GROUPS_OF[layer] ?? []) {
      const action = this.actionOf(group, key) as ActionName | undefined;
      if (action && (KEPT[layer]?.includes(action) ?? true)) return action;
    }
    return undefined;
  }

  private actionOf(group: Group, key: string): string | undefined {
    const bindings = this.bindings.get();
    if (bindings !== this.mapped) {
      this.mapped = bindings;
      for (const g of GROUPS) {
        this.maps[g] = new Map();
        for (const ref of actionsOf(g)) {
          for (const k of keysOf(bindings, ref)) this.maps[g].set(k, ref.action);
          for (const b of actionDef(ref).mouse ?? []) this.maps[g].set(`Mouse${b}`, ref.action);
        }
      }
    }
    return this.maps.general.get(key) ?? this.maps[group].get(key);
  }

  private worldAction(key: string): WorldAction | undefined {
    if (!WORLD.includes(this.top) || FIXED.get(this.top)?.has(key)) return undefined;
    return this.of(this.top, key) as WorldAction | undefined;
  }

  private keydown(key: string, repeat: boolean): boolean {
    const layer = this.top;
    const action = this.of(layer, key);
    let used = WORLD.includes(layer) && SWALLOW.has(key);
    for (const { action: wanted, handle } of [...this.handlers]) {
      if (wanted === action && handle(repeat) !== false) used = true;
    }
    return used;
  }
}
