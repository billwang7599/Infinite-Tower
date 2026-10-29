# Drops

Status: **being built**, as a stack of three PRs. Loot no longer goes straight into the bag: it lands as a pile of
items, and players open the pile and drag what they want into the bag. PR 1 (overworld piles) and PR 2 (the arena
after a win) are built; what's true of them is in [ARCHITECTURE.md](../ARCHITECTURE.md) and the decisions in
[AGENTS.md](../AGENTS.md).

## Decided by the user

- Loot drops as piles, not straight into the bag. A won fight's drops land **in the arena**, so whoever is in the
  arena gets dibs; everyone there is equal, first come first served. When the last player leaves the arena, what's
  left moves to an overworld pile at the spot where the fight started.
- Leaving the arena after a fight: automatic after 5 minutes. Enter still leaves earlier, but with loot left there
  it asks "are you sure" first.
- Shared loot ("lets have shared loot"): each fallen enemy's drops are rolled once for the fight, not once per
  winner, into the one pile.
- In the arena, E opens a pile only when you're next to it and looking at it (in front of where the camera faces);
  of several, the one nearest the view's centre line. The overworld keeps nearest-wins.
- A dead enemy's body disintegrates and is gone, and stops blocking players as it dies; its drops stay where they
  lie. A player who leaves the arena early fades out for the others.
- Picking up: open the pile and drag what you want into the bag ("e can be our interact button"). The overworld's
  Rest key becomes Interact: it rests at a campfire, joins a fight or opens a pile, the nearest of them winning.
- Unpicked piles vanish after 10 minutes ("we can do like a 10 minutes timer for unpicked up items to dissapear"),
  monster and death drops alike. The timer starts when the pile lands in the overworld; time in the arena doesn't
  count.
- Death drops: everything but the starter kit drops as a pile where you fell. In the arena the others get first
  pick; what's left, or everything if you lose alone, goes to an overworld pile at the fight's spot. The starter
  kit is still kept on death, for now.

## The PRs

1. **Overworld piles** (built). Server-owned piles on the overworld, seen by every player in view; Interact (E)
   opens the nearest in reach, and its items are dragged from the bag screen into the bag, every take checked by
   the server with the shared bag rules, first come first served. A pile vanishes when empty or after
   `PILE_LIFETIME_MS`.
2. **The arena after a fight** (built). The drops are rolled once for the fight and land in the arena as one pile beside
   the fallen enemy (whose body crumbles away), which every winner still there can open (E, next to it and looking at
   it); the fight runs on so they can walk to it, and a winner who leaves early fades out for the rest. Leaving is
   automatic after 5 minutes, Enter earlier (asking first if loot is left); when the last player leaves, the leftovers
   become an overworld pile at the fight's spot, its 10 minutes starting then.
3. **Death drops.** Dying drops all but the starter kit as a pile where you fell: in the arena for the others to
   pick from first, then the leftovers (or everything, alone) to an overworld pile at the fight's spot.

## Open

- A death in a duel drops nothing today (a spar); whether that stays.
- Where a death's pile lies in the arena (where you fell, or beside your body as the enemy's drops do), and whether
  the arena stays open after a loss when it holds a death's drops.
- Whether dropping things onto a pile (giving them to others) should be possible; for now a pile only gives.
