import type { Npc } from "./index.js";

export const CAPTAIN: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: -3.5, z: -20.5 },
      heading: "east",
      talk: [
        {
          when: { done: "captain-boars" },
          lines: [
            "Avatar. The road's clearer for your work. The carters noticed, even if they won't thank you.",
            "Keep your blade sharp out there. And when the crown asks something of you, and it will, think before "
              + "you answer.",
          ],
        },
        {
          when: { quest: "captain-boars", step: "back" },
          lines: [
            "Three? Good. The carts will come up the road whole for a week or two.",
            "You'll hear the crown say you belong to Highmere: the oldest pad is ours, so whatever wakes on it is "
              + "ours too. Owed a blade, owing a debt.",
            "I don't argue law. But I've buried soldiers, and you I can't even keep dead. A soldier like that isn't "
              + "one the crown can keep, whatever the law says.",
            "Here. The watch pays for work done, whoever does it.",
          ],
        },
        {
          when: { quest: "captain-boars", step: "boars" },
          lines: ["Three boars off the Grass Field. Out through this gate and along the road; they're in the grass."],
        },
        {
          when: { canStart: "bram-yard" },
          lines: [
            "Halt there. Captain Edda, of the town watch. You've come out of the hall with nothing in your hands.",
            "I don't send anyone through this gate unarmed. See old Bram in the castle's training yard first, then "
              + "come back to me.",
          ],
        },
        {
          when: { canStart: "captain-boars" },
          lines: [
            "Captain Edda, of the town watch. I keep this gate, and whatever comes up the road to it.",
            "The boars have been at the carts again on the Grass Field. My watch is short-handed and you, avatar, "
              + "get up again when they gore you.",
            "Put three of them down and report back. The watch pays in silver.",
          ],
          offer: { start: "captain-boars" },
        },
        {
          lines: [
            "Captain Edda, of the town watch. Finish what Bram started with you before you go wandering out there.",
          ],
        },
      ],
    },
  ],
};
