import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CORE_CARD_LEFT_PX, CORE_CARD_WIDTH_PX, fitPanel, MARGIN_PX, STATUS, stacksGrids, type Size,
} from "../../../src/ui/hud/layout.js";

const SCREENS: Size[] = [
  { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 810 },
  { width: 1920, height: 1080 }, { width: 2560, height: 1440 }, { width: 900, height: 1200 },
  { width: 1110, height: 846 }, { width: 800, height: 450 },
];
const PANELS: Size[] = [{ width: 336, height: 520 }, { width: 1078, height: 540 }, { width: 1078, height: 760 }];

describe("fitPanel", () => {
  test("a panel with room keeps its size", () => {
    assert.equal(fitPanel({ width: 336, height: 520 }, { width: 1920, height: 1080 }).scale, 1);
    assert.equal(fitPanel({ width: 1078, height: 540 }, { width: 1280, height: 720 }).scale, 1);
  });

  test("a panel too big for the view shrinks, never grows", () => {
    const fit = fitPanel({ width: 1078, height: 540 }, { width: 1110, height: 846 });
    assert.ok(fit.scale < 1 && fit.scale > 0.75);
  });

  test("on every screen, every panel stays on it and clear of the status block and the core card", () => {
    for (const view of SCREENS) {
      for (const panel of PANELS) {
        const { top, right, scale } = fitPanel(panel, view);
        const left = view.width - right - panel.width * scale, bottom = top + panel.height * scale;
        const where = `${panel.width}x${panel.height} on ${view.width}x${view.height}`;
        assert.ok(right >= MARGIN_PX && bottom <= view.height - MARGIN_PX + 1e-9, where);
        assert.ok(left >= CORE_CARD_LEFT_PX + CORE_CARD_WIDTH_PX, where);
        assert.ok(left >= STATUS.right || top >= STATUS.bottom, where);
      }
    }
  });
});

describe("stacksGrids", () => {
  test("only in a window taller than it's wide", () => {
    assert.equal(stacksGrids({ width: 900, height: 1200 }), true);
    assert.equal(stacksGrids({ width: 1280, height: 720 }), false);
  });
});
