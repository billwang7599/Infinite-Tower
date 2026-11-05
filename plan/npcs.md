# NPCs

Status: **next big step**. NPCs with lines that follow the story, quests, a questbook, stops that move an NPC with
the story, and traces are built.

## Goal

The story of AdventureQuest Worlds (quest chains, a cast that turns up again across the map) with the immersion of
Stardew Valley's villagers (routines, dialogue that knows you, friendships).

## Decided by the user (built)

- Quests come from NPCs, offered at the end of what they say: Accept or Not now, no other dialogue choices. A step
  asks you to gather, deliver, go somewhere, talk to someone or kill some of an enemy kind. Rewards are items, story
  flags and lore so far. Each player's story is their own, kept on death, decided by the server.
- The story is data run by one engine: a quest lives in its giver's file, and an NPC's file says where it stands and
  what it says by the story ("display dialogue based off of where they are + quest"), so NPCs are modular and
  followable.
- The questbook is always yours: a main quest and side quests, each with its next step and a hint as told, and the
  lore it revealed. Only what your character has found out, revealed slowly, AQW-style. No map markers, no minimap.

## Decided, not built

- Each player has a friendship with each NPC that grows, Stardew-style.
- Routines follow the day and night: most NPCs sleep at night.
- A recurring NPC moves on with the story, saying goodbye in person and leaving a trace that points the way (built
  for Hollis).

## Open

- How friendship grows and what it gives; whether quests reward it.
- A sleeping NPC: can you wake them, and do quests wait until morning.
- Whether a trace ever goes away, and whether locals mention who moved on.
- Hollis's story past his first Mistwood quest.
- The agent's draft: everyday NPCs stay put so a place never goes quiet; routines are spans of the shared day clock.
