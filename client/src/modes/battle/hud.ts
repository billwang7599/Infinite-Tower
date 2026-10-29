import {
  Body, Enemy, Health, heldIn, LocalPlayer, pileInView, Player, roundTo, Stamina, Wielder,
} from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import type { BattleHudState } from "../../ui/state.js";
import type { Store } from "../../ui/store.js";
import { AFTER_FIGHT_BANNER_TIME, resultShown, type BattleContext } from "./context.js";

/** Writes every frame; the store drops unchanged values, so React only re-renders on real changes. */
export function hudSystem(ctx: BattleContext, hud: Store<BattleHudState>): (fight: Fight) => void {
  return ({ world, duel, players }) => {
    const { outcome, afterFightMs } = ctx;
    const afterFight = afterFightMs !== null && resultShown(outcome);
    const patch: Partial<BattleHudState> = {
      result: outcome.state,
      showResult: resultShown(outcome) && !(afterFight && outcome.stateTime > AFTER_FIGHT_BANNER_TIME),
      afterFight,
      arenaSecondsLeft: afterFight ? Math.max(0, Math.ceil(afterFightMs / 1000 - outcome.stateTime)) : 0,
      dropInView: false,
    };

    const me = world.first(LocalPlayer, Health, Stamina, Player, Wielder, Body);
    if (me) {
      patch.hpFraction = fraction(me[2].hp, me[2].max);
      patch.staminaFraction = fraction(me[3].value, me[3].max);
      patch.comboMultiplier = roundTo(me[5].swing?.flow ?? 1, 2);
      patch.stunned = me[2].hitstun > 0 || me[4].action === "stagger";
      patch.skillbookInHand = heldIn(me[5].hands, "skillbook") !== null;
      patch.brokenOff = me[4].brokenOff;
      patch.writingPage = me[4].writing?.page ?? null;
      patch.carried = me[4].gear;
      const facing = { x: Math.sin(ctx.view.yaw), z: Math.cos(ctx.view.yaw) };
      patch.dropInView = afterFight && pileInView(me[6].pos, facing, ctx.drops) !== null;
    }

    const enemy = world.first(Enemy, Health);
    const rival = duel ? players.findIndex((e) => !world.has(e, LocalPlayer)) : -1;
    const foe = duel ? players[rival] : enemy?.[0];
    const foeHealth = foe === undefined ? undefined : world.require(foe, Health);
    patch.duel = duel;
    patch.enemyAlive = foeHealth !== undefined && foeHealth.hp > 0;
    if (foeHealth) {
      patch.enemyName = (duel ? ctx.who[rival]?.name : enemy?.[1].def.name) ?? "";
      patch.enemyHpFraction = fraction(foeHealth.hp, foeHealth.max);
    }
    patch.cue = enemy?.[1].state === "parried" && patch.enemyAlive ? "parried"
      : me?.[4].action === "stagger" ? "staggered" : "none";

    hud.set(patch);
  };
}

/** 0..1, rounded to 0.1% so changes too small to see don't re-render the HUD. */
const fraction = (value: number, max: number) => roundTo(value / max, 3);
