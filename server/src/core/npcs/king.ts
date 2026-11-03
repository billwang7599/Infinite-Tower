import type { Npc } from "./index.js";

export const KING: Npc = {
  stops: [
    {
      region: "kingdom",
      at: { x: 17.5, z: 16.5 },
      heading: "south",
      talk: [
        {
          lines: [
            "So the door has sent another. Come closer, avatar. The carpet doesn't bite, whatever my chamberlain "
              + "tells you.",
            "I am Osric of House Vantmere, King of Highmere. I hold this city for His Imperial Radiance Valerian Aurelius the Ninth, "
              + "Emperor of the Most Radiant and Thrice-Crowned Empire of Aurevaine.",
            "The Emperor's court sits in Seraphel, the Gilded Throne: richer than we are, newer than we are, and a "
              + "long way from the door.",
            "Highmere is the Empire's second city and its oldest. Ours is the Door City. Every avatar the Empire "
              + "has ever had woke first on the stone down that hall.",
            "Seraphel writes often. It would like a firmer hand on that stone, and more of what comes through it "
              + "sent its way. I write back, politely.",
            "Eat, arm yourself, see the city. And when the Empire asks something of you, remember which king "
              + "welcomed you first.",
          ],
        },
      ],
    },
  ],
};
