/**
 * Duels between players: a challenge to the nearest player in reach, answered or expiring, and on accept a spar in an
 * arena of their own. A spar costs and wins nothing: both come back with the HP and stamina they went in with.
 */
import {
  distXZ, FIXED_DT, type Carried, type ChallengeNews, type Skillbook, type Vitals,
} from "@infinite-tower/shared";
import { DUEL_STARTS, type FightSetup, type PlayerResult } from "@infinite-tower/shared/fight";
import { BattleRoom } from "../battle/room.js";
import { getArena } from "../world/index.js";
import { randomSeed } from "./battle.js";
import type { GameSession } from "./session.js";

export const CHALLENGE_RANGE_TILES = 2;
export const CHALLENGE_TIME = 15;

interface Challenge { from: GameSession; to: GameSession; stepsLeft: number }

const nameOf = (session: GameSession): string => session.character?.name ?? session.account.username;
const tell = (session: GameSession, news: ChallengeNews) => session.link.send({ t: "challengeNews", news });

export class Duels {
  private readonly open = new Set<Challenge>();

  constructor(private readonly online: () => Iterable<GameSession>) {}

  challenge(from: GameSession): void {
    if (!from.inOverworld) return;
    if (this.challengeOf(from)) {
      tell(from, { kind: "busy", who: null });
      return;
    }
    const to = this.nearestInReach(from);
    if (!to) tell(from, { kind: "nobodyNear" });
    else if (this.challengeOf(to)) tell(from, { kind: "busy", who: nameOf(to) });
    else {
      this.open.add({ from, to, stepsLeft: Math.round(CHALLENGE_TIME / FIXED_DT) });
      tell(to, { kind: "received", from: nameOf(from) });
      tell(from, { kind: "sent", to: nameOf(to) });
    }
  }

  answer(to: GameSession, accept: boolean): void {
    const challenge = this.challengeOf(to);
    if (!challenge || challenge.to !== to) return;
    this.open.delete(challenge);
    if (!accept) tell(challenge.from, { kind: "declined", by: nameOf(to) });
    else if (this.stillOn(challenge)) startDuel(challenge.from, challenge.to);
    else this.callOff(challenge);
  }

  tick(): void {
    for (const challenge of this.open) {
      if (!this.stillOn(challenge)) {
        this.open.delete(challenge);
        this.callOff(challenge);
      } else if (--challenge.stepsLeft <= 0) {
        this.open.delete(challenge);
        tell(challenge.from, { kind: "expired", with: nameOf(challenge.to) });
        tell(challenge.to, { kind: "expired", with: nameOf(challenge.from) });
      }
    }
  }

  private challengeOf(session: GameSession): Challenge | undefined {
    for (const c of this.open) if (c.from === session || c.to === session) return c;
    return undefined;
  }

  private stillOn({ from, to }: Challenge): boolean {
    const online = new Set(this.online());
    return online.has(from) && online.has(to) && from.inOverworld && to.inOverworld && from.overworld === to.overworld;
  }

  private callOff({ from, to }: Challenge): void {
    tell(from, { kind: "cancelled", with: nameOf(to) });
    tell(to, { kind: "cancelled", with: nameOf(from) });
  }

  private nearestInReach(from: GameSession): GameSession | null {
    const at = from.overworld.playerPos(from.me);
    let best: { session: GameSession; dist: number } | null = null;
    for (const session of this.online()) {
      if (session === from || !session.inOverworld || session.overworld !== from.overworld) continue;
      if (session.overworld.playerData(session.me).fighting) continue;
      const dist = distXZ(at, session.overworld.playerPos(session.me));
      if (dist <= CHALLENGE_RANGE_TILES && (!best || dist < best.dist)) best = { session, dist };
    }
    return best?.session ?? null;
  }
}

function startDuel(a: GameSession, b: GameSession): void {
  const duelists = [a, b];
  const { overworld } = a;
  const setup: FightSetup = {
    arena: getArena(overworld.level.duelArenaId),
    duel: true,
    enemies: [],
    players: duelists.map((s, i) => {
      s.closeBag();
      const { bag, equipment } = s.gear;
      return {
        at: DUEL_STARTS[i]!, vitals: s.vitals, stats: s.stats, burden: s.burden, gear: { bag, equipment },
        book: s.skillbook, seed: randomSeed(overworld.rng), invulnerable: s.invulnerable,
      };
    }),
  };
  const room = new BattleRoom(setup, duelists.map((s, i) => {
    const before = { ...s.vitals }, opponent = nameOf(duelists[1 - i]!);
    return { link: s.link, onEnd: (result, _after, book, gear) => settleDuel(s, result, before, opponent, book, gear) };
  }));
  duelists.forEach((s, seat) => {
    s.overworld.enterFight(s.me);
    s.battle = { source: null, enemyId: null, room, seat, over: false };
    const other = duelists[1 - seat]!;
    s.link.send({
      t: "encounter", source: null, me: s.overworld.playerPos(s.me), seat, setup,
      opponent: { name: nameOf(other), character: other.character! },
    });
  });
}

/** The pages and gear as the duel left them (written and moved, never gained or lost), the vitals as before it. */
function settleDuel(
  session: GameSession, result: PlayerResult, before: Vitals, opponent: string, book: Skillbook, gear: Carried,
): void {
  const battle = session.battle;
  if (!battle) return;
  battle.over = true;
  session.skillbook = book;
  session.gear = { ...session.gear, ...gear };
  session.vitals = before;
  session.save();
  if (result === "left") return;
  session.link.send({
    t: "battleResult", won: result === "won", me: session.overworld.playerPos(session.me), wins: session.wins,
    vitals: session.vitals, loot: {}, leftBehind: {}, lost: {}, gear: session.gear, skillbook: session.skillbook,
    duel: opponent,
  });
}
