import type { Npc } from "./index.js";

export const CHANGER: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: -10.5, z: -9.5 },
      heading: "east",
      talk: [
        {
          lines: [
            "Copper, silver, gold: a hundred of one make one of the next. Coins don't change themselves, avatar.",
            "I'll change them either way, and the crown pays my fee, so you lot don't clog the stalls counting "
              + "coppers.",
          ],
          offer: { shop: "changer" },
        },
      ],
    },
  ],
};
