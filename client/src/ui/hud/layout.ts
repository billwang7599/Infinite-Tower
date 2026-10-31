/**
 * Where the overworld HUD's pieces sit, in pixels, so the notices (notifications/Notices.tsx) can keep clear of
 * them.
 */
import type { OverworldPanel } from "../state.js";
import type { Gear } from "@infinite-tower/shared";
import { CELL, EQUIPMENT_WIDTH_PX, GRID_FRAME_PX, INVENTORY_GAP_PX } from "./inventory/grid.js";

/** PanelFrame's padding and border, left and right together. */
const FRAME_PX = 42;

export const CHARACTER_PANEL_WIDTH_PX = 336;
/** An open pile shares the cloth's column. */
export function inventoryPanelWidthPx({ bag, cloth, pile }: Gear): number {
  const groundCols = Math.max(cloth.cols, pile.cols);
  const grids = groundCols > 0 ? 2 : 1;
  const gridsPx = (groundCols + bag.cols) * CELL + grids * (INVENTORY_GAP_PX + 2 * GRID_FRAME_PX);
  return EQUIPMENT_WIDTH_PX + gridsPx + FRAME_PX;
}

/** The side panels' width on screen (PanelFrame, at the top right). */
export const panelWidthPx = (panel: OverworldPanel, gear: Gear): number =>
  panel === "inventory" ? inventoryPanelWidthPx(gear) : CHARACTER_PANEL_WIDTH_PX;

export const CORE_CARD_LEFT_PX = 16;
export const CORE_CARD_WIDTH_PX = 128;

/** The Rest button, bottom centre, by a campfire (OverworldHud.tsx). */
export const REST_BUTTON_BOTTOM_PX = 32;
export const REST_BUTTON_HEIGHT_PX = 46;
