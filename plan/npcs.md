# NPCs

Status: **next big step**. Hollis by the Grass Field's fire is the only NPC: he stands in one place and says the same
lines to everyone. His files are laid out like the enemies' (ARCHITECTURE.md), and the plan below grows from there.

The model the user named: the story of AdventureQuest Worlds (quest chains, a cast that turns up again across the
maps) with the immersion of Stardew Valley's villagers (routines, dialogue that knows you, friendships).

## Decided by the user

- **Quests**: NPCs give quests, and the story runs through chains of them.
- **Friendships**: each player has a friendship with each NPC that grows, Stardew-style.
- **Routines follow the day/night cycle**: most NPCs sleep at night.
- **A recurring NPC moves on with the story, leaving a trace.** Hollis does the everyday things by the campfire
  (talking, quests) until his chain there is done. He says goodbye in person ("meet me at ..."), and the next time
  you come back he's gone: one person in one place, never at two stops at once. What he leaves points the way, a
  packed bedroll or a local who says where he went, so a player who lost the thread is never stuck.
- **A questbook** keeps track of your quests and the lore you've learned. It's always yours (not a bag item, never
  lost), opened as its own menu item.
- **Lore is what you've discovered so far.** The quests and the storyline reveal it slowly, AQW-style: the questbook
  only ever holds what your character has found out, never the whole story up front.
- **An active quest shows its next step and a hint**: what to do ("Bring 5 boar hides to Hollis") and where, as the
  NPC told you ("Hollis said to meet him past the eastern road, in the Mistwood"). It knows only what you were told.
- **No markers and no minimap for now**: only the questbook and what NPCs tell you.
- **The questbook has two halves: the main quest and side quests.** The main quest unfolds the main lore (the
  soul, the tower, the gods, the Maker). Side quests carry side lore, small or big: helping an old wizard, or
  kingdoms clashing. Each half holds its quests and the lore they've revealed.
- **Its key is J** (the user left the pick to the agent): J for journal, as in Skyrim and The Witcher, and free in
  both the overworld and the arena, so it's a general key that opens anywhere, like the bag.

## How it could work (the agent's draft, to settle before building)

The common way across RPGs: what an NPC *is* lives apart from *where and when* he shows up, dialogue is data with
conditions, and each player's progress is a set of flags the conditions read.

- **One file per NPC** (`server/src/core/npcs/<id>.ts`, as now) holds everything about him: his stops, his routine,
  his lines and his quests. Levels stop placing NPCs; an NPC names the level of each stop instead, so following one
  person's story means reading one file.
- **Stops**: each one is a level, a spot, the flag that moves him there and the trace he leaves behind when he goes.
  The first needs no flag. A player sees him only at his latest unlocked stop.
- **Per player, in a shared world**: two players at the same fire may see different things: a new player still
  sees Hollis there, one further on sees his trace. The server already sends each player their own view, so a stop
  is one more filter on it.
- **Everyday NPCs stay put**: each place gets its own residents for talk, small quests and friendship, so a fire
  doesn't go quiet when Hollis leaves. His friendship and everyday quests travel with him.
- **Routine**: a list of day-fraction spans (awake by the fire, asleep in a bedroll beside it, ...), read from the
  shared day clock (`shared/src/world/day.ts`), so the server and every client agree. A day is 24 real minutes,
  so a night of sleep is about 9 of them.
- **Lines with conditions**: each line (or short exchange) has a "when": flags, quest steps, friendship, time of day,
  which stop. The first that matches is said. A trace's line ("Hollis left for the Mistwood, said you'd know") is one
  of these too.
- **The questbook** is a screen drawn from the same per-player story: open quests with their current step, finished
  ones, and lore entries. A lore entry is unlocked by a flag (a line heard, a place reached, a book read), and its
  text lives in one table of entries, so the questbook and the dialogue never hold two copies of a story.
- **Each player's story** is saved with the player as one `jsonb` column (flags, quest steps, friendship per NPC),
  like the per-weapon proficiency idea. The server alone changes it; the client gets what it needs to draw.

## Open

Game mechanics, for the user to decide:

- What quests ask for (kill, gather, deliver, go somewhere, talk to someone) and what they give (items, essence,
  friendship, story).
- How friendship grows (talking each day, gifts, quests) and what it gives (lines, quests, items, discounts, help).
- A sleeping NPC: can you wake him, what he says if you do, whether quests wait until morning. Where each sleeps.
- What dying does to the story: kept like words are (the lore says words survive), or partly lost. The never-lock-out
  rule means it can't strand a player either way.
- Whether a party shares story progress, or each player moves on alone.
- Dialogue choices (answers you pick), or lines only.
- Inside each half of the questbook: lore under the quest that revealed it, or a separate list of entries.
- Hollis's story and where his second stop is (the lore draft has the summoning pads, natives, the gods).

Code, the agent's call once the above is settled: whether NPC names move to the server with the rest of him (today
the name sits with his look on the client), and how stops reach the client (in the level's actors, filtered).
