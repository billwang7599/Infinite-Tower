import type { Npc } from "./index.js";

export const CAPTAIN: Npc = {
  quests: {
    "captain-boars": {
      title: "Thin the Herd",
      half: "side",
      when: { done: "bram-yard" },
      steps: [
        {
          id: "boars",
          task: { kind: "kill", enemy: "wild-boar", count: 3 },
          text: "Slay 3 wild boars.",
          hint: "Captain Edda said they root about in the Grass Field's tall grass, past the Hollow, down the South "
            + "Gate's road.",
        },
        {
          id: "back",
          task: { kind: "talk", to: "captain" },
          text: "Report to Captain Edda.",
          hint: "She keeps Highmere's South Gate, at the south end of the Market Ward.",
          reward: { items: { "silver-coin": 1 }, lore: ["highmere-claim"], faith: { kaelith: 20 } },
        },
      ],
    },
  },
  stops: [
    {
      region: "market-ward",
      at: { x: -2.5, z: -21.5 },
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
          lines: ["Three boars off the Grass Field. Down the road to the Hollow, then east; they're in the grass."],
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
