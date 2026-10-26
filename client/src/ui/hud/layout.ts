/**
 * Where the overworld HUD's pieces sit, in pixels, so the notices (notifications/Notices.tsx) can keep clear of
 * them.
 */
import type { OverworldPanel } from "../state.js";
import { CELL } from "./inventory/grid.js";

/** PanelFrame's padding and border, left and right together. */
const FRAME_PX = 42;

export const CHARACTER_PANEL_WIDTH_PX = 288;
/** The bag's panel fits its grid. */
export const bagPanelWidthPx = (bagCols: number): number => bagCols * CELL + FRAME_PX;

/** The side panels' width on screen (PanelFrame, at the top right). */
export const panelWidthPx = (panel: OverworldPanel, bagCols: number): number =>
  panel === "inventory" ? bagPanelWidthPx(bagCols) : CHARACTER_PANEL_WIDTH_PX;

/** The Rest button, bottom centre, by a campfire (OverworldHud.tsx). */
export const REST_BUTTON_BOTTOM_PX = 32;
export const REST_BUTTON_HEIGHT_PX = 46;
