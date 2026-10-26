# Inventory

Status: **being built**, as stacked PRs. Built: the bag (a grid with weights), what carrying too much does, and
dying emptying the bag (see `shared/src/items/` in [ARCHITECTURE.md](../ARCHITECTURE.md)); what's left is below.
The user's decisions are in [AGENTS.md](../AGENTS.md).

## Next

1. **Bag screen:** the inventory panel becomes the grid: drag with the mouse, or move a cursor with the keys, pick
   up and put down, turn (a new rebindable key). The weight as a bar against the limit. The client applies a move
   at once with the shared rules and takes the server's `bag` as the truth.
2. **Loot screen:** after a win, the drops on one side and the bag on the other; drag in what you want, leave the
   rest. The server keeps the drops until you leave the screen.

## Open questions

- The carry weight's effects can't happen yet: a tusk and a stack of meat both weigh 2.5 per cell, so a full 6 x 4
  bag weighs at most 60, exactly the limit. Heavier items, equipment, a bigger bag or a lower limit would change
  that.

- Leaving mid-fight: closing the tab (or losing the connection) during a fight drops the fight and saves the bag
  and the HP you came in with, so quitting escapes a death. Should leaving mid-fight count as dying?
- Equipment: equipped things weigh but take no bag space. Is the sword an item you carry, and can it be lost?
- Splitting a stack (taking some of it), dropping items on the field, and sorting the bag.
