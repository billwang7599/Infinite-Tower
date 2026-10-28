import { ITEM_PX } from "../../../gfx/items/items.js";

/** Screen pixels per art pixel: a 16-pixel cell is 48 on screen. */
export const SCALE = 3;
/** A bag cell on screen, in pixels. */
export const CELL = ITEM_PX * SCALE;
export const SLOT_PX = 2 * CELL;
export const SLOT_COLUMNS = 3;
export const SLOT_GAP_PX = 8;
export const EQUIPMENT_WIDTH_PX = SLOT_COLUMNS * SLOT_PX + (SLOT_COLUMNS - 1) * SLOT_GAP_PX;
export const INVENTORY_GAP_PX = 20;
