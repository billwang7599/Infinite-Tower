import {
  actionDef, actionsOf, GROUPS, keysOf, MENUS, type Action, type Group, type KeyBindings, type KeyMap,
  type MenuAction,
} from "../settings/bindings.js";
import type { Buttons } from "./buttons.js";
import type { Keyboard } from "./keyboard.js";
import type { Mouse } from "./mouse.js";

type OverworldAction = Action<"general" | "overworld">;
const BAG_ACTIONS = ["inventory", "character", "turnItem", "useItem"] as const satisfies readonly OverworldAction[];

interface LayerActions {
  title: MenuAction<"title">;
  creation: MenuAction<"creation">;
  settings: "menu";
  bag: MenuAction<"bag"> | (typeof BAG_ACTIONS)[number];
  overworld: OverworldAction;
  battle: Action<"general" | "battle">;
}
export type Layer = keyof LayerActions;
export type ActionName = LayerActions[Layer];
type WorldAction = LayerActions["overworld" | "battle"];

const AXES = {
  x: ["left", "right"], z: ["back", "forward"], turn: ["turnLeft", "turnRight"], look: ["lookUp", "lookDown"],
} as const satisfies Record<string, readonly [WorldAction, WorldAction]>;

export interface Polled {
  held: ReadonlySet<WorldAction>;
  pressed: readonly WorldAction[];
  move: { x: number; z: number };
  turn: number;
  look: number;
}

// Returning false leaves the key to the page.
type Handler = (repeat: boolean) => boolean | void;

const GROUP_OF: Partial<Record<Layer, Group>> = {
  settings: "general", bag: "overworld", overworld: "overworld", battle: "battle",
};
const KEPT: Partial<Record<Layer, readonly ActionName[]>> = { settings: ["menu"], bag: BAG_ACTIONS };
const FIXED = new Map(Object.entries(MENUS).map(([layer, actions]) => [layer as Layer, new Map(
  Object.entries<readonly string[]>(actions).flatMap(([action, keys]) => keys.map((k) => [k, action as ActionName])),
)]));
// Only these read held keys and taps: under a screen or the open bag you stand still.
const WORLD: readonly Layer[] = ["overworld", "battle"];
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

  constructor(private readonly bindings: KeyBindings, private readonly keyboard: Keyboard, mouse: Mouse) {
    this.devices = [keyboard, mouse];
    keyboard.listen((key, repeat) => this.keydown(key, repeat));
  }

  // Bottom first; only the top one gets keys.
  setLayers(layers: readonly Layer[]): void {
    if (layers.length === this.layers.length && layers.every((l, i) => l === this.layers[i])) return;
    this.layers = layers;
    for (const d of this.devices) d.clearPressed();
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
    const presses = this.devices.flatMap((d) => [...d.presses]).sort((a, b) => a[1] - b[1]);
    for (const d of this.devices) d.clearPressed();
    const pressed = presses.flatMap(([key]) => this.worldAction(key) ?? []);
    const held = new Set(this.devices.flatMap((d) => [...d.held].flatMap((key) => this.worldAction(key) ?? [])));
    const axis = (name: keyof typeof AXES) => Number(held.has(AXES[name][1])) - Number(held.has(AXES[name][0]));
    return { held, pressed, move: { x: axis("x"), z: axis("z") }, turn: axis("turn"), look: axis("look") };
  }

  private get top(): Layer {
    return this.layers.at(-1)!;
  }

  private of(layer: Layer, key: string): ActionName | undefined {
    const fixed = FIXED.get(layer)?.get(key);
    const group = GROUP_OF[layer];
    if (fixed || !group) return fixed;
    const action = this.actionOf(group, key) as ActionName | undefined;
    return action && (KEPT[layer]?.includes(action) ?? true) ? action : undefined;
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
    return WORLD.includes(this.top) ? this.of(this.top, key) as WorldAction | undefined : undefined;
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
