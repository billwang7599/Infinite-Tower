import {
  Enemy, Health, LocalPlayer, momentumDamage, Player, roundTo, Stamina, type System,
} from "@infinite-tower/shared";
import type { BattleHudState } from "../../../ui/state.js";
import type { Store } from "../../../ui/store.js";
import { resultShown, type BattleContext } from "../context.js";

/** Writes every frame; the store drops unchanged values, so React only re-renders on real changes. */
export function hudSystem(ctx: BattleContext, hud: Store<BattleHudState>): System {
  return (world) => {
    if (!ctx.fight) return;
    const patch: Partial<BattleHudState> = {
      result: ctx.outcome.state,
      showResult: resultShown(ctx.outcome),
    };

    const me = world.first(LocalPlayer, Health, Stamina, Player);
    if (me) {
      patch.hpFraction = fraction(me[2].hp, me[2].max);
      patch.staminaFraction = fraction(me[3].value, me[3].max);
      patch.comboMultiplier = me[4].combo === null ? 1 : roundTo(momentumDamage(me[4].momentum), 2);
      patch.stunned = me[2].hitstun > 0 || me[4].action === "stagger";
      patch.spellbookInHand = me[4].wields.spellbook;
      patch.chantBroken = me[4].chantBroken;
      patch.writingPage = me[4].writing?.page ?? null;
    }

    const enemy = world.first(Enemy, Health);
    patch.enemyAlive = enemy !== undefined && enemy[2].hp > 0;
    if (enemy) {
      patch.enemyName = enemy[1].def.name;
      patch.enemyHpFraction = fraction(enemy[2].hp, enemy[2].max);
    }
    patch.cue = enemy?.[1].state === "parried" && patch.enemyAlive ? "parried"
      : me?.[4].action === "stagger" ? "staggered" : "none";

    hud.set(patch);
  };
}

/** 0..1, rounded to 0.1% so changes too small to see don't re-render the HUD. */
const fraction = (value: number, max: number) => roundTo(value / max, 3);
