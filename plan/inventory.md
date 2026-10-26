# Inventory

Status: **being built**, as stacked PRs. The bag itself is built (a grid with weights, see `shared/src/items/` in
[ARCHITECTURE.md](../ARCHITECTURE.md)); what's left is below. The user's decisions are in [AGENTS.md](../AGENTS.md).

## Next

1. **Bag screen:** the inventory panel becomes the grid: drag with the mouse, or move a cursor with the keys, pick
   up and put down, turn (a new rebindable key). The weight as a bar against the limit. The client applies a move
   at once with the shared rules and takes the server's `bag` as the truth.
2. **Carry weight:** what being heavy does, like Dark Souls' equip load. Over half the limit: dodging and stamina
   recovery get worse; over it: no dodging, and slow walking (field and arena). The field part runs in the shared
   walking rules, so the server agrees on speed.
3. **Loot screen:** after a win, the drops on one side and the bag on the other; drag in what you want, leave the
   rest. The server keeps the drops until you leave the screen.
4. **Death:** the bag is emptied when you lose a fight.

## Open questions

- Numbers for the weight effects (how much worse the dodge and stamina get, how slow overloaded is).
- Stats going back "to 0" on death: stats can't grow yet, so there's nothing to reset. Once they can, is it back
  to the starting stats (strength 0 would deal no damage and carry only the base limit)?
- Equipment: equipped things weigh but take no bag space. Is the sword an item you carry, and can it be lost?
- Splitting a stack (taking some of it), dropping items on the field, and sorting the bag.
