import type { Npc } from "./index.js";

export const GROCER: Npc = {
  stops: [
    {
      region: "market-ward",
      at: { x: 1.5, z: 4.5 },
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
