import type { Npc } from "./index.js";

export const APOTHECARY: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: 6.5, z: -5.5 },
      heading: "south",
      talk: [
        {
          lines: [
            "Tinctures, salves, little bottles that do what the label says. Mostly.",
            "The shelves stay bare until the next caravan comes in. Come back then.",
          ],
        },
      ],
    },
  ],
};
