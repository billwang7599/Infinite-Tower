import type { Npc } from "./index.js";

export const COOK: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: 18.5, z: -0.5 },
      heading: "west",
      talk: [
        {
          when: { done: "cook-meat" },
          lines: [
            "You again! The stew went down a treat. The guards asked for seconds, and they never ask for anything "
              + "politely.",
            "If you're ever cold out there, find a fire in the wild and sit by it. Haldis will see to you.",
          ],
        },
        {
          when: { quest: "cook-meat", step: "bring" },
          lines: [
            "Is that boar I smell? Bless you. Hand it over before the steward sees it and wants a cut.",
            "You know there's not one campfire inside these walls? Every fire in Highmere is the crown's: ovens, "
              + "hearths, all behind doors.",
            "Out in the wild the fires are Haldis's. She warms whoever sits by one and mends what the road broke. "
              + "She doesn't come where she isn't asked, and nobody here thought to ask.",
            "Here, for the meat. Fair coin, mind, not Bette's prices.",
          ],
          offer: { deliver: "cook-meat" },
        },
        {
          when: { quest: "cook-meat", step: "gather" },
          lines: ["Three boar meat, fresh as you can manage. The Grass Field's boars give it more often than not."],
        },
        {
          lines: [
            "Mind the door, I'm Wenna, and I cook for the castle: the guards, the court, and every new one of you "
              + "that comes up the carpet hungry.",
            "Bette sells me meat at Highmere prices, and Highmere prices are robbery. You go out past the gate anyway.",
            "Bring me three boar meat and I'll pay you fairer than she would. What do you say?",
          ],
          offer: { start: "cook-meat" },
        },
      ],
    },
  ],
};
