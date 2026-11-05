import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BOW } from "@infinite-tower/shared";
import {
  BOW_MOTION, moveBow, restingBow, shownPull, type BowDraw, type BowMotion,
} from "../../../src/visuals/battle/bowMotion.js";

const FRAME_TIME = 1 / 60;
const { fullTime, minTime } = BOW.draw, { quiverTime } = BOW.nock;
const drawing = (t: number): BowDraw => ({ drawn: Math.min(1, t / fullTime), nocked: true, loosedTime: null });
const loosing = (t: number): BowDraw => ({ drawn: 0, nocked: false, loosedTime: t });
const carrying: BowDraw = { drawn: 0, nocked: false, loosedTime: null };

function run(m: BowMotion, forTime: number, at: (t: number) => BowDraw | null, each?: (m: BowMotion) => void): void {
  for (let t = 0; t < forTime - 1e-9; t += FRAME_TIME) {
    moveBow(m, at(t), FRAME_TIME);
    each?.(m);
  }
}

describe("a bow's draw, eased so nothing jumps", () => {
  test("drawing raises the bow within a tap's least draw, without a jump", () => {
    const m = restingBow();
    let last = m.raise, most = 0;
    run(m, minTime, drawing, ({ raise }) => {
      most = Math.max(most, raise - last);
      last = raise;
    });
    assert.ok(m.raise > 0.95, `raised to ${m.raise}`);
    assert.ok(most < 0.2, `rose ${most} in a frame`);
  });

  test("the drawing hand follows the draw shown, quick off the brace, slowing to the full draw, on the string", () => {
    assert.ok(shownPull(0.5) > 0.5 && shownPull(0) === 0 && shownPull(1) === 1);
    const m = restingBow();
    run(m, fullTime / 2, drawing, (now) => assert.ok(Math.abs(now.string - now.hand) < 1e-9, "the string at the hand"));
    assert.ok(Math.abs(m.hand - shownPull(0.5)) < 0.1, `half drawn: ${m.hand}`);
    run(m, fullTime, (t) => drawing(fullTime / 2 + t));
    assert.ok(Math.abs(m.hand - 1) < 0.01 && Math.abs(m.string - 1) < 0.01, "fully drawn");
  });

  test("loosed, the string snaps past the brace at once and settles; the hand stays back, then flicks off", () => {
    const m = restingBow();
    run(m, fullTime * 0.6, drawing);
    const pulled = m.hand;
    moveBow(m, loosing(FRAME_TIME), FRAME_TIME);
    assert.ok(m.string < 0, `the string past the brace: ${m.string}`);
    assert.ok(Math.abs(m.hand - pulled) < 0.02, "the hand where it let go");
    let swing = 0;
    run(m, quiverTime, (t) => loosing(2 * FRAME_TIME + t), (now) => {
      swing = Math.max(swing, -now.string);
    });
    assert.ok(swing <= BOW_MOTION.snap.share * pulled + 1e-9, `rang out ${swing} at most`);
    assert.ok(Math.abs(m.string) < 0.01, `settled at the brace: ${m.string}`);
    assert.ok(Math.abs(m.hand - pulled) < 0.02, "the hand still back");
    assert.ok(m.flick > 0.95, `flicked off: ${m.flick}`);
    assert.ok(m.raise > 0.95, "held up through the loose");
    run(m, 0.4, () => carrying);
    assert.ok(m.raise < 0.05, `lowered after: ${m.raise}`);
  });

  test("drawn again right after a loose, the hand comes back to the string, which waits at the brace", () => {
    const m = restingBow();
    run(m, fullTime, drawing);
    run(m, quiverTime, loosing);
    run(m, 0.05, () => carrying);
    let lastHand = m.hand, most = 0;
    run(m, minTime, drawing, (now) => {
      assert.ok(now.string <= now.hand + 1e-9 && now.string <= shownPull(minTime / fullTime) + 1e-9, "never behind");
      most = Math.max(most, Math.abs(now.hand - lastHand));
      lastHand = now.hand;
    });
    assert.ok(most < 0.3, `the hand jumped ${most}`);
    assert.ok(Math.abs(m.string - m.hand) < 0.05, `back on the string: ${m.hand} vs ${m.string}`);
    assert.ok(m.flick < 0.05, "no longer flicked");
  });

  test("a draw broken off (no loose) is let down, the string going forward with the hand", () => {
    const m = restingBow();
    run(m, fullTime / 2, drawing);
    run(m, 0.3, () => carrying, (now) => assert.ok(Math.abs(now.string - now.hand) < 1e-9, "the string at the hand"));
    assert.ok(m.hand < 0.05 && m.raise < 0.2, `let down: ${m.hand}, ${m.raise}`);
  });

  test("with no bow drawn (down, or none in hand) it lowers", () => {
    const m = restingBow();
    run(m, fullTime, drawing);
    run(m, 0.4, () => null);
    assert.ok(m.raise < 0.05);
  });
});
