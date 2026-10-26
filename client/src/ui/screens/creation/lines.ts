/**
 * What the System says while a new player makes their character. The System is a voice with no face: the tower's
 * guide. Edit freely; screens/creation/scene.ts plays the greeting a line at a time.
 */

export const GREETING = [
  "Welcome to the Infinite Tower.",
  "It has no top that anyone has seen. Every floor you clear, another waits above it.",
  "Before you climb, tell me who you are.",
];

/** Over the creation panel. */
export const MAKE_PROMPT = "Who are you?";

/** After Begin. Whatever is chosen here is kept for good. */
export const CONFIRM = "Once you set foot in the tower, this is who you will be. Is this you?";
export const CONFIRM_YES = "Yes";
export const CONFIRM_NO = "Not yet";

/** The server didn't answer the save. */
export const SAVE_FAILED = "Something went wrong, and you weren't saved. Try again.";

export const farewell = (name: string): string => `Then climb, ${name}.`;
