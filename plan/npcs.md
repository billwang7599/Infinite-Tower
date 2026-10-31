# NPCs

Status: **next big step**. Hollis by the Grass Field's fire, and Maren and Tobin in the Waking Hollow (the starting
area, where their short chain sends you on to Hollis), are the NPCs. Quests, the questbook, lines that follow your
story and stops (where an NPC stands, by the story, per player) are built (AGENTS.md, ARCHITECTURE.md); Hollis's first
chain ends with "meet me in the Mistwood", but he has only the fire's stop for now. The plan below grows from there.

The model the user named: the story of AdventureQuest Worlds (quest chains, a cast that turns up again across the
maps) with the immersion of Stardew Valley's villagers (routines, dialogue that knows you, friendships).

## Decided by the user

- **Friendships**: each player has a friendship with each NPC that grows, Stardew-style.
- **Routines follow the day/night cycle**: most NPCs sleep at night.
- **A recurring NPC moves on with the story, leaving a trace.** Hollis does the everyday things by the campfire
  (talking, quests) until his chain there is done. He says goodbye in person ("meet me at ..."), and the next time
  you come back he's gone: one person in one place, never at two stops at once. What he leaves points the way, a
  packed bedroll or a local who says where he went, so a player who lost the thread is never stuck.
- **Next (PR 2): Hollis moves to the Mistwood** once his first chain is done (the story flag `hollis-to-mistwood`).

## How it could work (the agent's draft, to settle before building)

- **Stops** (built: `stops` in `server/src/core/npcs/<id>.ts`, `stopFor`): each one is a level, a spot, the condition
  that moves him there and his lines there; a player sees him at his first stop whose condition holds. Still to add:
  the trace he leaves behind when he goes. The server places NPCs as a player enters a level, so a move shows the next
  time they come; talking still follows the story at once, so a stop change mid-level needs a look.
- **Per player, in a shared world**: two players at the same fire may see different things: a new player still
  sees Hollis there, one further on sees his trace. The server already sends each player their own view, so a stop
  is one more filter on it.
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
- Hollis's story past the Mistwood (the lore draft has the summoning pads, natives, the gods).

Code, the agent's call once the above is settled: whether NPC names move to the server with the rest of him (today
the name sits with his look on the client).
