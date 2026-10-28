# Plans

Where the game and the code are headed: one file per plan, so each can grow on its own and be deleted when it's
done. Nothing here is built yet. What is built is described in [ARCHITECTURE.md](../ARCHITECTURE.md) and the
[README](../README.md).

| Plan | Status |
|---|---|
| [vision.md](vision.md): the game this is growing into (floors of a tower, souls-like fights) | direction |
| [server-fights.md](server-fights.md): what's left after moving fights to the server (lag, more players) | later |
| [multiplayer.md](multiplayer.md): other players on the overworld and in fights | direction |
| [deploy.md](deploy.md): client on Cloudflare, server on a VM | idea |
| [tests.md](tests.md): what the unit tests don't cover yet (Postgres stores, UI), and blocking red merges | later |
| [inventory.md](inventory.md): the rest of the grid inventory (loot screen, the bag in a fight, spellbook pages) | being built |
| [spells.md](spells.md): spells built from words (Forms, elements, augments) and cast in fights | being built |
| [art.md](art.md): character art that grows: hand-drawn gear and bodies, animation, PNG export | later |
| [ideas.md](ideas.md): smaller things mentioned but not decided | ideas |

Statuses:

- **direction**: what the user wants the game to become; the details aren't decided.
- **next big step**: agreed it should happen; how is still open.
- **being built**: decided, and coming in PRs now.
- **idea** / **later**: mentioned and worth keeping; nothing decided, or deliberately put off.

Each plan says what's decided (and by whom), what's open, and any notes gathered so far. When work on one starts,
settle its open questions with the user first (game mechanics always need the user's say, see
[AGENTS.md](../AGENTS.md)). When it's built, move what's true into ARCHITECTURE.md or the README and delete the
plan file, or trim it to what's left.
