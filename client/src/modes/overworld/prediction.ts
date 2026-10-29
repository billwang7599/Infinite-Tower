/**
 * Client-side prediction for the local player. Each fixed tick: read the keys, move locally with the
 * shared walking rules (instant response), and send the input to the server if it moves. When a
 * server `state` arrives, restart from the server's position and replay the inputs it hasn't
 * processed yet. Same code + same inputs = same result, so normally nothing visibly corrects.
 */
import { FIXED_DT, stepWalker, type Entity, type Vec2, type WalkInput, type World } from "@infinite-tower/shared";
import type { Connection } from "../../net/connection.js";
import { OverworldActor, OverworldPos, type OverworldState } from "./components.js";
import { faceToward } from "./facing.js";

export class Prediction {
  private seq = 0;
  private pending: (WalkInput & { seq: number })[] = [];
  /** Share of normal walking speed, from the bag's weight (`walkPace`), as the server walks it. */
  pace = 1;

  constructor(
    private readonly world: World,
    private readonly state: OverworldState,
    private readonly player: Entity,
    private readonly net: Connection,
  ) {}

  step(input: WalkInput): void {
    // Until the server's `level` arrives there's nothing to walk on here, so nothing is predicted or sent.
    if (!this.state.level) return;
    // Standing still isn't sent: it doesn't move the player, and the server already stops a player
    // whose input queue is empty, so the replay comes out the same without it.
    if (input.moveX === 0 && input.moveZ === 0) { this.move(input); return; }
    const msg = { seq: ++this.seq, moveX: input.moveX, moveZ: input.moveZ };
    this.pending.push(msg);
    this.net.send({ t: "input", ...msg });
    this.move(msg);
  }

  /** Server state: `ack` = last input it simulated, `at` = where that left the player. */
  reconcile(ack: number, at: Vec2): void {
    this.pending = this.pending.filter((p) => p.seq > ack);
    this.place(at);
    for (const p of this.pending) this.move(p);
  }

  /** The server moved the player (encounter, respawn): drop unconfirmed inputs. */
  reset(at: Vec2): void {
    this.pending = [];
    this.place(at);
    const actor = this.world.require(this.player, OverworldActor);
    actor.vx = actor.vz = 0;
  }

  private place(at: Vec2): void {
    const pos = this.world.require(this.player, OverworldPos);
    pos.x = at.x;
    pos.z = at.z;
  }

  private move(input: WalkInput): void {
    const level = this.state.level;
    if (!level) return;
    const pos = this.world.require(this.player, OverworldPos);
    const actor = this.world.require(this.player, OverworldActor);
    stepWalker(level, pos, input, FIXED_DT, { vel: actor, pace: this.pace });
    actor.heading = faceToward(actor.heading, input.moveX, input.moveZ);
  }
}
