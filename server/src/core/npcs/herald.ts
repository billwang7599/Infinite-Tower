import type { Npc } from "./index.js";

export const HERALD: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: 3.5, z: 14.5 },
      heading: "west",
      talk: [
        {
          lines: [
            "Welcome to Highmere, avatar. You stand in the Hall of Arrival, on the first summoning pad: the oldest "
              + "there is, and the largest.",
            "The Maker's door first opened on this stone. The kingdom grew up around it, and the castle around this "
              + "hall, so that every soul who comes through comes through here.",
            "You are an avatar: a soul from another world, carried into a body made for it. Your own people sit "
              + "somewhere past the door and move you as they will. We know. We don't mind.",
            "His Majesty holds that what comes through Highmere's door is Highmere's to welcome. Remember who "
              + "welcomed you.",
            "Your body will answer soon enough. {general.forward}, {general.left}, {general.back} and "
              + "{general.right} carry you; {overworld.interact} speaks to people and opens what lies in reach.",
            "What you carry is in your bag, {general.inventory}. What you've learned of this world is in your "
              + "questbook, {general.questbook}.",
            "Out in the wild you'll fight. Your blade answers the left and right mouse buttons, a flick of the hand "
              + "sets which way it swings, {battle.block} raises your guard and {battle.dodge} throws you clear.",
            "Fall out there and you'll wake again on this very stone. Most of what you carried stays where you fell.",
            "Down the carpet and out through the courtyard. Past the castle gate is the market: food, potions, the "
              + "smithy and a money changer. The town gate beyond it leads out to the Grass Field.",
          ],
        },
      ],
    },
  ],
};
