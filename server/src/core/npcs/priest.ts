import type { Npc } from "./index.js";

export const PRIEST: Npc = {
  stops: [
    {
      region: "kingdom",
      at: { x: -9.5, z: -6.5 },
      heading: "south",
      talk: [
        {
          when: { flag: "hollis-to-mistwood" },
          lines: [
            "Someone's told you about the pads, I see it on you. You look at the stones differently now.",
            "Nobody here built them, and the gods won't say who did. Aurel's priests don't mind. Whoever laid them "
              + "sent us light when we were short of it.",
            "Your flame's grown, too. Keep feeding it. The world needs every spark you bring through that door.",
          ],
        },
        {
          when: { done: "bram-yard" },
          lines: [
            "Bram's put a stick in your hands, I see. Good. It's a start.",
            "Out past the gate, every beast you put down feeds the light in you. Aurel's light, we say: the dawn "
              + "in every soul.",
            "Some of my order think your kind was sent to feed this world, and that some of you will be spent "
              + "doing it. I pray you're not one of the spent.",
          ],
        },
        {
          lines: [
            "Dawn's blessing on you, avatar. I'm Ottilie, priest of Aurel. Every soul carries a little of his light, "
              + "and yours burns low yet.",
            "Don't be afraid of that. Everyone starts as a flame.",
            "Old Bram, through the gap in the north-west wall, will put something in your hands. Go to him first.",
          ],
        },
      ],
    },
  ],
};
