# Vision: the game this is growing into

Status: **direction** (the user's). Details are undecided unless listed under "Decided".

## What the user wants

- **More open world now** (the user: "more open world now"): one world to roam, starting in the main kingdom, with
  no floors and no realm locks. The SAO-style tower of stacked floors (like Aincrad, hence the name Infinite Tower) is
  on hold, maybe for good.
- **Souls-like fights**: stamina, committed attacks, dodging with i-frames, telegraphed enemy attacks, bosses.
- **Exploration on a simple 2D top-down map; fights in a small 2.5D arena**, Pokémon-style: walking through tall
  grass or touching a monster pulls you into a small round arena where the monster is 3D and players are 2D
  sprites.
- **Single-player first.** The current prototype (one grass field, a boar and a kobold) is single-player on purpose;
  multiplayer comes later ([multiplayer.md](multiplayer.md)).

## Decided so far

- New players start in the kingdom, on its summoning platform, and wake there after dying (see
  [AGENTS.md](../AGENTS.md)). The Waking Hollow, the Grass Field and the Mistwood are test areas.
- Fights lock on to an enemy, and the sword's swings come from mouse movement (see [AGENTS.md](../AGENTS.md)).
- The rest (HP / stamina carrying over, resting, items, stats, character looks) is listed in
  [AGENTS.md](../AGENTS.md) under "Decided by the user" and "Decided by the agent".

## Open questions

These were asked early on and never answered:

- What dying costs beyond the bag and the core's fill ([core.md](core.md)).
- Party size for co-op, and whether there's PvP.
- Art direction beyond the current pixel sprites and simple 3D models.
- How the open world is laid out beyond the kingdom, and whether the tower comes back.

## Notes

- Levels one at a time keep the frame rate fine: only the levels with players on them are simulated.
- The 2D sprites only face the camera; turning 3D-looking characters would need 4 or 8 directions of frames.
- The tower-climbing platformer this started as is kept at git tag `tower-platformer`.
