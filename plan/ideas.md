# Smaller ideas

Status: **ideas**. Each came up in passing and was never decided. The game ones are mechanics, so they need the
user's call before anyone builds them.

## Game

- **Saving where you are.** Position and level aren't saved; every connection starts at the level's start.
- **How wide the swings hit.** Each swing's arc depends on its line, its reach is the same for all (`ARC_DEG` in
  `shared/src/weapons/hybrid.ts`). How wide the old slash should be was asked and not answered.
- **Swing steering** (Mordhau's): turning during a swing drags the blade with you, so it lands earlier turning with
  it and later against it. Not built: a swing's direction is fixed when it starts (`swing.dir`) and its hit is one
  wedge. The user skipped it for now ("sure we can skip for now"); open: timing only or damage too, a turn cap, and
  how it fits lock-on.
- **Email or OAuth login**, next to username + password (the user: "maybe later").

## Code

- **Reply schemas on the HTTP routes.** Request bodies are checked with the shared Zod schemas; replies aren't.
  fastify-type-provider-zod can check them too.
- **Rename `server/src/core/game/snapshot.ts` to `state.ts`**, since what it builds is the `state` message.
