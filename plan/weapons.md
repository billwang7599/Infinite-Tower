# Weapons

The user: "create an arsenal of weapons (in the future maybe we can customize the weapons themselves too ie modular
hilts and blades), but what entities should care about is what weapon it's holding. and play animations off of that.
otherwise, combat of weapon resolution is based off of the reach of the entity + reach of weapon (and other weapon
stats)."

## Built

- The arsenal is `WEAPONS` (`shared/src/weapons/weapons.ts`), one row per weapon item: its `kind` (the moveset it
  swings with; only `sword` so far) and its stats (length, mass, balance, power). A fighter holds items; `weaponIn`
  gives the stats of the one in hand. Reach is the wielder's arm reach (`PLAYER.armReachM`, an enemy's
  `wielder.armReachM`, 0.8 m for everyone) plus the weapon's length.
- Two weapons: the sword, and the Kobold's own blade (the sword's length, mass and balance, 14 power), which never
  drops.
- The client picks a weapon's look by item (`WEAPON_LOOKS`) and its motion by kind (`MOTIONS`), both in
  `client/src/visuals/battle/weapons.ts`. The trail and the thrust are timed by each swing's own live time.

### Inertia-based swings

The user's idea: weapons get mass and balance, the wielder's strength drives the blade, and a swing's start, speed and
combos come from the blade's momentum. Decided by the user: damage is the weapon's power × its mass × the blade's
speed at impact, so a combo that keeps the blade moving pays off; the wielder's strength mainly sets swing speed
(against the weapon's mass) and still scales damage a little; enemies follow the same rules; the order swings come in
is decided by inertia alone ("lean whatever makes it feel more smooth & realistic"). The equations are the agent's,
for the user to review; all of it is `planSwing` and `SWING` in `weapons.ts`, deterministic math in the shared fight.

- Mass m is the item's weight, balance b the centre of mass's distance from the hand (0.25 m for both blades, the
  agent's pick), the moment of inertia I = m × b². Every ratio is against the starter sword (m0, I0) at strength 10,
  which plays as before inertia: an opening wind-up of 0.1 s, a reverse of 0.05 s, 9 damage.
- The blade is a point moving in the screen plane: a swing goes from one side of the guard (-1) to the other (+1), its
  way across the screen (`SCREEN_DIR`), and ends there still moving at a quarter of its start speed (follow-through).
  A swing's wind-up is the shortest time to bring the blade from where and how it moves to the swing's start at its
  start speed: 2√(distance / a) + |change of velocity| / a. The top acceleration a and the start speed are solved
  from the opening and reverse times. With the starter sword: reverse 0.05 s, the 135° turn and an opening 0.1 s,
  across the line 0.113 s, its 45° neighbour 0.122 s, the same swing again 0.125 s.
- A stab draws back 0.14 s while the blade comes to rest in front (whichever is longer; it always fits), and leaves
  it at rest.
- Every time (wind-up, live, recover) × √((I / I0) / (strength / 10)), clamped to 0.5–2×.
- Impact speed v = (strength / 10)^0.25 / √(m / m0) × flow. Flow: the speed carried into the new swing's way adds to
  its start speed, up to 1.25× (the same swing again; its 45° neighbour 1.18×; across or reversed, none).
- Momentum = (m / m0) × v; damage = power × momentum, the stab's × 1.25. Double strength is +19%; a heavier weapon
  hits harder but slower, so damage per second is the same for every mass at the same strength.
- Stamina per swing = its cost × the energy it adds to the blade (½ I |Δv|², braking included) against the starter's
  opening swing: with the starter sword an opening 16, the same again 16, across 17, the 135° turn 22.7, the reverse
  25; a stab 20, 21.25 braking a moving blade. Too heavy a weapon (past the 2× clamp) pays the speed it lacks
  squared.
- Poise damage is the swing's or stab's × momentum. A block costs `PLAYER.block.staminaPerMomentum` (14, what a
  Kobold's blow cost before inertia) × the hit's momentum; a body blow still by its damage.
- A parry's window stays 0.15 s. The parried side's stun (or stagger) is scaled by the parrier's blade momentum over
  theirs, clamped to 0.5–2× (the agent's pick); a swordsman parrying from guard counts an opening swing's momentum.
- The blade swings on for `SWING.gapTime` (0.25 s) after an attack ends, then rests; a block, a dodge, a hit taken,
  being parried, a chant, a cast or the bag rest it at once. From rest, a swing is an opening.
- A buffered dodge or attack waits until the swing lets go (its wind-up and live time), so a heavier blade lets go
  later; it's never cut short.
- The Kobold's 1.1 s and 0.45 s wind-ups stay as telegraphs; the blade's own wind-up is only a floor (never reached
  with its blade). Its chained swings flow like the player's (a 45° neighbour hits for 16.5). It has no stamina bar,
  so its swings cost nothing.

## Later: weapons from parts

Hilts and blades as parts, put together into a weapon. `Weapon` stays the resolved stats, so parts would compute it
(a blade gives length and most of the damage, a hilt speed and balance) and nothing that swings would change.

Open: whether parts are items in the bag, where they're put together (anywhere, a campfire, a smith), whether a
weapon's kind comes from its blade, and how a built weapon is saved (an item id isn't enough any more).

## Open

- Armour as a percentage cut (blunt beats armour).
