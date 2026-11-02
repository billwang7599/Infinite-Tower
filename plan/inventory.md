# Inventory

Status: **being built**. Built: the bag (a grid with weights), what carrying too much does, dying (or leaving a
fight) emptying the bag and the hands, the bag screen (in fights too), and the equipment and the cloth
(see `shared/src/items/` and
`ui/hud/inventory/` in [ARCHITECTURE.md](../ARCHITECTURE.md)); what's left is below. The user's decisions are in
[AGENTS.md](../AGENTS.md), and so are the agent's picks for what's built.

## Next

1. **Loot:** drops land as piles that are opened and dragged from into the bag: [drops.md](drops.md).
2. **Drawing what's worn:** the arena's sprite holds a sword even with none in hand, and nothing shows the
   skillbook.

## Open questions

- With the sword and the skillbook in hand (4.5), a full bag (at most 60) is just over the limit: heavy, never
  overloaded. Heavier items, armour or a bigger bag would change that.
- Two-handed items, and armour for the head, body, legs and boots.
- Splitting a stack (taking some of it), dropping items on the overworld, and sorting the bag.
- The weight is still a line of text ("Weight 8 / 60"); a bar against the limit could replace it.
