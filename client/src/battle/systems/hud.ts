import { Enemy, Health, LocalPlayer, Stamina, type System } from "@infinite-tower/shared";
import type { BattleHudState } from "../../ui/state.js";
import type { Store } from "../../ui/store.js";
import type { BattleContext } from "../context.js";

/**
 * Reports the fight to the battle HUD (drawn by ui/hud/BattleHud.tsx): health, stamina, the enemy,
 * camera state and the result. Writes every frame; the store skips values that didn't change.
 */
export function hudSystem(ctx: BattleContext, hud: Store<BattleHudState>): System {
  let fpsTimer = 0;
  return (world, dt) => {
    const patch: Partial<BattleHudState> = {
      lockOn: ctx.view.lock,
      mouseCaptured: ctx.mouse.locked,
      result: ctx.fight.state,
      showResult: ctx.fight.state !== "fighting" && ctx.fight.time > 1.0,
    };

    fpsTimer += dt;
    if (fpsTimer > 0.5) { patch.fps = Math.round(ctx.scene.getEngine().getFps()); fpsTimer = 0; }

    const me = world.first(LocalPlayer, Health, Stamina);
    if (me) {
      patch.hp = fraction(me[2].hp, me[2].max);
      patch.stamina = fraction(me[3].value, me[3].max);
    }

    const enemy = world.first(Enemy, Health);
    patch.enemyAlive = enemy !== undefined && enemy[2].hp > 0;
    if (enemy) {
      patch.enemyName = enemy[1].def.name;
      patch.enemyHp = fraction(enemy[2].hp, enemy[2].max);
    }

    hud.set(patch);
  };
}

/** 0..1, rounded to 0.1% so changes too small to see don't re-render the HUD. */
const fraction = (value: number, max: number) => Math.round((value / max) * 1000) / 1000;
