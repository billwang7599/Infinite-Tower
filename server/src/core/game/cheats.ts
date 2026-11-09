import { coreAtStep, distXZ, Health, Player, Stamina, stow, type Cheat, type CoreState } from "@infinite-tower/shared";
import { takeCore } from "@infinite-tower/shared/fight";
import { fullVitals } from "../content/player.js";
import { QUESTS } from "../content/quests.js";
import { startBattle } from "./battle.js";
import type { GameSession } from "./session.js";
import { holds, progressStory, stepOn } from "./story.js";

export const FAITH_CHEAT = 25;

export function runCheat(session: GameSession, cheat: Cheat): void {
  const battle = session.liveBattle;
  switch (cheat.kind) {
    case "encounter":
      if (session.inOverworld) {
        const at = session.overworld.playerPos(session.me);
        const spawn = session.overworld.map.spawns.filter((s) => s.enemy === cheat.enemy)
          .sort((a, b) => distXZ(a.at, at) - distXZ(b.at, at))[0];
        if (session.overworld.enterFight(session.me)) startBattle(session, null, cheat.enemy, spawn, cheat.count);
      }
      return;
    case "kill":
      battle?.room.edit(battle.seat, (world) => {
        for (const e of battle.room.fight.enemies) {
          const health = world.require(e, Health);
          health.hp = Math.min(health.hp, health.floor);
        }
      });
      return;
    case "invulnerable":
      session.invulnerable = cheat.on;
      battle?.room.edit(battle.seat, (world, me) => { world.require(me, Player).invulnerable = cheat.on; });
      session.link.send({ t: "invulnerable", on: cheat.on });
      return;
    case "keepInventory":
      session.keepInventory = cheat.on;
      session.link.send({ t: "keepInventory", on: cheat.on });
      return;
    case "give": {
      if (!session.inWorld) return;
      let left = 0;
      if (battle) {
        battle.room.edit(battle.seat, (world, me) => {
          const player = world.require(me, Player), stowed = stow(player.gear, cheat.item, cheat.count);
          player.gear = stowed.gear;
          left = stowed.left;
        });
      } else {
        const stowed = stow(session.gear, cheat.item, cheat.count);
        session.gear = stowed.gear;
        left = stowed.left;
        session.save();
      }
      session.link.send({ t: "given", item: cheat.item, count: cheat.count - left, left, gear: session.gear });
      return;
    }
    case "coreStep": {
      const stepped = (core: CoreState) => coreAtStep(core, core.steps + (cheat.add ? 1 : -1));
      if (battle) {
        battle.room.edit(battle.seat, (world, me) => takeCore(world, me, stepped(world.require(me, Player).core)));
      } else if (session.inWorld) {
        session.takeCore(stepped(session.core));
        session.showInArena();
        session.save();
      }
      return;
    }
    case "completeQuest": {
      if (!session.inOverworld) return;
      const ids = (["main", "side"] as const).flatMap((half) =>
        Object.keys(QUESTS).filter((id) => QUESTS[id]!.half === half));
      const quest = ids.find((id) => stepOn(session.story, id))
        ?? ids.find((id) => holds({ canStart: id }, session.story));
      if (quest) progressStory(session, [{ start: quest }, { finish: quest }]);
      else session.link.send({ t: "noQuest" });
      return;
    }
    case "faith":
      if (!session.inOverworld) return;
      session.gainFaith({ [cheat.god]: FAITH_CHEAT });
      session.save();
      return;
    case "resetSave":
      if (session.inOverworld) session.resetSave();
      return;
    case "heal":
      if (battle) {
        battle.room.edit(battle.seat, (world, me) => {
          const health = world.require(me, Health), stamina = world.require(me, Stamina);
          health.hp = health.max;
          stamina.value = stamina.max;
        });
      } else if (session.inWorld) {
        session.vitals = fullVitals(session.stats);
        session.showInArena();
        session.save();
        session.link.send({ t: "healed", vitals: session.vitals });
      }
  }
}
