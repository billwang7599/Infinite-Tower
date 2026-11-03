import type { Patch } from "./world.js";

export const ROADS: Patch[] = [
  // Highmere's South Gate down into the Waking Hollow's north-west corner.
  { rect: { x: -65, z: 5, w: 4, h: 17 }, char: ":" },
  // The Grass Field's old north-west way out runs into the quarry's rock: closed.
  { rect: { x: -27, z: 20, w: 3, h: 2 }, char: "T" },
];
