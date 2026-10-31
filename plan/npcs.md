# NPCs

Status: **next big step**. Hollis by the Grass Field's fire, Maren and Tobin in the Waking Hollow (the starting
area, where their short chain sends you on to Hollis), Corwin on the Grass Field's east road and Ilse by the
Mistwood's lake (each with a side chain of two) are the NPCs. Quests, the questbook, lines that follow your
story, stops (where an NPC stands, by the story, per player) and traces (what one leaves where it moved on from) are
built (AGENTS.md, ARCHITECTURE.md). Hollis moves on: once his first chain is done he stands by the Mistwood's pad with
a quest of his own, and his bedroll lies by the Grass Field's fire. The plan below grows from there.

The model the user named: the story of AdventureQuest Worlds (quest chains, a cast that turns up again across the
maps) with the immersion of Stardew Valley's villagers (routines, dialogue that knows you, friendships).

## Decided by the user

- **Friendships**: each player has a friendship with each NPC that grows, Stardew-style.
- **Routines follow the day/night cycle**: most NPCs sleep at night.
- **A recurring NPC moves on with the story, leaving a trace.** Hollis does the everyday things by the campfire
  (talking, quests) until his chain there is done. He says goodbye in person ("meet me at ..."), and the next time
  you come back he's gone: one person in one place, never at two stops at once. What he leaves points the way, a
  packed bedroll or a local who says where he went, so a player who lost the thread is never stuck.

## How it could work (the agent's draft, to settle before building)

- **Stops and traces** are built (`stops` in `server/src/core/npcs/<id>.ts`, `placedOn`; Hollis's move is the first
  use, AGENTS.md). Still open: whether a trace ever goes away (today it lies there for good), and whether a local
  should also say where he went (Maren and Corwin don't mention his move yet).
- **Everyday NPCs stay put**: each place gets its own residents for talk, small quests and friendship, so a fire
  doesn't go quiet when Hollis leaves. His friendship and everyday quests travel with him.
- **Routine**: a list of day-fraction spans (awake by the fire, asleep in a bedroll beside it, ...), read from the
  shared day clock (`shared/src/world/day.ts`), so the server and every client agree. A day is 24 real minutes,
  so a night of sleep is about 9 of them.
- **Lines with conditions** could also read friendship and the time of day (today: a quest's step, a quest that can
  start or is done, or a story flag; lines are kept per stop).

## Open

Game mechanics, for the user to decide:

- How friendship grows (talking each day, gifts, quests) and what it gives (lines, quests, items, discounts, help);
  whether quests then reward it, and essence.
- A sleeping NPC: can you wake him, what he says if you do, whether quests wait until morning. Where each sleeps.
- Hollis's story past his first Mistwood quest (the lore draft has the summoning pads, natives, the gods).

Code, the agent's call once the above is settled: whether NPC names move to the server with the rest of him (today
the name sits with his look on the client).
