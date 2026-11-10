import { Player, stow, type Cheat } from "@infinite-tower/shared";
import type { GameSession } from "./session.js";

type GiveCheat = Extract<Cheat, { kind: "give" }>;

/** The give cheat: into the asker's bag, or a named online player's (who is told who gave it). */
export function give(from: GameSession, cheat: GiveCheat): void {
  const to = cheat.to === undefined ? from : from.onlineByUsername(cheat.to);
  if (to === from) {
    if (from.inWorld) packInto(from, cheat);
    return;
  }
  if (!to?.inWorld) {
    from.link.send({ t: "giveRefused", to: cheat.to! });
    return;
  }
  const left = packInto(to, cheat, from.name);
  from.link.send({ t: "gave", to: to.account.username, item: cheat.item, count: cheat.count - left, left });
}

/** Into the fight's copy of the bag mid-fight, else the session's (saved). Returns how many didn't fit. */
function packInto(session: GameSession, { item, count }: GiveCheat, giver?: string): number {
  const battle = session.liveBattle;
  let left = 0;
  if (battle) {
    battle.room.edit(battle.seat, (world, me) => {
      const player = world.require(me, Player), stowed = stow(player.gear, item, count);
      player.gear = stowed.gear;
      left = stowed.left;
    });
  } else {
    const stowed = stow(session.gear, item, count);
    session.gear = stowed.gear;
    left = stowed.left;
    session.save();
  }
  const fromOther = giver === undefined ? {} : { from: giver };
  session.link.send({ t: "given", item, count: count - left, left, gear: session.gear, ...fromOther });
  return left;
}
