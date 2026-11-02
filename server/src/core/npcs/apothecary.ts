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
            "Tinctures and tonics: red for wounds, green for tired legs. They do what the label says. Mostly.",
          ],
          offer: { shop: "apothecary" },
        },
      ],
    },
  ],
};
