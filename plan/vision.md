# Vision: the game this is growing into

Status: **direction** (the user's). Details are undecided unless listed under "Decided".

## What the user wants

- **SAO-style**: like Aincrad in Sword Art Online, a tower of stacked floors, explored one floor at a time (towns,
  dungeons, a boss), eventually with other players. Hence the name, Infinite Tower.
- **Souls-like fights**: stamina, committed attacks, dodging with i-frames, telegraphed enemy attacks, bosses.
- **Exploration on a simple 2D top-down map; fights in a small 2.5D arena**, Pokémon-style: walking through tall
  grass or touching a monster pulls you into a small round arena where the monster is 3D and players are 2D
  sprites.
- **Single-player first.** The current prototype (one grass field, a boar and a kobold) is single-player on purpose;
  multiplayer comes later ([multiplayer.md](multiplayer.md)).

## Decided so far

- Attacks go wherever the camera faces; no lock-on or auto-aim.
- The rest (HP / stamina carrying over, resting, items, stats, character looks) is listed in
  [AGENTS.md](../AGENTS.md) under "Decided by the user" and "Decided by the agent".

## Open questions

These were asked early on and never answered:

- What dying costs (a currency, items, progress?).
- Party size for co-op, and whether there's PvP.
- Art direction beyond the current pixel sprites and simple 3D models.
- Weapons: sword only, or more?
- How floors work: how many, how big, what's on each, how you go up (a boss per floor?).
- What the mana and spellpower stats will be used for (there are no spells yet).

## Notes

- Floors one at a time keep the frame rate fine: only the current floor is loaded and simulated.
- The 2D sprites only face the camera; turning 3D-looking characters would need 4 or 8 directions of frames.
- The tower-climbing platformer this started as is kept at git tag `tower-platformer`.
