import type { StatusIcon } from "../state.js";

// `path`: an SVG path on a 24 x 24 box, filled even-odd.
export const STATUS_LOOKS: Record<StatusIcon["status"], { name: string; color: string; path: string }> = {
  burning: {
    name: "Burning", color: "#ff7a3c",
    path: "M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 2 4 1-3 0-6 1-9z",
  },
  wet: { name: "Wet", color: "#5aa8ff", path: "M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13z" },
  rooted: { name: "Rooted", color: "#b08a52", path: "M11 2h2v8l5 5-1.4 1.4-3.6-3.6V22h-2v-9.2l-3.6 3.6L6 15l5-5z" },
  shocked: { name: "Shocked", color: "#f2e15a", path: "M13 2 4 14h6l-1 8 9-12h-6z" },
  marked: {
    name: "Marked", color: "#fff1b8",
    path: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM10.5 10.5h3v3h-3z",
  },
  cursed: { name: "Cursed", color: "#a77be0", path: "M15 3a9 9 0 1 0 6 15A8 8 0 0 1 15 3z" },
  shielded: { name: "Shielded", color: "#ffe9a0", path: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" },
  empowered: { name: "Empowered", color: "#ff9a5a", path: "M12 1l2 3v11h3v2h-4v5h-2v-5H7v-2h3V4z" },
  warded: { name: "Warded", color: "#c9a874", path: "M12 2l8.7 5v10L12 22l-8.7-5V7zm0 4-5 3v6l5 3 5-3V9z" },
  hasted: { name: "Hasted", color: "#a8f0d8", path: "M3 5h2.5l7 7-7 7H3l7-7zm8 0h2.5l7 7-7 7H11l7-7z" },
  charged: {
    name: "Charged", color: "#f5e66a",
    path: "M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm1 4-6 9h4l-1 5 6-9h-4z",
  },
  siphoning: { name: "Siphoning", color: "#d0506a", path: "M12 21 3.5 12.5A5 5 0 0 1 12 6a5 5 0 0 1 8.5 6.5z" },
  frenzy: { name: "Frenzy", color: "#ff6a3c", path: "M4 3h3l4 18H9zM10 3h3l3 18h-2zM16 3h3l2 18h-2z" },
  renewal: { name: "Renewal", color: "#7fe0a0", path: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" },
  bulwark: {
    name: "Bulwark", color: "#d6c08e",
    path: "M5 3h14v10c0 4-3 7-7 9-4-2-7-5-7-9zM8 6v7c0 2 1.5 4 4 5.5 2.5-1.5 4-3.5 4-5.5V6z",
  },
  bloodrage: { name: "Bloodrage", color: "#e0303c", path: "M4 3h16l-3 8-2-3-3 10-3-10-2 3z" },
  grit: {
    name: "Grit", color: "#c8c2b4", path: "M6 9h12v4l-2 8H8l-2-8zM7 4h2.5v4H7zm3.75-1h2.5v5h-2.5zM14.5 4H17v4h-2.5z",
  },
  embers: {
    name: "Embers", color: "#ff8a3c",
    path: "M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-4 2-5 0 2 1 3 2 3 1-3 0-6 1-9zM3 20h18v2H3z",
  },
  lastBreath: {
    name: "Last Breath", color: "#c070d8",
    path: "M12 21 3.5 12.5A5 5 0 0 1 12 6a5 5 0 0 1 8.5 6.5zM11 7l2 4-2 2 2 4-1 1-2-4 2-2-2-4z",
  },
  redBlade: {
    name: "Red Blade", color: "#ff5a4a",
    path: "M20 2h2v2L10 16l-2-2zM6 14l4 4-1.5 1.5L7 18l-2.5 2.5L3 19l2.5-2.5L4 15z",
  },
  firstDoor: { name: "First Door", color: "#ff7068", path: "M6 22V9a6 6 0 0 1 12 0v13zm3-2h6V9a3 3 0 0 0-6 0z" },
  openedDoor: {
    name: "Door Opened", color: "#fff1d0", path: "M6 22V9a6 6 0 0 1 12 0v13zM9 20h3V6.2A3 3 0 0 0 9 9z",
  },
  kaelithsEdge: { name: "Kaelith's Edge", color: "#e8d27a", path: "M11 2h2l1 12h-4zM7 15h10v2h-4v5h-2v-5H7z" },
  brannocsAnvil: {
    name: "Brannoc's Anvil", color: "#b8a58a", path: "M3 7h14c0 3 2 4 4 4v2h-6v3l3 4H6l3-4v-3c-3 0-6-2-6-6z",
  },
  stunned: {
    name: "Stunned", color: "#ffd84a",
    path: "M12 2l1.53 3.9 4.18.25-3.24 2.65 1.06 4.05L12 10.6l-3.53 2.25 1.06-4.05-3.24-2.65 4.18-.25z"
      + "M2 17a10 3.5 0 1 0 20 0 10 3.5 0 1 0-20 0zm1.6 0a8.4 2.1 0 1 0 16.8 0 8.4 2.1 0 1 0-16.8 0z",
  },
  haldisHearth: {
    name: "Haldis's Hearth", color: "#ffb05a",
    path: "M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 2 1 2 1-2 0-4 1-6zM4 18l16-2v2L4 20zM4 16l16 2v2L4 18z",
  },
};
