import {
  actionDef, actionsOf, GROUPS, keysOf, MENUS, type Action, type Group, type KeyBindings, type KeyMap,
  type MenuAction,
} from "../settings/bindings.js";
import type { Buttons } from "./buttons.js";
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
  turnCamera: ["turnCameraLeft", "turnCameraRight"],
} as const satisfies Record<string, readonly [WorldAction, WorldAction]>;

// Held this far (a camera drag button), the mouse turns the camera instead. A drag button on another action too (the
// right one) does that as it's let go, and only if it never went this far: a click stays a click.
export const DRAG = { startPx: 6 } as const;
const dragButtons = (group: "overworld" | "battle") =>
  (actionDef({ group, action: "dragCamera" }).mouse ?? []).map((b) => `Mouse${b}`);
const DRAG_BUTTONS: Partial<Record<Layer, readonly string[]>> = {
  overworld: dragButtons("overworld"), battle: dragButtons("battle"),
};

// After a flick, movement the same way is the same flick until the mouse rests restMs; turning away flicks at once.
export const FLICK = { distancePx: 40, windowMs: 150, restMs: 100 } as const;
// By screen angle in equal steps from moving right, clockwise (y grows down).
const FLICKS = ["right", "downRight", "down", "downLeft", "left", "upLeft", "up", "upRight"] as const;
export type Flick = (typeof FLICKS)[number];

export interface Polled {
  held: ReadonlySet<WorldAction>;
  pressed: readonly WorldAction[];
  flicks: readonly Flick[];
  move: { x: number; z: number };
  turn: number;
  look: number;
  dragged: boolean;
  /** Scroll wheel notches since the last poll, + out (toward you). */
  zoom: number;
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
  private flicks: Flick[] = [];
  private sweep: { dx: number; dy: number; atMs: number }[] = [];
  private flickedWay: { x: number; y: number } | null = null;
  private lastMoveMs = -Infinity;
  private drag = { travelPx: 0, turning: false };
  private dragged = false;
  private look = { dx: 0, dy: 0 };
  private zoom = 0;
  /** Drag buttons on another action too, pressed (in this order) and not yet let go. */
  private clicks = new Map<string, number>();

  constructor(
    private readonly bindings: KeyBindings, private readonly keyboard: Keyboard, private readonly mouse: Mouse,
    private readonly mouseSettings: MouseSettings,
  ) {
    this.devices = [keyboard, mouse];
    keyboard.listen((key, repeat) => this.keydown(key, repeat));
    mouse.onMove((dx, dy, atMs) => this.moved(dx, dy, atMs));
    mouse.onWheel((notches) => {
      if (this.dragButtons().length > 0) this.zoom += notches;
    });
  }

  // Bottom first; only the top one gets keys.
  setLayers(layers: readonly Layer[]): void {
    if (layers.length === this.layers.length && layers.every((l, i) => l === this.layers[i])) return;
    this.layers = layers;
    for (const d of this.devices) d.clearPressed();
    this.flicks = [];
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.clicks.clear();
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
    const presses: [WorldAction, number][] = [];
    for (const d of this.devices) {
      for (const [key, order] of d.presses) {
        const action = this.worldAction(key);
        if (d === this.mouse && action && action !== "dragCamera" && this.dragButtons().includes(key)) {
          this.clicks.set(key, order);
        } else if (action) presses.push([action, order]);
      }
    }
    for (const [key, order] of this.clicks) {
      if (this.mouse.held.has(key)) continue;
      this.clicks.delete(key);
      const action = this.worldAction(key);
      if (action && !this.drag.turning) presses.push([action, order]);
    }
    const flicks = this.flicks, dragged = this.dragged, zoom = this.zoom;
    for (const d of this.devices) d.clearPressed();
    this.flicks = [];
    this.dragged = false;
    this.zoom = 0;
    if (!this.dragHeld()) this.drag = { travelPx: 0, turning: false };
    const pressed = presses.sort((a, b) => a[1] - b[1]).map(([action]) => action);
    const held = this.heldActions();
    const axis = (name: keyof typeof AXES) => Number(held.has(AXES[name][1])) - Number(held.has(AXES[name][0]));
    return {
      held, pressed, flicks, move: { x: axis("x"), z: axis("z") }, turn: axis("turn") + axis("turnCamera"),
      look: axis("look"), dragged, zoom,
    };
  }

  // Every frame, not per tick: movement is an amount, so a snapshot would count it again.
  lookDelta(): { dx: number; dy: number } {
    const delta = this.look;
    this.look = { dx: 0, dy: 0 };
    return this.dragButtons().length > 0 ? delta : { dx: 0, dy: 0 };
  }

  private dragButtons(): readonly string[] {
    return DRAG_BUTTONS[this.top] ?? [];
  }

  private dragHeld(): boolean {
    return this.dragButtons().some((b) => this.mouse.held.has(b));
  }

  private heldActions(): Set<WorldAction> {
    return new Set(this.devices.flatMap((d) => [...d.held].flatMap((key) => this.worldAction(key) ?? [])));
  }

  private moved(dx: number, dy: number, atMs: number): void {
    if (this.top !== "battle" || this.dragHeld()) {
      this.sweep = [];
      if (this.dragHeld()) this.dragBy(dx, dy);
      return;
    }
    this.drag = { travelPx: 0, turning: false };
    if (atMs - this.lastMoveMs > FLICK.restMs) this.flickedWay = null;
    this.lastMoveMs = atMs;
    const way = this.flickedWay;
    if (way && dx * way.x + dy * way.y > 0) return;
    this.sweep = this.sweep.filter((m) => atMs - m.atMs < FLICK.windowMs);
    this.sweep.push({ dx, dy, atMs });
    const x = this.sweep.reduce((sum, m) => sum + m.dx, 0), y = this.sweep.reduce((sum, m) => sum + m.dy, 0);
    const length = Math.hypot(x, y);
    if (length < FLICK.distancePx / this.mouseSettings.get().flickSensitivity) return;
    const turn = (2 * Math.PI) / FLICKS.length;
    const flicked = FLICKS[(Math.round(Math.atan2(y, x) / turn) + FLICKS.length) % FLICKS.length];
    if (flicked) this.flicks.push(flicked);
    this.flickedWay = { x: x / length, y: y / length };
    this.sweep = [];
  }

  private dragBy(dx: number, dy: number): void {
    const drag = this.drag;
    drag.travelPx += Math.hypot(dx, dy);
    drag.turning ||= drag.travelPx >= DRAG.startPx;
    if (!drag.turning) return;
    this.look.dx += dx;
    this.look.dy += dy;
    this.dragged = true;
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
          // A button on two actions (the right one: heavy attack, and dragging the camera) clicks the first.
          for (const b of actionDef(ref).mouse ?? []) {
            const button = `Mouse${b}`;
            if (!this.maps[g].has(button)) this.maps[g].set(button, ref.action);
          }
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
