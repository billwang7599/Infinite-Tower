import { bagCounts, coreStats, moveGear, NO_PILE, type ClientMsg, type DialogueOffer } from "@infinite-tower/shared";
import type { Audio } from "../audio/audio.js";
import { bagSound } from "../audio/sounds.js";
import type { Battle } from "../modes/battle/battle.js";
import type { Overworld } from "../modes/overworld/overworld.js";
import type { Net } from "../net/net.js";
import { say } from "../ui/notifications/say.js";
import { NO_CHANT } from "../ui/skills/chant.js";
import type { GameRequests, UiRequest, UiState } from "../ui/state.js";
import type { Mode } from "./transition.js";

export interface Session {
  mode(): Mode | null;
  /** Flashing into a fight or fading out of one: nothing is asked meanwhile. */
  switching(): boolean;
  net(): Net | null;
}

interface RequestParts {
  ui: UiState;
  audio: Audio;
  battle: Battle;
  overworld: Overworld;
}

const OVERWORLD_ONLY: ReadonlySet<UiRequest["t"]> = new Set([
  "buy", "sell", "exchange", "carve", "uncarve", "challenge",
]);

export function createRequests(
  session: Session, { ui, audio, battle, overworld }: RequestParts,
): Omit<GameRequests, "leaveBattle" | "setDayClock"> {
  const send = (msg: ClientMsg) => session.net()?.send(msg);
  let bagOpen = false;
  ui.overworldPanel.subscribe(() => {
    const wasOpen = bagOpen;
    bagOpen = ui.overworldPanel.get().open === "inventory";
    if (wasOpen && !bagOpen) closeBag();
  });
  let battleBagOpen = false;
  ui.battleBag.subscribe(() => {
    const wasOpen = battleBagOpen;
    battleBagOpen = ui.battleBag.get().open;
    if (wasOpen && !battleBagOpen) closeBag();
  });
  // The fight breaks a chant off: a stagger loses its words, a dodge keeps them; a hit that only hurts doesn't. It
  // breaks the bag off the same way, and the fight's result closes it (after a win it opens again on the server's
  // gear, for the drops).
  let shownResult = ui.battle.get().result;
  ui.battle.subscribe(() => {
    const { brokenOff, stunned, result } = ui.battle.get();
    const decided = result !== shownResult && result !== "fighting";
    shownResult = result;
    if (brokenOff && ui.chant.get().open) ui.chant.set(stunned ? NO_CHANT : { open: false });
    if ((brokenOff || decided) && ui.battleBag.get().open) ui.closeBattleBag();
  });
  const closeBag = () => {
    const { gear, using } = ui.you.get(), shopOpen = ui.shop.get().view !== null;
    if (gear.cloth.items.length === 0 && gear.pile.cols === 0 && !using && !shopOpen) return;
    ui.shop.set({ view: null });
    if (gear.cloth.items.length > 0) say(ui.notifications, { kind: "leftOnCloth", items: bagCounts(gear.cloth) });
    overworld.setGear({ ...gear, cloth: { ...gear.cloth, items: [] }, pile: NO_PILE });
    send({ t: "closeBag" });
  };

  const takeOffer = (offer: DialogueOffer) => {
    ui.closeDialogue();
    if (offer.kind === "shop") send({ t: "openShop" });
    else if (offer.kind === "train") send({ t: "train" });
    else if (offer.kind === "quest") send({ t: "acceptQuest", quest: offer.quest });
    else send({ t: "deliver", quest: offer.quest });
  };
  const afterFight = () => session.mode() === "battle" && !session.switching() && battle.ctx.afterFightMs !== null;

  return {
    request(msg) {
      if (!OVERWORLD_ONLY.has(msg.t) || (session.mode() === "overworld" && !session.switching())) send(msg);
    },
    takeOffer,
    interact() {
      if (session.switching()) return;
      if (ui.dialogue.get().open) {
        const offer = ui.nextLine();
        if (offer) takeOffer(offer);
      } else if (session.mode() === "battle") {
        if (!ui.battle.get().dropInView) return;
        send({ t: "openPile" });
        if (!battleBagOpen) ui.toggleBattleBag();
      } else if (session.mode() === "overworld" && overworld.interact() === "openPile" && !bagOpen) {
        ui.toggleOverworldPanel("inventory");
      }
    },
    answerChallenge(accept) {
      ui.challenge.set({ from: null });
      send({ t: "answerChallenge", accept });
    },
    useItem(at) {
      if (session.switching()) return;
      if (session.mode() === "battle" && !afterFight()) battle.ctx.uses.push(at);
      else if (session.mode() === "overworld" || afterFight()) send({ t: "useItem", at });
    },
    moveItem(from, to, turned) {
      if (session.switching()) return;
      audio.play(bagSound(from, to));
      if (session.mode() === "battle" && !afterFight()) battle.ctx.gearMoves.push({ from, to, turned });
      if ((session.mode() !== "overworld" && !afterFight()) || !session.net()) return;
      const { gear, core } = ui.you.get();
      const moved = core && moveGear(gear, from, to, turned, coreStats(core).strength);
      if (!moved) return;
      overworld.setGear(moved);
      send({ t: "moveItem", from, to, turned });
    },
    castSkill(skill) {
      if (session.mode() === "battle" && !session.switching()) battle.ctx.casts.push(skill);
    },
    saveSkill(page, skill) {
      if (session.mode() === "battle" && !afterFight()) {
        if (!session.switching()) battle.ctx.writes.push({ page, skill });
      } else send({ t: "saveSkill", page, skill });
    },
  };
}
