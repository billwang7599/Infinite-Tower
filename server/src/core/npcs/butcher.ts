import type { Npc } from "./index.js";

const QUEST = "butcher-chickens";

export const BUTCHER: Npc = {
  quests: {
    "butcher-chickens": {
      title: "Birds in the Grass",
      half: "main",
      when: { done: "bram-yard" },
      steps: [
        {
          id: "butcher",
          task: { kind: "talk", to: "butcher" },
          text: "Find Hob the butcher in the Market Ward.",
          hint: "Bram said Hob keeps a stall in the market, down through the castle gate, by his chicken pen next to "
            + "the Gilded Door.",
        },
        {
          id: "chickens",
          task: { kind: "kill", enemy: "chicken", count: 3 },
          text: "Catch 3 of Hob's chickens.",
          hint: "Hob said to walk through the long grass in his pen until a bird bursts out of it. They peck, but "
            + "not hard.",
        },
        {
          id: "back",
          task: { kind: "talk", to: "butcher" },
          text: "Go back to Hob.",
          hint: "His stall is beside the pen, next to the Gilded Door in the Market Ward.",
          reward: { items: { "copper-coin": 10, "boar-meat": 1 }, lore: ["long-grass"] },
        },
      ],
    },
  },
  stops: [
    {
      region: "market-ward",
      at: { x: 36.5, z: 15.5 },
      heading: "south",
      talk: [
        {
          when: { done: QUEST },
          lines: [
            "The South Gate's at the bottom of the avenue, and the road past it runs down to the wild. Mind the long "
              + "grass out there: the boars lie in it like my birds do, and they bite back harder.",
          ],
        },
        {
          when: { quest: QUEST, step: "back" },
          lines: [
            "Three, and you're still standing. Bram's not lost his touch.",
            "Remember the grass. Out in the wild, whatever's lying low in it comes at you the moment you walk onto it.",
            "Here: a few coppers, and a cut of boar for the road.",
          ],
        },
        {
          when: { quest: QUEST, step: "chickens" },
          lines: [
            "Three birds. Go in through the gate this side and walk the long grass: sooner or later one bursts out "
              + "at you. Sword in hand, mind. They peck.",
          ],
        },
        {
          when: { quest: QUEST, step: "butcher" },
          lines: [
            "Bram sent you? Good. I'm Hob. I've three birds promised to the castle pot, and they're hiding from me in "
              + "their own pen.",
            "See the long grass behind the fence? Walk through it and sooner or later something jumps out at you. "
              + "In there, it's only my chickens.",
            "Past the South Gate it's the same, only it's boars in the grass, and they don't stop at pecking. Better "
              + "you learn it here, where the worst you'll get is a sore ankle.",
            "The gate's this side. Bring me three.",
          ],
        },
        {
          when: { canStart: QUEST },
          lines: [
            "Hob, butcher. Bram's had you in his yard, I see. I've chickens loose in the long grass of my pen and no "
              + "time to chase them. Want the work?",
          ],
          offer: { start: QUEST },
        },
        {
          lines: [
            "Hob, butcher. Fresh off the stone, are you? See old Bram in the castle's training yard first. I'll have "
              + "work for you after.",
          ],
        },
      ],
    },
  ],
};
