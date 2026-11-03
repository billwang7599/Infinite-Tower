import { toSteps, type ChallengeNews } from "@infinite-tower/shared";
import { DUEL_STARTS, type FightSetup } from "@infinite-tower/shared/fight";
import { getArena } from "../world/index.js";
import { fighterOf, regionHere, sparSeat, startFight } from "./battle.js";
import { LAG_SLACK_TILES } from "../overworld/interact.js";
import { nearestOtherSession, type GameSession } from "./session.js";

export const CHALLENGE_RANGE_TILES = 2;
export const CHALLENGE_TIME = 15;

interface Challenge { from: GameSession; to: GameSession; stepsLeft: number }

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
    const to = nearestOtherSession(from, this.online(), CHALLENGE_RANGE_TILES + LAG_SLACK_TILES,
      (s) => s.inOverworld && !s.overworld.playerData(s.me).fighting);
    if (!to) tell(from, { kind: "nobodyNear" });
    else if (this.challengeOf(to)) tell(from, { kind: "busy", who: to.name });
    else {
      this.open.add({ from, to, stepsLeft: toSteps(CHALLENGE_TIME) });
      tell(to, { kind: "received", from: from.name });
      tell(from, { kind: "sent", to: to.name });
    }
  }

  answer(to: GameSession, accept: boolean): void {
    const challenge = this.challengeOf(to);
    if (!challenge || challenge.to !== to) return;
    this.open.delete(challenge);
    if (!accept) tell(challenge.from, { kind: "declined", by: to.name });
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
        tell(challenge.from, { kind: "expired", with: challenge.to.name });
        tell(challenge.to, { kind: "expired", with: challenge.from.name });
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
    tell(from, { kind: "cancelled", with: to.name });
    tell(to, { kind: "cancelled", with: from.name });
  }
}

function startDuel(a: GameSession, b: GameSession): void {
  const duelists = [a, b];
  const setup: FightSetup = {
    arena: getArena(regionHere(a).duelArenaId),
    duel: true,
    enemies: [],
    players: duelists.map((s, i) => ({ ...fighterOf(s), at: DUEL_STARTS[i]! })),
  };
  for (const s of duelists) s.overworld.enterFight(s.me);
  startFight(duelists, setup, (s) => sparSeat(s, { duel: (s === a ? b : a).name }));
}
