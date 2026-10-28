/**
 * Where the overworld HUD's pieces sit, in pixels, so the notices (notifications/Notices.tsx) can keep clear of
 * them.
 */
import type { OverworldPanel } from "../state.js";
import type { Gear } from "@infinite-tower/shared";
import { CELL, EQUIPMENT_WIDTH_PX, INVENTORY_GAP_PX } from "./inventory/grid.js";

/** PanelFrame's padding and border, left and right together. */
const FRAME_PX = 42;

export const CHARACTER_PANEL_WIDTH_PX = 288;
export const inventoryPanelWidthPx = ({ bag, cloth }: Gear): number =>
  EQUIPMENT_WIDTH_PX + (cloth.cols + bag.cols) * CELL + (cloth.cols > 0 ? 2 : 1) * INVENTORY_GAP_PX + FRAME_PX;

/** The side panels' width on screen (PanelFrame, at the top right). */
export const panelWidthPx = (panel: OverworldPanel, gear: Gear): number =>
  panel === "inventory" ? inventoryPanelWidthPx(gear) : CHARACTER_PANEL_WIDTH_PX;

/** The Rest button, bottom centre, by a campfire (OverworldHud.tsx). */
export const REST_BUTTON_BOTTOM_PX = 32;
export const REST_BUTTON_HEIGHT_PX = 46;
