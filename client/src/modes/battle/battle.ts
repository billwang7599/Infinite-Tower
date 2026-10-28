import {
  Body, copyInput, IDLE_INPUT, LocalPlayer, Player, sameSkill, type ClientMsg, type ServerMsgOf, type Skill,
  type Vec3,
} from "@infinite-tower/shared";
import { Fight } from "@infinite-tower/shared/fight";
import type { Actions } from "../../core/actions.js";
import type { Settings } from "../../settings/settings.js";
import type { ChantState } from "../../ui/skills/chant.js";
import type { BattleHudState, SkillsState } from "../../ui/state.js";
import type { Store } from "../../ui/store.js";
import { arenaCamera } from "./camera.js";
import { resultShown, type BattleContext, type Correction } from "./context.js";
import { hudSystem } from "./hud.js";
import { readPlayerInput } from "./input.js";
import { closestFoe, livingFoes, lockYaw, steerLock } from "./lock.js";
import { FightSync } from "./sync.js";

const HOTBAR = ["skill1", "skill2", "skill3", "skill4"] as const;

/** Where the camera looks as each fight starts. */
const START_VIEW = { yaw: 0, pitch: 0.32 } as const;

export interface Battle {
  ctx: BattleContext;
  /** Builds the server's fight from `encounter`. Your inputs go out through `send`. */
  start(encounter: ServerMsgOf<"encounter">, send: (msg: ClientMsg) => void): void;
  onHash(msg: ServerMsgOf<"battleHash">): void;
  onSync(msg: ServerMsgOf<"battleSync">): void;
  /** battleResult: now the result shows. */
  onResult(won: boolean): void;
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
  bag: Store<{ open: boolean }>;
  onLeave: () => void;
}

export function createBattle(opts: BattleOptions): Battle {
  const { actions, settings } = opts;
  const ctx: BattleContext = {
    polled: actions.poll(), actions, settings,
    view: { ...START_VIEW, eye: { x: 0, y: 0, z: 0 }, at: { x: 0, y: 0, z: 0 } },
    lock: null,
    fight: null,
    sync: null,
    outcome: { state: "fighting", stateTime: 0 },
    events: [],
    corrections: [],
    casts: [],
    writes: [],
    gearMoves: [],
  };
  const camera = arenaCamera(ctx);
  const hud = hudSystem(ctx, opts.hud);
  /** Syncs land between frames; the next frame's `corrections` are theirs. */
  let corrected: Correction[] = [];

  const input = copyInput(IDLE_INPUT);
  let casting: Skill | null = null;
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
    readPlayerInput(ctx.polled, (target && lockYaw(me, target)) ?? ctx.view.yaw, input);
    const last = casting;
    input.castHeld = last !== null && HOTBAR.some((key, i) => {
      const page = book[i];
      return ctx.polled.held.has(key) && page && sameSkill(page, last);
    });
    input.cast = last ? null : ctx.casts.shift() ?? null;
    casting = input.castHeld ? last : input.cast;
    input.locked = ctx.lock === null ? null : fight.enemies.indexOf(ctx.lock);
    input.write = input.write ? null : ctx.writes.shift() ?? null;
    input.chant = opts.chant.get().open;
    input.bag = opts.bag.get().open;
    input.gear = input.gear ? null : ctx.gearMoves.shift() ?? null;
    for (let i = 0; i < steps; i++) sync.advance(input);
    sync.flush();
    opts.skills.set({ book: fight.world.first(LocalPlayer, Player)![2].book });
  };

  /** Every fighter's position, to ease the drawings over a correction. */
  const positions = (fight: Fight): Vec3[] =>
    [...fight.players, ...fight.enemies].map((e) => ({ ...fight.world.require(e, Body).pos }));

  return {
    ctx,
    start({ setup, seat }, send) {
      ctx.fight?.dispose();
      ctx.casts = [];
      ctx.writes = [];
      ctx.gearMoves = [];
      corrected = [];
      const fight = new Fight(setup);
      fight.world.add(fight.players[seat]!, LocalPlayer, true);
      ctx.fight = fight;
      ctx.sync = new FightSync(fight, seat, send);
      ctx.outcome = ctx.sync.outcome;
      const me = fight.world.require(fight.players[seat]!, Body).pos, foes = livingFoes(fight);
      ctx.lock = closestFoe(foes, me);
      const target = foes.find((f) => f.e === ctx.lock)?.pos;
      Object.assign(ctx.view, START_VIEW, { yaw: (target && lockYaw(me, target)) ?? START_VIEW.yaw });
      ctx.polled = actions.poll();
      // The last fight's result off the HUD before it shows again (its systems write it from the next frame on).
      opts.hud.set({ result: "fighting", showResult: false });
    },
    onHash(msg) {
      ctx.sync?.onHash(msg);
    },
    onSync(msg) {
      const { fight, sync } = ctx;
      if (!fight || !sync) return;
      const before = positions(fight);
      sync.onSync(msg);
      [...fight.players, ...fight.enemies].forEach((e, i) => {
        const { pos } = fight.world.require(e, Body), was = before[i]!;
        corrected.push({ e, moved: { x: pos.x - was.x, y: pos.y - was.y, z: pos.z - was.z } });
      });
    },
    onResult(won) {
      ctx.sync?.onResult(won);
    },
    end() {
      ctx.fight?.dispose();
      ctx.fight = null;
      ctx.sync = null;
      ctx.lock = null;
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
      hud(fight.world);
    },
  };
}
