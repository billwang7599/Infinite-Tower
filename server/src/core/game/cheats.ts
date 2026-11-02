import { addItem, coreAtStep, Health, Player, Stamina, type Cheat } from "@infinite-tower/shared";
import { fullVitals } from "../content/player.js";
import { QUESTS } from "../content/quests.js";
import type { GameSession } from "./session.js";
import { holds, progressStory, stepOn } from "./story.js";

export function runCheat(session: GameSession, cheat: Cheat): void {
  const battle = session.liveBattle;
  switch (cheat.kind) {
    case "encounter":
      if (session.inOverworld) {
        const spawn = session.overworld.level.spawns.find((s) => s.enemy === cheat.enemy);
        session.overworld.startEncounter(session.me, null, cheat.enemy, spawn);
      }
      return;
    case "invulnerable":
      session.invulnerable = cheat.on;
      battle?.room.edit(battle.seat, (world, me) => { world.require(me, Player).invulnerable = cheat.on; });
      session.link.send({ t: "invulnerable", on: cheat.on });
      return;
    case "give": {
      if (!session.inOverworld) return;
      const { bag, left } = addItem(session.bag, cheat.item, cheat.count);
      session.bag = bag;
      session.save();
      session.link.send({ t: "given", item: cheat.item, count: cheat.count - left, left, gear: session.gear });
      return;
    }
    case "coreStep":
      if (!session.inOverworld) return;
      session.takeCore(coreAtStep(session.core, session.core.steps + (cheat.add ? 1 : -1)));
      session.save();
      return;
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
      } else if (session.inOverworld) {
        session.vitals = fullVitals(session.stats);
        session.save();
        session.link.send({ t: "healed", vitals: session.vitals });
      }
  }
}
