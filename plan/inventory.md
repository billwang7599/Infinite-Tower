# Inventory

Status: **being built**. Built: the bag (a grid with weights), what carrying too much does, dying (or leaving a
fight) emptying the bag and the hands, the bag screen (in fights too), the equipment and the cloth, and the gear
slots with the backpack's own grid and the cosmetic slots (see `shared/src/items/` and
`ui/hud/inventory/` in [ARCHITECTURE.md](../ARCHITECTURE.md)); what's left is below. The user's decisions are in
[AGENTS.md](../AGENTS.md), and so are the agent's picks for what's built.

## Next

1. **Loot:** drops land as piles that are opened and dragged from into the bag: [drops.md](drops.md).
2. **Drawing what's worn:** the arena's sprite holds a sword even with none in hand, and nothing shows the
   skillbook. Nothing worn in the new slots shows on the person (the chibi, the portrait, the arena's model), and
   so nor do cosmetics, which only sit in the bag screen for now: drawing a cap, a belt or a cosmetic over its piece
   takes the drawings ART.md's "What to draw" counts per slot.
3. **Getting the new things:** the backpack, the cap, the belt, the ring, the bracelet and the feathered hat come
   only from the admin's give (and every new character's backpack); no shop sells them and nothing drops them.

## Open questions

- With the sword and the skillbook in hand (4.5), a full bag and backpack of tusks is about at the limit: heavy,
  never overloaded. Heavier items, armour or a bigger backpack would change that.
- Stats on rings, bracelets, belts or caps (none yet: a mechanic to ask about), and bigger backpacks.
- A backpack comes off only empty; taking one off full (its contents with it, as an item holding a grid) isn't built.
- Two-handed items, and armour for the head, body, legs and boots.
- Splitting a stack (taking some of it), dropping items on the overworld, and sorting the bag.
- The weight is still a line of text ("Weight 8 / 60"); a bar against the limit could replace it.
