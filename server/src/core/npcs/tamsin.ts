import type { Npc } from "./index.js";

export const TAMSIN: Npc = {
  quests: {
    "tamsin-son": {
      title: "A Son in the Mistwood",
      half: "side",
      steps: [
        {
          id: "ilse",
          task: { kind: "talk", to: "ilse" },
          text: "Ask Ilse whether Rook's thread still runs.",
          hint: "Tamsin said Nyra's weaver sits by the Mistwood's lake, past the Grass Field's east edge, and can read "
            + "any native's thread.",
        },
        {
          id: "back",
          task: { kind: "talk", to: "tamsin" },
          text: "Go back to Tamsin.",
          hint: "She waits by her door in the south-west of Highmere's Market Ward.",
          reward: { items: { "silver-coin": 1 }, lore: ["running-thread"] },
        },
      ],
    },
  },
  stops: [
    {
      region: "market-ward",
      at: { x: -18.5, z: -15.5 },
      heading: "south",
      talk: [
        {
          when: { done: "burner-rook" },
          lines: [
            "South, past the trees. I look that way every evening now.",
            "If you go further than he did, avatar, and come back, tell me what's there.",
          ],
        },
        {
          when: { quest: "burner-rook", step: "tamsin" },
          lines: [
            "You've been to the Mistwood again. I can see it on your boots. Tell me.",
            "Bryn's fire. A torn arm. And then south, through the trees, where no road runs.",
            "That's him. Every word. He used to climb the town wall to see what was past the fields.",
            "Ilse said his thread runs where the loom won't look. Now I know which way that is. Thank you.",
          ],
        },
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
