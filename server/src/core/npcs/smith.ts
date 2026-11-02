import type { Npc } from "./index.js";

export const SMITH: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: 10.5, z: -9.5 },
      heading: "west",
      talk: [
        {
          lines: [
            "Another one off the pad. The door sends you lot in soft as dough, and somebody has to arm you.",
            "The forge is cold today. Come back when it's lit.",
          ],
        },
      ],
    },
  ],
};
