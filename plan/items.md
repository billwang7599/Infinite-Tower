# Items, drops and money

Status: **mostly built**. The grid bag and backpack, weight, gear slots and cosmetics, the bag screen, drops as piles,
death drops, rarity, treasure, unique things, coins and shops are in the game. AGENTS.md has the one-line summaries;
FORMULAS.md the calculations.

## Decided by the user (built)

- **The bag** is an extraction shooter's grid: every item a rectangle of cells, turnable 90°, small items stacking in
  a cell. A tiny base bag, plus a backpack (a wearable item) whose grid is its own, never joined to the bag. No stash.
- **Weight** counts against a limit that grows with strength (Dark Souls' equip load): over it a dodge costs more;
  well over it, no dodging and half walking speed, on the overworld and in the arena. Stamina refill isn't affected.
  Worn things count without taking bag space.
- **Gear slots**: both hands, cap, head, body, legs, boots, belt, back (the backpack), two wrists, five rings (one a
  finger), a hip slot for a quiver, and a cosmetic slot over the cap, head, body, legs and boots that changes only
  looks. Weapons and the skillbook are items you hold in a hand; a new character starts with neither.
- **The bag screen** is worked with the mouse only: hover for a tooltip, click to select, drag to move (green where it
  fits, red where not), R or a right click to turn, Enter or a double click to use. Equipment on the left, a cloth in
  the middle (a big scratch grid on the overworld; what's left on it when the screen closes is lost), then the bag and
  backpack. The world doesn't pause; you stand still. In a fight the bag opens too, without the cloth, and its moves
  are the fight's inputs.
- **Drops are piles**, not packed into the bag, opened with Interact (E) when you're next to one and facing it, the
  same on the overworld and in the arena; what you want is dragged out. Loot is shared, first come first served: each
  fallen enemy's drops are rolled once for the fight.
- **A won arena stays open** for its loot, everyone there equal; it closes by itself after a few minutes, and leaving
  earlier asks "are you sure" only while loot is left. The leftovers become an overworld pile where the fight began.
  An unpicked overworld pile vanishes after about 10 minutes; time in the arena doesn't count. A dead enemy's body
  crumbles and stops blocking at once; a player who leaves early fades out for the others.
- **Death drops** everything you carry (bag, slots, backpack) as a pile where you fell; in the arena the others there
  get first pick. A disconnect mid-fight counts as a death. A duel drops nothing.
- **Rarity and uniques**: every item has a rarity; a unique thing exists once in the world, held by one player at a
  time, goes back to the world after its holder's 7 days away or when its death pile vanishes, and can be traded.
- **Money**: gold, silver and copper coins (100 of one to the next) carried as bag items, so lost on death. Earned by
  selling loot and from quests; monsters drop none and new players have none. Coins never repack themselves: they're
  changed at any shop or a money changer. Shops take any coins and give change in the fewest; what doesn't fit lands
  on the cloth. Prices go by place (the capital is pricier), and a first purchase at each shop is cheaper; prices by
  how an NPC likes you come later.
- A trade system, when it comes, must keep unique things tradable.

## Next

- Getting the new gear: the backpack, caps, belts, rings and bracelets come only from the admin panel so far.
- Drawing what's worn on the chibi and the portrait (the arena's 3D people already wear it).
- OptChat's drafts: a glow on piles holding rare things, a notice for big drops, the world told when a unique thing
  drops, changes hands or goes back; unique things never kept in a stash or bank (carrying one is the risk); rare
  things from quests, crafting, bosses and hidden places.

## Open

- Armour; stats on rings, belts or caps (a mechanic to ask about); bigger backpacks; taking off a full backpack.
- Splitting stacks, dropping items on the overworld, sorting the bag; a weight bar instead of the line of text.
- How a unique thing is lost (needs balancing); whether a duel's death ever drops anything.
- Whether others may take from a death's pile mid-fight; whether things can be dropped onto a pile; whether the
  overworld's facing for piles should follow the exact step.
- The rarity colours and drop chances (the agent's picks, untuned).
