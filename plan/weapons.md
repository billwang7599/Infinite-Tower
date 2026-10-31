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
- Sword fights like For Honor's (the user: "make the sword combat closer to for honour"), PR 1: guard stances (left,
  top, right) that block free from across, light and heavy attacks from the guard's side at fixed times per weapon
  (heft), chains of three, a recoil when blocked, the guard widget, the Kobolds holding and switching a guard. The
  rules are in AGENTS.md ("Guard stances") and the numbers in FORMULAS.md. It replaced the inertia-based swings (their
  equations are in git history, `planSwing` before this PR).

## Next: parries, guard breaks and feints (PR 2)

The main chat's plan, its details still open: a parry (timed against an attack's hit), a guard break (a throw-like
move that opens a turtling guard), and feints (a heavy cancelled before it lands). Open: their timings and windows,
what each costs and gives (stun, damage, stamina), whether a blocked heavy chips, how the Kobold uses them, and the
sounds (the old parry and guard-break sounds were removed with PR 1 and can come back from git history).

## Later: the Kobolds' stance AI

Reading the player's guard and attacks: blocking by reacting to the side an attack comes from (with a reaction time),
switching to an open side, chains that mix sides. Open: how quick its reactions are, and how it differs by enemy.

## Later: weapons from parts

Hilts and blades as parts, put together into a weapon. `Weapon` stays the resolved stats, so parts would compute it
(a blade gives length and most of the damage, a hilt speed and balance) and nothing that swings would change.

Open: whether parts are items in the bag, where they're put together (anywhere, a campfire, a smith), whether a
weapon's kind comes from its blade, and how a built weapon is saved (an item id isn't enough any more).

## Open

- Armour as a percentage cut (blunt beats armour).
