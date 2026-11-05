# Smaller ideas

Status: **ideas**: mentioned in passing, never decided. The game ones are mechanics, so they need the user's call.

## Game

- **Saving where you are**: only the bound pad is saved today, not the position.
- **How wide swings hit**: each line's arc was the agent's pick; the user never answered how wide.
- **Swing steering** (Mordhau's): turning during a swing drags the blade with you. Skipped for now ("sure we can skip
  for now"); open: timing only or damage too, and how it fits lock-on.
- **Email or OAuth login** next to username and password ("maybe later").

## Code

- Reply schemas on the HTTP routes (requests are checked, replies aren't).
- Rename `server/src/core/game/snapshot.ts` to `state.ts`, since it builds the `state` message.
