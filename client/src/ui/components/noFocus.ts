import type { MouseEvent } from "react";

/**
 * Keyboard game: a click mustn't focus a button, or Space / Enter would press it again. `keepFocus` on
 * mousedown does that; NO_FOCUS also takes the button out of the tab order.
 */
export const keepFocus = (e: MouseEvent) => e.preventDefault();
export const NO_FOCUS = { tabIndex: -1, onMouseDown: keepFocus } as const;
