import type { Npc } from "./index.js";

export const GROCER: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: -6.5, z: -5.5 },
      heading: "south",
      talk: [
        {
          lines: [
            "Bread from the castle ovens, boar off the hunters' carts. Highmere prices, mind: the door keeps sending "
              + "you lot, and you all have to eat.",
            "I'll buy meat too, if you bring it fresh.",
          ],
          offer: { shop: "grocer" },
        },
      ],
    },
  ],
};
