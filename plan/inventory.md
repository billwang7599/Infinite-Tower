# Inventory

Status: **being built**. Built: the bag (a grid with weights), what carrying too much does, dying (or leaving a
fight) emptying the bag, and the bag screen (see `shared/src/items/` and `ui/hud/inventory/` in
[ARCHITECTURE.md](../ARCHITECTURE.md)); what's left is below. The user's decisions are in [AGENTS.md](../AGENTS.md).

## Next

1. **Loot screen:** after a win, the drops on one side and the bag on the other; drag in what you want, leave the
   rest. The server keeps the drops until you leave the screen.

## Open questions

- The carry weight's effects can't happen yet: a tusk and a stack of meat both weigh 2.5 per cell, so a full 6 x 4
  bag weighs at most 60, exactly the limit. Heavier items, equipment, a bigger bag or a lower limit would change
  that.
- Equipment: equipped things weigh but take no bag space. Is the sword an item you carry, and can it be lost?
- Splitting a stack (taking some of it), dropping items on the overworld, and sorting the bag.
- The weight is still a line of text ("Weight 8 / 60"); a bar against the limit could replace it.
