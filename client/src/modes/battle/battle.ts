import {
  Body, copyInput, IDLE_INPUT, LocalPlayer, Player, sameSkill, type ServerMsgOf, type Skill,
  type Vec3, type Word,
} from "@infinite-tower/shared";
import { Fight } from "@infinite-tower/shared/fight";
import type { Actions } from "../../core/actions.js";
import type { Net } from "../../net/net.js";
import type { Settings } from "../../settings/settings.js";
import type { ChantState } from "../../ui/skills/chant.js";
import type { BattleHudState, PanelState, SkillsState } from "../../ui/state.js";
import type { Store } from "../../ui/store.js";
import { arenaCamera } from "./camera.js";
import { resultShown, type BattleContext, type Correction } from "./context.js";
import { hudSystem } from "./hud.js";
import { pickedWay, readPlayerInput } from "./input.js";
import { closestFoe, livingFoes, lockYaw, steerLock } from "./lock.js";
import { FightSync } from "./sync.js";

const HOTBAR = ["skill1", "skill2", "skill3", "skill4"] as const;

/** Where the camera looks as each fight starts. */
const START_VIEW = { yaw: 0, pitch: 0.32 } as const;
const START_WAY = "tb";

export interface Battle {
  ctx: BattleContext;
  start(encounter: ServerMsgOf<"encounter">, net: Pick<Net, "send" | "on">): void;
  /** battleResult: now the result shows. */
  onResult(result: ServerMsgOf<"battleResult">): void;
  /** Leaving the arena: the fight's copy is dropped. */
  end(): void;
  update(dt: number): void;
}

export interface BattleOptions {
  actions: Actions;
  settings: Settings;
  hud: Store<BattleHudState>;
  skills: Store<SkillsState>;
  chant: Store<ChantState>;
  panel: Store<PanelState>;
  onLeave: () => void;
}

export function createBattle(opts: BattleOptions): Battle {
  const { actions, settings } = opts;
  const ctx: BattleContext = {
    polled: actions.poll(), actions, settings,
    view: { ...START_VIEW, eye: { x: 0, y: 0, z: 0 }, at: { x: 0, y: 0, z: 0 } },
    lock: null,
    way: START_WAY,
    who: [],
    fight: null,
    sync: null,
    outcome: { state: "fighting", stateTime: 0 },
    afterFightMs: null,
    drops: [],
    events: [],
    corrections: [],
    casts: [],
    writes: [],
    gearMoves: [],
    uses: [],
  };
  const camera = arenaCamera(ctx);
  const hud = hudSystem(ctx, opts.hud);
  /** Syncs land between frames; the next frame's `corrections` are theirs. */
  let corrected: Correction[] = [];
  let unsubscribe: (() => void)[] = [];

  const input = copyInput(IDLE_INPUT);
  let casting: Skill | null = null;
  let sentWords: readonly Word[] = [];
  let wordsDue: readonly Word[] | null = null;
  /** The fight's steps due this frame, with the keys as they are now. */
  const runFight = (fight: Fight, sync: FightSync) => {
    // None due (held back: ahead of the server's clock): the keys wait, so a tap isn't lost.
    const steps = sync.pace.stepsDue(fight.steps);
    if (steps === 0) return;
    ctx.polled = actions.poll();
    if (ctx.polled.pressed.includes("leave") && resultShown(ctx.outcome)) opts.onLeave();
    const [, , { pos: me }, { book }] = fight.world.first(LocalPlayer, Body, Player)!;
    for (const action of ctx.polled.pressed) {
      const written = book[HOTBAR.indexOf(action as (typeof HOTBAR)[number])];
      if (written) ctx.casts.push(written);
    }
    const foes = livingFoes(fight);
    ctx.lock = steerLock(ctx.lock, ctx.polled.pressed, foes, { pos: ctx.view.eye, yaw: ctx.view.yaw }, me);
    const target = foes.find((f) => f.e === ctx.lock)?.pos;
    ctx.way = pickedWay(ctx.polled, ctx.way);
    readPlayerInput(ctx.polled, (target && lockYaw(me, target)) ?? ctx.view.yaw, ctx.way, input);
    const last = casting;
    input.castHeld = last !== null && HOTBAR.some((key, i) => {
      const page = book[i];
      return ctx.polled.held.has(key) && page && sameSkill(page, last);
    });
    input.cast = last ? null : ctx.casts.shift() ?? null;
    casting = input.castHeld ? last : input.cast;
    input.locked = ctx.lock === null ? null : fight.targets.indexOf(ctx.lock);
    input.write = input.write ? null : ctx.writes.shift() ?? null;
    const { open, words } = opts.chant.get();
    input.chant = open;
    if (words !== sentWords) wordsDue = sentWords = words;
    input.chantWords = input.chantWords ? null : wordsDue;
    if (input.chantWords) wordsDue = null;
    input.bag = opts.panel.get().open === "inventory";
    input.gear = input.gear ? null : ctx.gearMoves.shift() ?? null;
    input.use = input.use ? null : ctx.uses.shift() ?? null;
    for (let i = 0; i < steps; i++) sync.advance(input);
    sync.flush();
    opts.skills.set({ book: fight.world.first(LocalPlayer, Player)![2].book });
  };

  /** Every fighter's position, to ease the drawings over a correction. */
  const positions = (fight: Fight): Vec3[] =>
    [...fight.players, ...fight.enemies].map((e) => ({ ...fight.world.require(e, Body).pos }));

  return {
    ctx,
    start({ setup, seat, joined }, net) {
      ctx.fight?.dispose();
      for (const off of unsubscribe) off();
      ctx.casts = [];
      ctx.writes = [];
      ctx.gearMoves = [];
      ctx.uses = [];
      corrected = [];
      sentWords = opts.chant.get().words;
      wordsDue = null;
      const fight = new Fight(setup);
      fight.world.add(fight.players[seat]!, LocalPlayer, true);
      ctx.fight = fight;
      const sync = new FightSync(fight, seat, (msg) => net.send(msg));
      ctx.sync = sync;
      const correcting = (load: () => void) => {
        const before = positions(fight);
        load();
        const after = positions(fight);
        [...fight.players, ...fight.enemies].forEach((e, i) => {
          const was = before[i], pos = after[i]!;
          if (was) corrected.push({ e, moved: { x: pos.x - was.x, y: pos.y - was.y, z: pos.z - was.z } });
        });
      };
      unsubscribe = [
        net.on("battleHash", (msg) => sync.onHash(msg)),
        net.on("battleSync", (msg) => correcting(() => sync.onSync(msg))),
        net.on("battleInputs", (msg) => correcting(() => sync.onInputs(msg))),
        net.on("battleJoined", ({ player }) => {
          sync.onJoined(player);
          ctx.who.push(player.who);
        }),
        net.on("arenaDrops", ({ piles }) => {
          ctx.drops = piles;
        }),
      ];
      // Taken by another join on the way in, it's out of date: the server's fight is asked for instead.
      if (joined && joined.fight.players.length === fight.players.length) {
        sync.onSync({ t: "battleSync", step: joined.step, fight: joined.fight, lateSteps: 0, heardStep: joined.step });
      }
      ctx.who = setup.players.map((p) => p.who);
      ctx.outcome = sync.outcome;
      ctx.afterFightMs = null;
      ctx.drops = [];
      const me = fight.world.require(fight.players[seat]!, Body).pos, foes = livingFoes(fight);
      ctx.lock = closestFoe(foes, me);
      ctx.way = START_WAY;
      const target = foes.find((f) => f.e === ctx.lock)?.pos;
      Object.assign(ctx.view, START_VIEW, { yaw: (target && lockYaw(me, target)) ?? START_VIEW.yaw });
      ctx.polled = actions.poll();
      // The last fight's result off the HUD before it shows again (its systems write it from the next frame on).
      opts.hud.set({ result: "fighting", showResult: false });
    },
    onResult({ won, afterFightMs }) {
      ctx.afterFightMs = afterFightMs;
      ctx.sync?.onResult(won, afterFightMs !== null);
    },
    end() {
      for (const off of unsubscribe) off();
      unsubscribe = [];
      ctx.fight?.dispose();
      ctx.fight = null;
      ctx.sync = null;
      ctx.lock = null;
      ctx.drops = [];
      corrected = [];
    },
    update(dt) {
      ctx.corrections = corrected;
      corrected = [];
      const { fight, sync } = ctx;
      if (!fight || !sync) {
        ctx.events = [];
        return;
      }
      runFight(fight, sync);
      ctx.events = sync.events.splice(0);
      camera(fight, dt);
      hud(fight);
    },
  };
}
