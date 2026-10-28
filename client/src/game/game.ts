/**
 * Sessions and switching between the two modes (modes/overworld/, modes/battle/). A session (join -> leave) is one
 * connection; this routes its messages, keeps the settings in sync, and runs the transitions: an encounter flashes
 * into battle, leaving a decided fight fades back to the overworld, where the server's result is applied and told.
 */
import type { AbstractEngine } from "@babylonjs/core";
import {
  bagCounts, heldIn, moveGear, type Character, type GridSpot, type Hand, type ServerMsgOf, type Spell, type Spot,
} from "@infinite-tower/shared";
import type { Battle } from "../modes/battle/battle.js";
import type { Actions } from "../core/actions.js";
import { frameSeconds } from "../core/time.js";
import { PlayerLook } from "../gfx/characters.js";
import { redrawSprite } from "../gfx/sprites.js";
import type { Overworld } from "../modes/overworld/overworld.js";
import type { Connection, Joined } from "../net/connection.js";
import { startPinging, type Pinging } from "../net/ping.js";
import { restoreSettings, syncSettings, type Settings } from "../settings/settings.js";
import { say } from "../ui/notifications/say.js";
import { NO_CHANT } from "../ui/spells/chant.js";
import { whoHasTheKeys, type UiState } from "../ui/state.js";
import { exposeDebugHandles } from "./debug.js";
import { startTransition, stepTransition, type Mode, type Transition } from "./transition.js";

export interface Game {
  /** null outside a session. */
  mode(): Mode | null;
  /** On a connection the server has welcomed. */
  join(joined: Joined): void;
  /** Sends any unsent settings, hangs up, stops drawing, forgets the level and any fight. */
  leave(): void;
  /** Once the server's result is in: fade back to the overworld. */
  /** A fight's gear changed: the arena sprite is repainted at once. */
  holdSword(hand: Hand | null): void;
  leaveBattle(): void;
  rest(): void;
  useItem(at: GridSpot): void;
  moveItem(from: Spot, to: Spot, turned: boolean): void;
  castSpell(spell: Spell): void;
  saveSpell(page: number, spell: Spell): void;
  saveCharacter(character: Character): void;
}

interface GameParts {
  engine: AbstractEngine;
  actions: Actions;
  ui: UiState;
  settings: Settings;
  battle: Battle;
  overworld: Overworld;
}

export function createGame({ engine, actions, ui, settings, battle, overworld }: GameParts): Game {
  let mode: Mode | null = null;
  let net: Connection | null = null;
  let stopSync = () => {};
  let pinging: Pinging | null = null;
  let transition: Transition | null = null;
  /** The fight being flashed into or fought. */
  let encounter: ServerMsgOf<"encounter"> | null = null;
  /** Held while the player is still in the arena: applied when they leave it. */
  let result: ServerMsgOf<"battleResult"> | null = null;
  const playerLook = new PlayerLook(
    { chibi: overworld.view.materials.player, battle: battle.ctx.materials.player }, redrawSprite,
  );

  /**
   * The game only gets input during a session with no screen over it (not even the title, still clearing off the
   * world, nor the open bag), and the mouse only in the arena (captured at once there if Auto mouse lock is on).
   */
  const updateInput = () => actions.setLayers(whoHasTheKeys(ui, mode));
  ui.settingsScreen.subscribe(updateInput);
  ui.creation.subscribe(updateInput);
  ui.overworldPanel.subscribe(updateInput);
  ui.chant.subscribe(updateInput);
  ui.spellbookScreen.subscribe(updateInput);
  ui.battleBag.subscribe(updateInput);
  // The fight breaks a chant off: a stagger loses its words, a dodge keeps them; a hit that only hurts doesn't. It
  // breaks the bag off the same way, and a decided fight closes it.
  ui.battle.subscribe(() => {
    const { brokenOff, stunned, result } = ui.battle.get();
    if (brokenOff && ui.chant.get().open) ui.chant.set(stunned ? NO_CHANT : { open: false });
    if ((brokenOff || result !== "fighting") && ui.battleBag.get().open) ui.closeBattleBag();
  });
  let bagOpen = false;
  ui.overworldPanel.subscribe(() => {
    const wasOpen = bagOpen;
    bagOpen = ui.overworldPanel.get().open === "inventory";
    if (wasOpen && !bagOpen) closeBag();
  });
  ui.title.subscribe(updateInput);
  updateInput();

  const closeBag = () => {
    const gear = ui.overworld.get().gear;
    if (gear.cloth.items.length === 0) return;
    say(ui.notifications, { kind: "leftOnCloth", items: bagCounts(gear.cloth) });
    overworld.setGear({ ...gear, cloth: { ...gear.cloth, items: [] } });
    net?.send({ t: "closeBag" });
  };

  const setMode = (next: Mode | null) => {
    mode = next;
    // Panels are the overworld's: a fight, or leaving, closes them.
    if (next !== "overworld") ui.closeOverworldPanel();
    ui.closeBattleBag();
    ui.chant.set(NO_CHANT);
    ui.screen.set({ mode: next });
    updateInput();
  };

  const enterBattle = (msg: ServerMsgOf<"encounter">) => {
    const to = net;
    if (!to) return;
    result = null;
    playerLook.hold(heldIn(msg.setup.players[msg.seat]!.gear.equipment, "sword"));
    playerLook.finish();
    battle.start(msg, (m) => to.send(m));
    const enemy = msg.setup.enemies[0]?.def ?? { name: "something" };
    say(ui.notifications, { kind: "encounter", source: msg.source, enemy });
    setMode("battle");
  };

  const enterOverworld = () => {
    battle.end();
    net?.send({ t: "leaveBattle" });
    if (result) {
      overworld.onBattleResult(result);
      ui.spells.set({ book: result.spellbook });
      say(ui.notifications, { kind: "battleResult", outcome: result });
      result = null;
    }
    setMode("overworld");
  };

  /** No character yet: the creation screen opens (it closes itself), and the server holds the level back. */
  const applyCharacter = (character: Character | null) => {
    ui.overworld.set({ character });
    if (character) playerLook.wear(character.look);
    else ui.creation.set({ open: true });
  };

  const frame = (dt: number) => {
    if (transition) {
      const fade = stepTransition(transition, dt);
      ui.screen.set({ fadeColor: fade.color, fadeOpacity: fade.opacity });
      if (fade.swapNow) {
        if (transition.to === "overworld") enterOverworld();
        else if (encounter) enterBattle(encounter);
      }
      if (fade.done) transition = null;
    }
    if (mode === "overworld") {
      overworld.update(dt, transition !== null);
      overworld.render();
    } else if (mode === "battle") {
      battle.render();
    }
  };

  return {
    mode: () => mode,
    holdSword(hand) {
      playerLook.hold(hand);
      playerLook.finish();
    },
    leaveBattle() {
      if (mode !== "battle" || transition || !result) return;
      transition = startTransition("overworld");
    },
    rest() {
      if (mode === "overworld" && !transition) overworld.rest();
    },
    useItem(at) {
      if (mode === "overworld" && !transition) net?.send({ t: "useItem", at });
    },
    moveItem(from, to, turned) {
      if (mode === "battle" && !transition) battle.ctx.gearMoves.push({ from, to, turned });
      if (mode !== "overworld" || transition || !net) return;
      const moved = moveGear(ui.overworld.get().gear, from, to, turned);
      if (!moved) return;
      overworld.setGear(moved);
      net.send({ t: "moveItem", from, to, turned });
    },
    castSpell(spell) {
      if (mode === "battle" && !transition) battle.ctx.casts.push(spell);
    },
    saveSpell(page, spell) {
      if (mode === "battle") {
        if (!transition) battle.ctx.writes.push({ page, spell });
      } else net?.send({ t: "saveSpell", page, spell });
    },
    saveCharacter(character) {
      net?.send({ t: "character", character });
    },
    join(joined) {
      net = joined.net;
      restoreSettings(settings, joined.welcome.settings);
      stopSync = syncSettings(settings, net);
      pinging = startPinging(net, (ms) => ui.ping.set({ ms }));
      // Before `listen`: the level may already be waiting in the connection's backlog.
      overworld.join(joined);
      applyCharacter(joined.welcome.character);
      ui.spells.set({ known: joined.welcome.knownWords, book: joined.welcome.spellbook });
      net.listen({
        level: (msg) => overworld.onLevel(msg),
        state: (msg) => overworld.onState(msg),
        encounter(msg) {
          overworld.onEncounter(msg);
          encounter = msg;
          transition = startTransition("battle");
        },
        character: (msg) => applyCharacter(msg.character),
        rested(msg) {
          overworld.setVitals(msg.vitals);
          say(ui.notifications, { kind: "rested" });
        },
        itemUsed(msg) {
          overworld.setVitals(msg.vitals);
          overworld.setGear(msg.gear);
          say(ui.notifications, { kind: "itemUsed", item: msg.item });
        },
        gear: (msg) => overworld.setGear(msg.gear),
        spellbook: (msg) => ui.spells.set({ book: msg.spellbook }),
        battleHash: (msg) => battle.onHash(msg),
        battleSync: (msg) => battle.onSync(msg),
        battleResult(msg) {
          result = msg;
          battle.onResult(msg.won);
        },
        pong: (msg) => pinging?.pong(msg.id),
      });
      setMode("overworld");
      engine.runRenderLoop(() => frame(frameSeconds(engine)));
      exposeDebugHandles({
        battle, overworld, ui, settings, mode: () => mode,
        encounter: (enemy?: string) => net?.send({ t: "debug", cmd: "encounter", enemy }),
      });
    },
    leave() {
      if (!net) return;
      stopSync();
      stopSync = () => {};
      pinging?.stop();
      pinging = null;
      ui.ping.set({ ms: null });
      engine.stopRenderLoop();
      net.close();
      net = null;
      if (mode === "battle") battle.end();
      transition = encounter = result = null;
      overworld.leave();
      ui.settingsScreen.set({ open: false });
      ui.creation.set({ open: false });
      ui.notifications.clear();
      ui.screen.set({ fadeOpacity: 0 });
      setMode(null);
    },
  };
}

