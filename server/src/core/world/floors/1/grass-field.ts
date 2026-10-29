import type { ArenaDef } from "@infinite-tower/shared";
import type { LevelDef } from "../../level.js";

export const GRASS_FIELD_ARENA: ArenaDef = { id: "grass-field", radius: 16, look: "grass-field" };

export const GRASS_FIELD: LevelDef = {
  layout: {
    id: "grass-field",
    name: "Grass Field",
    floor: 1,
    theme: "grass-field",
    playerSpeed: 5,
    tiles: [
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "TT..TT........TTT......~~...TTT.....TTTTT.TT",
      "TT.##_##.#....TT.......~~....T.......TTTT.TT",
      "TT.#____._.....*.......~~.....o.........T.TT",
      "TT.#____.#...........*.~~..........*......TT",
      "TT.______#....o........~~*................TT",
      'TT.#__*__#............~~."""""""""""......TT',
      'TT.##_.###.....TT.....~~."""""""""""......TT',
      'TT...:.......TTTT.....~~.""""""""""".o....TT',
      'TT...:......TTTTTT....~~."""""""""""......TT',
      'TT..o:.......TTTT.....~~."""""""""""......TT',
      'TT...:....*...TT.....~~.."""""""""""......TT',
      'TT...:...............~~..""""""""""".*....TT',
      "TT...:.......o.......~~....*.......o......TT",
      "TT...:...............~~...................TT",
      "TT:::::::::::::::::::==:::::::::::::::::::TT",
      "TT.........:::::.....==...................TT",
      "TT..*......:::::.....~~.......*.....o.....TT",
      "TT..o................~~...*....*..........TT",
      "TT...................~~......*...*........TT",
      "TT....TT............~~~~..*......*........TT",
      "TT...TTT..........~~~~~~~~.........TT.....TT",
      "TT..T............~~~~~~~~~~....o.......o..TT",
      "TT...............~~~~~~~~~~...TT..........TT",
      "TT....o...........~~~~~~~~...TTTT....o....TT",
      "TT..................~~~~....TTT...........TT",
      "TT..TT.....*..........*........TT.....TT..TT",
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    ],
    campfires: [{ x: -9, z: -2.5 }],
  },
  spawn: { x: -12, z: -5 },
  arenaId: GRASS_FIELD_ARENA.id,
  spawns: [
    { enemy: "wild-boar", at: { x: 8, z: -6 }, respawnTime: 8 },
    // The Kobold Swordsman's own corner, away from the boar and the start.
    { enemy: "kobold-swordsman", at: { x: 16, z: -9 }, respawnTime: 12 },
    { enemy: "kobold-greatsword", at: { x: 16, z: 0 }, respawnTime: 12 },
    { enemy: "goblin-warlock", at: { x: -16, z: 9 }, respawnTime: 12 },
  ],
  grass: { stepDist: 1, chance: 0.12, enemies: [{ enemy: "wild-boar", weight: 1 }] },
  safeTime: 2,
};
