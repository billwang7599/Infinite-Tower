/**
 * What the keys and mouse buttons do: each bindings group turned around into key -> action (a mouse button as
 * "Mouse0"…), rebuilt when the bindings change. Game code asks about actions, never keys. General's keys work
 * everywhere, alongside those of the group for where the player is (overworld or battle).
 */
import type { AttackKind } from "@infinite-tower/shared";
import {
  actionDef, actionsOf, GROUPS, keysOf, type Action, type Group, type KeyBindings, type KeyMap,
} from "../settings/bindings.js";
import type { Buttons } from "./buttons.js";
import type { Keyboard } from "./keyboard.js";
import type { Mouse } from "./mouse.js";

const ATTACKS: Partial<Record<string, AttackKind>> = {
  swingLR: "lr", swingRL: "rl", swingTB: "tb", swingBT: "bt",
  swingTLBR: "tlbr", swingBRTL: "brtl", swingTRBL: "trbl", swingBLTR: "bltr", stab: "stab",
} satisfies { [A in Action<"battle">]?: AttackKind };

let mapped: KeyMap | null = null;
const maps = {} as Record<Group, Map<string, string>>;

/** What `key` (a KeyboardEvent.code, or "Mouse0"…) does in `group`, general's keys included. */
export function actionOf<G extends Group>(bindings: KeyMap, group: G, key: string): Action<"general" | G> | undefined {
  if (bindings !== mapped) {
    mapped = bindings;
    for (const g of GROUPS) {
      maps[g] = new Map();
      for (const ref of actionsOf(g)) {
        for (const k of keysOf(bindings, ref)) maps[g].set(k, ref.action);
        for (const b of actionDef(ref).mouse ?? []) maps[g].set(`Mouse${b}`, ref.action);
      }
    }
  }
  return (maps.general.get(key) ?? maps[group].get(key)) as Action<"general" | G> | undefined;
}

/** The keyboard and the mouse, asked about actions. */
export class Actions {
  private readonly devices: readonly Buttons[];
  /** The attack key (or button) pressed last: its attack goes on while it's held. */
  private attackKey: string | null = null;

  constructor(keyboard: Keyboard, mouse: Mouse, private readonly bindings: KeyBindings) {
    this.devices = [keyboard, mouse];
  }

  isDown<G extends Group>(group: G, action: Action<"general" | G>): boolean {
    return this.devices.some((d) => d.isDown((key) => this.of(group, key) === action));
  }

  /** -1, 0 or 1 from two opposite actions. */
  axis<G extends Group>(group: G, negative: Action<"general" | G>, positive: Action<"general" | G>): number {
    return Number(this.isDown(group, positive)) - Number(this.isDown(group, negative));
  }

  /** Pressed since the last call, on the keyboard or the mouse (clears those presses). */
  consumePressed<G extends Group>(group: G, action: Action<"general" | G>): boolean {
    return this.devices.map((d) => d.consumePressed((key) => this.of(group, key) === action)).includes(true);
  }

  /**
   * The arena's attack for its next step: the attack key pressed last since the last call, or else the one still
   * held from its press; null with none. Letting go of it ends the attack, even with an older attack key held.
   */
  attack(): AttackKind | null {
    const isAttack = (key: string) => this.attackOf(key) !== undefined;
    const last = this.devices.flatMap((d) => [...d.presses].filter(([key]) => isAttack(key)))
      .sort((a, b) => a[1] - b[1]).at(-1);
    for (const d of this.devices) d.consumePressed(isAttack);
    const held = this.attackKey;
    if (last) this.attackKey = last[0];
    else if (held !== null && !this.devices.some((d) => d.isDown((key) => key === held))) this.attackKey = null;
    return this.attackKey === null ? null : this.attackOf(this.attackKey) ?? null;
  }

  private of(group: Group, key: string): string | undefined {
    return actionOf(this.bindings.get(), group, key);
  }

  private attackOf(key: string): AttackKind | undefined {
    const action = this.of("battle", key);
    return action === undefined ? undefined : ATTACKS[action];
  }
}
