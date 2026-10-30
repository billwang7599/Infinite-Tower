# The core: progression without levels

Status: **next big step**. The user wants a cultivation-style core instead of levels, like the Murim manhwas and
The Beginning After the End. Nothing is built: today every stat is 10 and isn't saved, and the only thing counted is
fights won.

## Decided by the user

- **Shape:** 5 realms, each with 3 steps. A step has a fill; when it's full you move to the next step, and the third
  step of a realm leads into the next realm.
- **Filling it:** monster essence first. Beaten monsters drop it into the bag, and it's absorbed into the core.
  Other ways (meditating, elixirs, using skills) maybe later.
- **Breakthrough:** automatic when the fill is full, for now. Maybe a small minigame later (something rhythm-based).
- **No mana.** Physical and magical attacks spend the same pool, and it stays called **stamina** (a dodge or a
  swing spending "soul capacity" doesn't make sense). The pool grows with the core.
- **Stats:** strength, agility, stamina and skillpower, plus three new ones: **vitality** (HP), **defense** (cuts
  physical damage) and **special defense** (cuts skill damage). Three more are **hidden** (not on the chart):
  **toughness** (how fast you recover from a stun), **stamina recovery** and **health regen** (HP slowly coming
  back on its own). They go up by 1 every step, the same in every realm (no doubling), and free points can't go
  into them.
- **What a step gives:** every stat goes up by a flat base amount that grows exponentially with the realm, plus
  **free points** the player puts into any stats. Starting numbers: +1 to every stat and 2 free points per step in
  the first realm, both doubling each realm; tuned later. Placed points are never locked in: they can be taken back
  and placed again, for some effort (how, and what it costs, is open).
- **HP comes only from vitality**, so it grows with the core through vitality's share of each step.
- **Essence:** each monster's essence has its own worth (a Kobold's more than a boar's). It's absorbed from the bag
  **anywhere**, mid-fight included, as a **2 s channel** (the same on the overworld and in a fight). The rest was
  left to the agent: you can't move or act while channelling, a hit cancels it, and a cancelled essence goes back
  into the bag, not lost.
- **Fill per step:** about 5 boars' worth for the first step, rising each step; tuned in play. The admin panel (F1)
  can add and remove steps, to try things out.
- **The core is the avatar's soul** ([lore.md](lore.md)), drawn as a sphere with light growing from its centre, not
  a filling orb: nothing should read like XP. Each step the light grows bigger and brighter, and its colour changes
  with each realm, from fiery to ethereal. Inside a step there's no number or bar: the light breathes (a slow
  pulse), and sparks show when a breakthrough is near.
- **Names** (the user's pick, one-syllable Latin-Chinese words, fiery to ethereal): the realms are Yan (炎,
  "flame"), Sol ("sun"), Lux ("light"), Ling (灵, "spirit") and Tian (天, "heaven"); the steps Early, Middle and
  Peak, as in the Murim stories (so "Middle Yan").
- **On death:** you lose the fill inside your current step; if it's already empty, you lose a whole step. You drop
  everything you carry (so unabsorbed essence too), and anyone can pick it up for a while before it crumbles. The
  words you know survive. Whether losing a step can take you back a realm is open.
- **Floors don't require a realm** to enter.
- **Enemies' realms aren't shown** for now, but enemies do have realms that scale their stats (later, with floors;
  not in the first PR).
- **What you see:** your character's portrait in the bottom-left corner; clicking it flips it over to show your
  core. The stats screen is a polygon chart (like Pokémon's) with a small number under each stat. More stats can be
  added, so it needn't stay a diamond.
- **No elemental affinity** yet.

## Numbers (the agent's picks, for the user to review)

The user let the agent set the stats; all of these are changeable. Every stat starts at 10. By the top step (Peak
Tian) the steps have made each stat 103 before free points, and the three hidden stats 25.

| What                          | Formula                                    | Start | Top step                    |
| ----------------------------- | ------------------------------------------ | ----- | --------------------------- |
| HP                            | 10 × vitality                              | 100   | 1030                        |
| Stamina bar                   | 10 × stamina                               | 100   | 1030                        |
| Physical damage               | × √(strength / 10)                         | ×1    | ≈×3.2                       |
| Skill damage                  | × √(skillpower / 10)                       | ×1    | ≈×3.2                       |
| Physical damage taken         | × 50 / (40 + defense)                      | ×1    | ≈×0.35 (never 0)            |
| Skill damage taken            | × 50 / (40 + special defense)              | ×1    | ≈×0.35 (never 0)            |
| Stun and stagger times        | × 10 / toughness                           | ×1    | ×0.4                        |
| Stamina regen                 | × stamina recovery / 10                    | ×1    | ×2.5                        |
| HP regen per second           | vitality × health regen / 200              | 0.5   | ≈12.9 (full in 80 s)        |
| Walk and dodge speed          | × (agility / 10)^¼                         | ×1    | ≈×1.8 (walk ≈10.7 m/s)      |
| Carry limit                   | 60 × (strength / 10)^¼                     | 60    | ≈107                        |
| Fill to finish step n (1-15)  | 100 × 2^((n − 1) / 3)                      | 100   | ≈2540 (≈11,900 in all)      |

- Damage: today strength works through a 4th root and skills are linear; both are ×1 at 10, so nothing plays
  differently now, and with the same root swords and skills grow alike.
- Stamina costs stay flat, so a bigger bar means more actions. A swing's cost no longer grows with strength.
- Agility isn't linear: linear would walk at 62 m/s at the top. The carry limit replaces 30 + 3 × strength (339 at
  the top).
- HP regen is new (today HP only comes back by resting or eating). It runs on the overworld and in fights, and
  stops for 5 s after a hit. It grows with vitality as well as health regen, so it keeps pace with the HP bar. At
  the start a full bar takes 200 s, so campfires and meat still matter.
- Boar meat heals 35% of max HP instead of a flat 35.
- Essence: boar 20, Kobold Swordsman 40, Kobold Greatsword 50, Goblin Warlock 30 (the first step is 5 boars). An
  enemy of a later realm gives more, doubling per realm.

## Notes

- Stats, the core and the choices need to be saved in `PlayerSave` (a migration); stats are only used in fights
  today (`shared/src/battle/stats.ts`).
- The drop table already rolls items per enemy on the server, so essence is one more item there.
