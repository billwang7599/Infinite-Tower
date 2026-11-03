import type { Npc } from "./index.js";

export const BURNER: Npc = {
  stops: [
    {
      region: "mistwood",
      at: { x: -1.5, z: -12.5 },
      heading: "north",
      talk: [
        {
          when: { done: "burner-rook" },
          lines: [
            "The clamp's burning well. Highmere's forge will have its charcoal.",
            "If you ever go south past the trees, look for a tall boy with a torn arm. Tell him Bryn's goats are safe.",
          ],
        },
        {
          when: { quest: "burner-rook", step: "tamsin" },
          lines: [
            "His mother's in Highmere, by her door in the market's south-west. Tell her which way he went.",
          ],
        },
        {
          when: { quest: "burner-rook", step: "back" },
          lines: [
            "It's down? Then Rook's hunt is finished, even if he isn't here to see it.",
            "I promised him silver for that wolf, and he never came back for it. It's yours now.",
            "Take word to his mother in Highmere: south, past the trees, where no road goes. She'll want to hear it "
              + "from someone.",
          ],
        },
        {
          when: { quest: "burner-rook", step: "wolf" },
          lines: [
            "The grey wolf lies up in the woods west of the mire, past Sorrel's reeds. It still has his arrow in it.",
          ],
        },
        {
          when: { canStart: "burner-rook" },
          lines: [
            "You've been asking after Rook, Tamsin's boy? Ilse said someone was. Sit down, the smoke's better low.",
            "He stayed by my clamp three nights. The grey wolf west of the mire had been at my goats, and he went "
              + "after it.",
            "He came back with his arm torn and the wolf still living, his arrow in its flank. Next morning he went "
              + "south, through the gap in the trees past the goblin's broken walls, where no road runs.",
            "He said the world didn't stop at the trees. Finish his hunt for him: put that wolf down, then come back "
              + "to me.",
          ],
          offer: { start: "burner-rook" },
        },
        {
          lines: [
            "Stand upwind, the smoke's thick. You're from the hall, aren't you? Bryn. I burn charcoal for Highmere's "
              + "forge.",
            "A boy from Highmere stayed by my clamp a while back. Tall, sure of himself, out hunting. Rook, he said.",
            "If anyone in the town is asking after him, send them to me. I've news I can't carry myself.",
          ],
        },
      ],
    },
  ],
};
