/**
 * Colors, Arknights-style: greyed, cool and quiet, with one bright accent per character (the eyes and the
 * accent ramp). Every material is a ramp of six tones (pixels.ts): outline, deep, shadow, base, light, shine.
 * Outlines are a dark shade of the material itself, never black; shadows lean pink on skin and cool elsewhere.
 */

export type Ramp = readonly [string, string, string, string, string, string];

/** Warm, with red-brown outlines and salmon-pink shadows: skin is the one warm thing on a cool picture. */
export const SKIN = {
  porcelain: ["#8a3a42", "#c67c80", "#eeb1aa", "#fde8de", "#fff4ee", "#ffffff"],
  light: ["#8e3330", "#cb6a62", "#eea08f", "#fddcc7", "#fff0e2", "#fffaf4"],
  tan: ["#7a3326", "#ad5f48", "#d39176", "#efc09f", "#f8d8bd", "#fdeedf"],
  brown: ["#552418", "#86452f", "#a6654b", "#c38968", "#d8a687", "#ecc7ad"],
  dark: ["#33140d", "#5c2e1f", "#78442f", "#955e45", "#ad785d", "#c8987e"],
} as const satisfies Record<string, Ramp>;

/** Hair is greyed too: blue-black, ash, wheat, dusty rose. */
export const HAIR = {
  black: ["#111118", "#1c1d26", "#282a35", "#373a48", "#4f5363", "#7d8296"],
  brown: ["#1c1512", "#322521", "#4a3a32", "#655146", "#836e60", "#ad9886"],
  blonde: ["#4f4232", "#857356", "#ab9874", "#cbbb94", "#e3d7b5", "#f7f1de"],
  red: ["#260e11", "#46191d", "#662629", "#843838", "#a1534b", "#c4857a"],
  pink: ["#4a2d37", "#7d5262", "#a07585", "#bf98a6", "#d8bbc5", "#f1e1e6"],
  silver: ["#393e4a", "#6b7383", "#949bab", "#bcc1cd", "#dcdfe7", "#f7f8fa"],
  blue: ["#121925", "#212b40", "#323f5a", "#465674", "#637392", "#97a3bd"],
  green: ["#10201e", "#1d3633", "#2c4c47", "#3f655e", "#5d827a", "#93b0a7"],
} as const satisfies Record<string, Ramp>;

/** Iris colors: the brightest thing on a character. The deep tone is the lid's shadow on the iris. */
export const EYES = {
  amber: ["#26150e", "#55301e", "#87502e", "#b8783d", "#dba25a", "#f5d79e"],
  blue: ["#0e1b33", "#1d3e6b", "#2d649c", "#4a90c6", "#82bde3", "#d6edf9"],
  teal: ["#0b2725", "#174842", "#246f62", "#3c9c88", "#76c6b0", "#cdeee4"],
  red: ["#2b0b11", "#591521", "#8b2331", "#bd3b44", "#e06f6b", "#f7c6ba"],
  gold: ["#372407", "#6b450f", "#a06d1b", "#cf9d33", "#eac76a", "#fbedc2"],
  violet: ["#1d1133", "#3b2460", "#5c3c8c", "#8360b6", "#ad90d6", "#e2d6f3"],
} as const satisfies Record<string, Ramp>;

/** Outfit colors: mostly black, grey and white, like Arknights' uniforms. */
export const DYES = {
  soot: ["#09090c", "#131318", "#1d1d24", "#292932", "#3d3d48", "#61616d"],
  ash: ["#1c1d21", "#36383e", "#50535a", "#6c7079", "#8b8f99", "#b2b6c0"],
  chalk: ["#36373d", "#74767f", "#a1a4ad", "#c8cbd2", "#e2e4e9", "#f7f8f9"],
  slate: ["#0e121a", "#1b2230", "#283244", "#3a465b", "#556279", "#808ca1"],
  oxblood: ["#180a0d", "#31151a", "#482025", "#612c31", "#7b4442", "#9f675e"],
  moss: ["#111410", "#1f251b", "#2d3627", "#3f4a36", "#58664a", "#7e8b6b"],
} as const satisfies Record<string, Ramp>;

/** The one bright color on the clothes: trim, cords, piping. */
export const ACCENTS = {
  orange: ["#3a1806", "#6e300c", "#a54d14", "#d9701f", "#f19a48", "#ffd2a0"],
  cyan: ["#06262e", "#0d4a57", "#167384", "#25a2b3", "#5fcbd5", "#c4f1f3"],
  crimson: ["#2e0710", "#5a0f20", "#891a30", "#b82c42", "#da5a66", "#f6b8b8"],
  gold: ["#33230a", "#5f4313", "#8d661e", "#bb912f", "#dbb95b", "#f6e5ad"],
  violet: ["#1e1033", "#3b2063", "#5a3394", "#7d4fc2", "#a684de", "#e1d3f6"],
  white: ["#3a3c44", "#7b7e88", "#aeb1ba", "#d9dbe0", "#eeeff2", "#ffffff"],
} as const satisfies Record<string, Ramp>;

/** Materials every character shares, whatever they picked. Gear brings its own (leather, iron...) here too. */
export const FIXED = {
  /** Lash lines, mouth lines: near black, a little warm. */
  line: ["#140f14", "#251b24", "#382a35", "#4f3c49", "#6f5865", "#9a8590"],
  /** Eye whites: blue-grey in the shade so they don't glare. */
  white: ["#5f6378", "#9da2b8", "#c9cdde", "#eef0f7", "#ffffff", "#ffffff"],
  /** Inside an open mouth. */
  mouth: ["#3e1820", "#682836", "#8a3a48", "#ad5762", "#cc7f86", "#f0bcc0"],
  /** Cheeks. */
  blush: ["#a85a68", "#cf7f88", "#e6a3a6", "#f2c2c0", "#f8d8d4", "#fdeeec"],
  /** Unbleached, gone grey. */
  linen: ["#2c2b2a", "#525050", "#71706d", "#918f8a", "#b0aea8", "#d1cfc9"],
  wool: ["#121216", "#212128", "#2f2f38", "#40404b", "#585864", "#7e7e8a"],
  leather: ["#140e0b", "#251a14", "#36261d", "#4a3428", "#624738", "#856651"],
  /** Tarnished, with a little shine left. */
  brass: ["#251c0c", "#413218", "#5d4823", "#7c6232", "#9d8148", "#cdb577"],
  /** Blades: cold grey, the brightest thing in the arena after the eyes. */
  steel: ["#191c23", "#353b47", "#5c6472", "#8f98a7", "#c4ccd8", "#f2f5fa"],
} as const satisfies Record<string, Ramp>;
