# Inventory

Status: **being built**. Built: the bag (a grid with weights), what carrying too much does, dying (or leaving a
fight) emptying the bag, and the bag screen (see `shared/src/items/` and `ui/hud/inventory/` in
[ARCHITECTURE.md](../ARCHITECTURE.md)); what's left is below. The user's decisions are in [AGENTS.md](../AGENTS.md).

## Next

1. **Loot screen:** after a win, the drops on one side and the bag on the other; drag in what you want, leave the
   rest. The server keeps the drops until you leave the screen.
2. **Equipment** (decided by the user, not built): the sword and the spellbook are items. A new character starts
   with both equipped ("equipped at start"), not in the bag. Dying still empties the bag, and you respawn with a
   fresh equipped sword and spellbook ("lets say we get fresh set when respawn"). "yes we need to equip to use
   them": swinging needs a sword equipped, casting (and chanting) a spellbook. Slots for now: left hand, right hand,
   head, body, legs, boots. Equipped things count toward the carry weight but take no bag space.
3. **The bag screen's layout** (decided by the user, not built): equipment on the left ("same hud as the bag open,
   but to the left side"), then a cloth in the middle, then the bag grid. The cloth is also a grid, "a place to put
   items in temporarily to organize bag. if closed and items are still there, the item is lost for now."

Decided by the agent (the user asked the main chat to decide, aiming for "a fun but semi/realistic game"; changeable):

- The cloth is 4 x 4 and laid on the ground, so what's on it doesn't count toward the weight. It exists only on the
  overworld: in a fight the bag screen opens without it, you can't move while it's open, and a stagger closes it.
- Either hand takes either item; the sword starts in the right hand and the spellbook in the left. No two-handed
  items yet. No sword in a hand means no swings; no spellbook means no casting or chanting.
- Head, body, legs and boots stay empty: there's no armour yet.
- Saved spells are written in the spellbook (4 pages), so the fresh book after a death is blank; the words you know
  are kept.

## Open questions

- The carry weight's effects can't happen yet: a tusk and a stack of meat both weigh 2.5 per cell, so a full 6 x 4
  bag weighs at most 60, exactly the limit. Heavier items, equipment, a bigger bag or a lower limit would change
  that.
- The sword's and the spellbook's weights.
- Splitting a stack (taking some of it), dropping items on the overworld, and sorting the bag.
- The weight is still a line of text ("Weight 8 / 60"); a bar against the limit could replace it.
