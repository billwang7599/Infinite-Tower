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
            "Bread, smoked boar, apples from the castle orchard. Not today, mind: the cart's still on the road.",
            "Come back when I've stock to sell, avatar.",
          ],
        },
      ],
    },
  ],
};
