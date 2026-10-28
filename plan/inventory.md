# Inventory

Status: **being built**. Built: the bag (a grid with weights), what carrying too much does, dying (or leaving a
fight) emptying the bag, the bag screen, and the equipment and the cloth (see `shared/src/items/` and
`ui/hud/inventory/` in [ARCHITECTURE.md](../ARCHITECTURE.md)); what's left is below. The user's decisions are in
[AGENTS.md](../AGENTS.md), and so are the agent's picks for what's built.

## Next

1. **Loot screen:** after a win, the drops on one side and the bag on the other; drag in what you want, leave the
   rest. The server keeps the drops until you leave the screen.
2. **The bag screen in a fight** (the agent's pick, not built): it opens without the cloth, nothing can be moved,
   you can't move while it's open, and a stagger closes it. For now it doesn't open in the arena at all.
3. **Saving spells in the spellbook** ([spells.md](spells.md), PR D): its 4 pages hold saved spells, so the fresh
   book after a death is blank (the agent's pick); the words you know are kept.
4. **Drawing what's worn:** the arena's sprite holds a sword even with none in hand, and nothing shows the
   spellbook.

## Open questions

- With the sword and the spellbook in hand (4.5), a full bag (at most 60) is just over the limit: heavy, never
  overloaded. Heavier items, armour or a bigger bag would change that.
- Two-handed items, and armour for the head, body, legs and boots.
- Splitting a stack (taking some of it), dropping items on the overworld, and sorting the bag.
- The weight is still a line of text ("Weight 8 / 60"); a bar against the limit could replace it.
