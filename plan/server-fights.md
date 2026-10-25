# Run the arena fight on the server

Status: **next big step** for anti-cheat. How to do it isn't decided.

## Why

Everything on the field is server-authoritative, but the fight runs in the browser (Babylon + Havok) and reports
`battleEnd { won, vitals }`. The server can only bound the claim (`server/src/core/game/battle.ts`):

- a win faster than 0.9 x the player's fastest possible kill (`isPlausibleWin` with `MIN_KILL_TIME_SHARE`, from
  the enemy's HP and the player's damage) is refused;
- HP that went up during the fight is refused.

Anything inside those bounds is trusted: a modified client can still win every fight it survives long enough.
Multiplayer fights ([multiplayer.md](multiplayer.md)) need the server to run the fight anyway.

## What's already set up for it

- Attacks are data and hits are resolved with plain math (`ActiveHit` sectors, `combatSystem`), not physics
  triggers.
- Input enters only through `PlayerInput` (world-space move + aim), so it can come from the network instead.
- The server is hexagonal: the fight would go in `server/src/core/`, which already runs the field with the same
  shared ECS.

## Open questions

- **Physics on the server.** Babylon's NullEngine + Havok in Node, or drop Havok and write simple arena physics
  (a flat ring, circles, gravity for jumps) that both sides run from `shared/`. Dropping Havok was suggested
  earlier and never decided.
- **What the client still does**: predict its own movement and attacks and reconcile, like walking on the field,
  or just send input and draw what comes back (simpler, but input lag).
- **Which code moves to `shared/`**: the player controller, enemy behaviors and combat would have to run on both
  sides (or only on the server).
- What the server sends during a fight, how often, and how big.
