# Run the arena fight on the server

Status: **being built**. Step 1 of 2 is done: the fight is shared code on Rapier. Step 2, the server running it, is
next.

## Why

Everything on the overworld is server-authoritative, but the fight runs in the browser and reports
`battleEnd { won, vitals }`. The server can only bound the claim (`server/src/core/game/battle.ts`):

- a win faster than 0.9 x the player's fastest possible kill (`isPlausibleWin` with `MIN_KILL_TIME_SHARE`, from
  the enemy's HP and the player's damage) is refused;
- HP that went up during the fight is refused.

Anything inside those bounds is trusted: a modified client can still win every fight it survives long enough.
Multiplayer fights ([multiplayer.md](multiplayer.md)) need the server to run the fight anyway.

## Decided (by the user)

- **Physics: Rapier's deterministic build, in `shared/`** (`@dimforge/rapier3d-deterministic-compat`, its
  WebAssembly inside the package, so Node and Vite load it the same way). Havok is gone.
- **The fight is one self-contained object** (`Fight`, `shared/src/battle/fight/`): its own physics world, fixed
  steps, no randomness and no state outside it, any number of players and enemies. The long-term aim is 20 players
  against 20 enemies, one battle per server pod; a test fight of 20 against 20 steps in about 0.8 ms in Node.
- **Fighters are moved by code** (kinematic, Rapier's character controller), not pushed by forces. An enemy shoves a
  player; a player can't push an enemy; dodging, knocked back or dead, a player passes through enemies.
- **Hits stay sector math** (`ActiveHit`: range + angle), not physics.
- **The client will predict only its own character**; enemies and other players are drawn from what the server
  sends.
- **Projectiles, when they come, are ray or shape casts**, not physics bodies.

## Steps

1. Done: Rapier instead of Havok, and the fight moved into `shared/` (see ARCHITECTURE.md). The browser still runs
   it alone and reports the result; the server only times and bounds it, as before.
2. Next: the server runs the fight (in `server/src/core/game/`, which may already import
   `@infinite-tower/shared/fight`), the client sends its inputs and predicts its own character, reconciling with
   the server's state like walking on the overworld.

## Open questions

- Inputs with timestamps, so a slash or dodge happens on the step it was pressed, whatever the lag.
- What the server sends during a fight, how often, and how big.
- With more than one player in a fight: whom an enemy goes for (for now, the nearest player still standing), when
  the fight is lost (for now, when every player is down), and whether players bump into each other (for now they
  pass through, as enemies pass through each other). These are placeholders that only matter with two or more
  players; none was decided.
- Bundle size: the package carries Rapier's WebAssembly as base64 in the JavaScript (about 1.7 MB gzipped, against
  Havok's 0.7 MB). The package with a separate `.wasm` file would be about 0.5 MB smaller gzipped, at the cost of
  loading the file by hand in Vite and Node.
- The fight's own JavaScript math (`Math.sin`, `atan2`, `hypot`) gives the same numbers in Node and Chrome (both
  V8), but other browsers may differ in the last bit; prediction would reconcile that away.
