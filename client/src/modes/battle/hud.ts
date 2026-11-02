import {
  Body, Enemy, Health, heldIn, LocalPlayer, inView, Player, roundTo, Stamina, STATUS_DEFS, Statuses, Wielder,
  type Entity, type StatusOn, type World,
} from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import type { BattleHudState, StatusIcon } from "../../ui/state.js";
import type { Store } from "../../ui/store.js";
import { AFTER_FIGHT_BANNER_TIME, resultShown, type BattleContext } from "./context.js";

/** Writes every frame; the store drops unchanged values, so React only re-renders on real changes. */
export function hudSystem(ctx: BattleContext, hud: Store<BattleHudState>): (fight: Fight) => void {
  return ({ world, duel, players, yieldAt }) => {
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
      patch.hp = Math.ceil(me[2].hp);
      patch.hpMax = Math.round(me[2].max);
      patch.statuses = iconsOf(world, me[0], hud.get().statuses);
      patch.staminaFraction = fraction(me[3].value, me[3].max);
      patch.stunned = me[2].hitstun > 0;
      patch.skillbookInHand = heldIn(me[5].hands, "skillbook") !== null;
      patch.brokenOff = me[4].brokenOff;
      patch.writingPage = me[4].writing?.page ?? null;
      patch.carried = me[4].gear;
      patch.using = me[4].using?.at ?? null;
      patch.core = me[4].core;
      const facing = { x: Math.sin(ctx.view.yaw), z: Math.cos(ctx.view.yaw) };
      patch.dropInView = afterFight && inView(me[6].pos, facing, ctx.drops) !== null;
    }

    const enemy = world.first(Enemy, Health);
    const rival = duel ? players.findIndex((e) => !world.has(e, LocalPlayer)) : -1;
    const foe = duel ? players[rival] : enemy?.[0];
    const foeHealth = foe === undefined ? undefined : world.require(foe, Health);
    patch.duel = duel;
    patch.spar = yieldAt > 0;
    patch.enemyAlive = foeHealth !== undefined && foeHealth.hp > foeHealth.floor;
    if (foeHealth) {
      patch.enemyName = (duel ? ctx.who[rival]?.name : enemy?.[1].def.name) ?? "";
      patch.enemyHpFraction = fraction(foeHealth.hp, foeHealth.max);
      patch.enemyStatuses = iconsOf(world, foe!, hud.get().enemyStatuses);
    }
    hud.set(patch);
  };
}

/** 0..1, rounded to 0.1% so changes too small to see don't re-render the HUD. */
const fraction = (value: number, max: number) => roundTo(value / max, 3);

const iconsOf = (world: World, e: Entity, last: readonly StatusIcon[]) =>
  statusIcons(world.get(e, Statuses)?.on ?? [], last);

export function statusIcons(on: readonly StatusOn[], last: readonly StatusIcon[]): readonly StatusIcon[] {
  const icons = on.map(({ status, left, time, stacks }): StatusIcon => ({
    status, harmful: STATUS_DEFS[status].harmful, stacks,
    secondsLeft: left === null ? null : Math.ceil(left),
    shareLeft: left === null || !time ? 1 : roundTo(left / time, 2),
  }));
  icons.sort((a, b) => Number(a.harmful) - Number(b.harmful));
  const same = icons.length === last.length && icons.every((icon, i) => {
    const was = last[i]!;
    return icon.status === was.status && icon.stacks === was.stacks && icon.secondsLeft === was.secondsLeft
      && icon.shareLeft === was.shareLeft;
  });
  return same ? last : icons;
}
