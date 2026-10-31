# Weapons

The user: "create an arsenal of weapons (in the future maybe we can customize the weapons themselves too ie modular
hilts and blades), but what entities should care about is what weapon it's holding. and play animations off of that.
otherwise, combat of weapon resolution is based off of the reach of the entity + reach of weapon (and other weapon
stats)."

## Built

- The arsenal is `WEAPONS` (`shared/src/weapons/weapons.ts`), one row per weapon item: its `kind` (the moveset it
  swings with; only `sword` so far) and its stats (length, damage, heft). A fighter holds items; `weaponIn` gives the
  stats of the one in hand. Reach is the wielder's arm reach (`PLAYER.armReachM`, an enemy's `wielder.armReachM`,
  0.8 m for everyone) plus the weapon's length.
- Five weapons, all swords: the sword (1.1 m, 9 damage, heft 1), the longsword (1.4 m, 11, 1.2) and the greatsword
  (1.9 m, 16, 1.6), and the Kobolds' own blades, which never drop: the Kobold blade (the sword's, 14 damage) and the
  Kobold greatsword (the greatsword's, 14 damage). Every player gets a longsword and a greatsword in the bag (the
  starter kit), and dying never takes them.
- The client picks a weapon's look by item (`WEAPON_LOOKS`) and its motion by kind (`MOTIONS`), both in
  `client/src/visuals/battle/weapons.ts`.
- One sword system, the Hybrid (the user tried five and kept it): 8-way aimed swings on the old momentum chains, a
  held block that a tap turns into a parry, the counter-parry by the reverse swing, a kick, a feint. The rules are in
  AGENTS.md (the "One sword system" bullet and "The Hybrid sword") and the numbers in FORMULAS.md. It replaced For
  Honor's guard stances, parries and guard breaks (PRs #178 and #182) and the inertia-based swings before them
  (`planSwing` in git history); the Posture, One Strike and Master Cuts styles were tried and dropped (their PRs,
  #192-#194, are closed, the branches kept).

## Later: the Kobolds' AI

Reading the player: answering the way a swing comes from, chains that mix ways to bait a block. Open: how quick its
reactions are, and how it differs by enemy.

## Later: weapons from parts

Hilts and blades as parts, put together into a weapon. `Weapon` stays the resolved stats, so parts would compute it
(a blade gives length and most of the damage, a hilt speed and balance) and nothing that swings would change.

Open: whether parts are items in the bag, where they're put together (anywhere, a campfire, a smith), whether a
weapon's kind comes from its blade, and how a built weapon is saved (an item id isn't enough any more).

## Open

- Armour as a percentage cut (blunt beats armour).
- Unblockable or undodgeable attacks; a stamina-out state. None is built.
