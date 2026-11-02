# Rarity, and unique things

Status: **an idea, nothing built.** Covers items and inscriptions (sigils, plan/inscriptions.md) alike.

## Decided by the user

- Items get a rarity.
- Some items and inscriptions are unique: only one exists in the entire world, so only one player can own it at a
  time. How a unique thing is lost still needs balancing.
- A unique thing whose holder hasn't logged in for 7 days goes back to the world.
- A carved unique inscription is kept through death, PvP deaths included: they're meant to be very strong
  augments, and losing one to a single death would make players quit.

## Drafted by OptChat (for the user to change)

### The tiers

| Rarity | Colour | Where it comes from |
|---|---|---|
| Common | white | shops, crafting, most drops |
| Uncommon | green | tougher monsters, crafting from uncommon parts, small quests |
| Rare | blue | rare drops (a few %), quest rewards, crafting from rare parts |
| Epic | purple | bosses, long quest chains, hidden places |
| Legendary | gold | super rare drops (well under 1%), legendary words, the hardest quests |
| Unique | red | one in the world (below) |

- **Rarity belongs to the kind of item**, set by hand in the item table: every Wolf fang is Common, every Kobold
  greatsword Uncommon. No random rolls or affixes, so a tooltip always tells the truth.
- **Rarity says how hard a thing is to get, not how strong it is.** Rarer things tend to be stronger, but a Rare
  item can be a side-grade.
- **How it shows:** the name in its colour (tooltip, loot, notices), a thin tinted edge on its bag cells, and a
  glow on piles holding Rare or better. An Epic or better drop gets its own notice.
- **Today's items:** Common for food, coins, hides, pelts, fangs, tusks, the old stick, the sword, the skillbook
  and boar essence; Uncommon for potions and tonics, the longsword, greatsword, Kobold blades, Lurker scales and
  the other essences.

### Unique things

- **The server keeps one record per unique thing:** who holds it, which pile it lies in, or nobody (back in the
  world). While someone holds it, its source doesn't drop it.
- **A unique item is lost like any item.** Dying drops it in your pile, where anyone can pick it up. That's the
  risk of carrying it, so it should never go in a stash or bank when those come.
- **It goes back to the world** when its pile vanishes (the usual 10 minutes), or when its holder hasn't logged in
  for 7 days (user's decision). Its source can then drop it again, for whoever gets there first.
- **Telling the world:** when a unique thing drops, changes hands or goes back, everyone gets a notice.
- **A unique inscription, once carved, is kept through death** like every inscription (user's decision), so it only
  goes back to the world when it's removed or its holder goes 7 days without logging in. An uncarved unique sigil
  is still an item, and is lost on death like one.

## Open

- The colours and names (the realms' names would clash with the core, so they're kept plain).
- Drop chances per tier.
- Whether a holder can trade or give away a unique thing (likely yes, it's an item until carved).
