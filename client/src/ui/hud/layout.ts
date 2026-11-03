import { useEffect, useState } from "react";
import { COMPASS } from "./compassMarks.js";

export interface Size {
  width: number;
  height: number;
}

export const MARGIN_PX = 16;

export const CORE_CARD_LEFT_PX = 16;
export const CORE_CARD_WIDTH_PX = 128;

/** The Rest button, bottom centre, by a campfire (OverworldHud.tsx). */
export const REST_BUTTON_BOTTOM_PX = 32;
export const REST_BUTTON_HEIGHT_PX = 46;

// Must match PlayerBars' left-4 w-75 (300 px).
export const STATUS = { right: 16 + 300, bottom: 88 };
const PANEL_TOP_PX = 56;

// The region's name, the ping and the four buttons: 454 px measured with "Highmere: Castle Ward".
export const TOP_RIGHT = { top: 12, bottom: 12 + 36, widthPx: 470 };

export function fitCompass(view: Size): { top: number } {
  const left = (view.width - COMPASS.widthPx) / 2, right = left + COMPASS.widthPx;
  const clearOfStatus = left >= STATUS.right + MARGIN_PX;
  if (clearOfStatus && right <= view.width - TOP_RIGHT.widthPx - 2 * MARGIN_PX) {
    return { top: TOP_RIGHT.top + (TOP_RIGHT.bottom - TOP_RIGHT.top - COMPASS.heightPx) / 2 };
  }
  return { top: (clearOfStatus ? TOP_RIGHT.bottom : Math.max(STATUS.bottom, TOP_RIGHT.bottom)) + MARGIN_PX / 2 };
}

// The room that shrinks the panel least wins; the first on a tie.
const PANEL_ROOMS = [
  { top: PANEL_TOP_PX, left: STATUS.right + MARGIN_PX },
  { top: STATUS.bottom + MARGIN_PX / 2, left: CORE_CARD_LEFT_PX + CORE_CARD_WIDTH_PX + MARGIN_PX },
];

interface PanelFit {
  top: number;
  right: number;
  scale: number;
}

export function fitPanel(panel: Size, view: Size): PanelFit {
  let best: PanelFit | null = null;
  for (const room of PANEL_ROOMS) {
    const width = view.width - room.left - MARGIN_PX, height = view.height - room.top - MARGIN_PX;
    const scale = Math.max(0, Math.min(1, width / panel.width, height / panel.height));
    if (!best || scale > best.scale) best = { top: room.top, right: MARGIN_PX, scale };
  }
  return best!;
}

export const stacksGrids = (view: Size): boolean => view.height > view.width;

const stageSize = (): Size => {
  const stage = document.getElementById("stage");
  return { width: stage?.clientWidth ?? innerWidth, height: stage?.clientHeight ?? innerHeight };
};

export function useStageSize(): Size {
  const [size, setSize] = useState(stageSize);
  useEffect(() => {
    const stage = document.getElementById("stage");
    if (!stage) return;
    const observer = new ResizeObserver(() => setSize(stageSize()));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  return size;
}
