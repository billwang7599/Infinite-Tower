import type { Npc } from "./index.js";

export const TAMSIN: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: -14.5, z: -17.5 },
      heading: "east",
      talk: [
        {
          when: { done: "tamsin-son" },
          lines: [
            "I set his place at the table again. Foolish, maybe. But his thread runs, and so the place is his.",
            "If your road ever takes you where the loom won't look, and you meet a tall boy with my chin, tell him "
              + "his mother isn't angry.",
          ],
        },
        {
          when: { quest: "tamsin-son", step: "back" },
          lines: [
            "You're back. Tell me plainly, I've waited long enough.",
            "It runs. His thread runs. Oh, thank the gods, thank Nyra and her loom.",
            "Far off, she said, where the loom won't show? Then he went on past the Mistwood, the stubborn boy. He "
              + "always said the world didn't stop at the trees.",
            "When one of us dies, there's no pad to wake on. The thread just ends. His hasn't. Here, take this. "
              + "It's what I was saving to bury him with.",
          ],
        },
        {
          when: { quest: "tamsin-son", step: "ilse" },
          lines: [
            "The weaver by the Mistwood's lake. Ilse, they call her. Ask her about Rook, son of Tamsin, of Highmere.",
          ],
        },
        {
          lines: [
            "You're one of the new ones, from the hall. You'll go out past the walls, won't you? Your kind always do.",
            "My son Rook went hunting in the Mistwood at the turn of the moon. He hasn't come home.",
            "There's a weaver of Nyra's by the lake there, Ilse. They say she can read any of us on the loom, whether "
              + "our thread still runs or has ended.",
            "Ask her about him. Please. I'll pay what I have.",
          ],
          offer: { start: "tamsin-son" },
        },
      ],
    },
  ],
};
