const SAVE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const isSaveName = (name: string) => SAVE_NAME.test(name);

export const toSaveName = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[-_]+|-+$/g, "").slice(0, 64) || "drawing";
