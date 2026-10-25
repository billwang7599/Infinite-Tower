# Smaller ideas

Status: **ideas**. Each came up in passing and was never decided. The game ones are mechanics, so they need the
user's call before anyone builds them.

## Game

- **Spells.** Every fighter has mana and spellpower, but nothing uses them yet.
- **Stats that differ and grow.** Everyone has the same player stats today, so they aren't saved. Levelling up,
  gear or anything else that changes them would need them in `PlayerSave`.
- **Saving where you are.** Position and level aren't saved; every connection starts at the level's start.
- **The slash's reach.** It hits in a 140° arc in front of the camera (`PLAYER.slash.minDot` in
  `shared/src/battle/player.ts`). Whether to keep it that wide was asked and not answered.
- **Email or OAuth login**, next to username + password (the user: "maybe later").

## Code

- **Reply schemas on the HTTP routes.** Request bodies are checked with the shared Zod schemas; replies aren't.
  fastify-type-provider-zod can check them too.
- **Rename `server/src/core/game/snapshot.ts` to `state.ts`**, since what it builds is the `state` message.
