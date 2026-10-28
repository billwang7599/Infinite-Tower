# Weapons

The user: "create an arsenal of weapons (in the future maybe we can customize the weapons themselves too ie modular
hilts and blades), but what entities should care about is what weapon it's holding. and play animations off of that.
otherwise, combat of weapon resolution is based off of the reach of the entity + reach of weapon (and other weapon
stats)."

## Built

- The arsenal is `WEAPONS` (`shared/src/weapons/weapons.ts`), one row per weapon item: its `kind` (the moveset it
  swings with; only `sword` so far) and its stats (length, damage, speed). A fighter holds items; `weaponIn` gives the
  stats of the one in hand. Reach is the wielder's arm reach (`PLAYER.armReachM`, an enemy's `wielder.armReachM`,
  0.8 m for everyone) plus the weapon's length; damage is the weapon's at the wielder's strength.
- Two weapons: the sword, and the Kobold's own blade (the sword's length and speed, 14 damage), which never drops.
- The client picks a weapon's look by item (`WEAPON_LOOKS`) and its motion by kind (`MOTIONS`), both in
  `client/src/visuals/battle/weapons.ts`.

## Later: weapons from parts

Hilts and blades as parts, put together into a weapon. `Weapon` stays the resolved stats, so parts would compute it
(a blade gives length and most of the damage, a hilt speed and balance) and nothing that swings would change.

Open: whether parts are items in the bag, where they're put together (anywhere, a campfire, a smith), whether a
weapon's kind comes from its blade, and how a built weapon is saved (an item id isn't enough any more).

## Next: inertia-based swings

The user's idea; nothing built. Weapons get mass and balance (later from their hilt and blade), the wielder's strength
drives the blade, and a swing's start, speed and combos come from the blade's momentum instead of `CHAIN`'s timing
table. The blade's motion is our own deterministic math in the shared fight; Rapier only if blades should physically
collide later.

Decided by the user: damage is the weapon's mass × its own strength stat (power, below) × the blade's speed at
impact, so a combo that keeps the blade moving pays off; the wielder's strength mainly sets swing speed (against the
weapon's mass) and still scales damage a little; enemies follow the same rules; the order swings come in is
decided by inertia alone ("lean whatever makes it feel more smooth & realistic"). This moves strength from scaling
damage (today: physical damage × strength / 10) to mostly scaling swing speed.

Decided by the agent (asked for semi-realistic, smooth, not broken equations), for the user to review:

- Mass m is the item's weight. Every ratio is against the starter sword (m0, strength 10), so the starter sword at
  strength 10 plays exactly as today (9 damage, today's timings).
- The blade is a point moving in the screen plane: where it is, and how fast and which way it moves. Its moment of
  inertia I = m × balance² (balance: the centre of mass's distance from the hand; later from hilt and blade). The
  wielder's strength gives a top torque, so its top acceleration a ∝ strength / I.
- A swing ends at its far side still moving a little (follow-through). The next swing's wind-up is the shortest time,
  under a, to bring the blade from where and how it moves to the next swing's start point and speed: about
  2√(distance / a) + |change of velocity| / a. This replaces `CHAIN`'s startup table. a and the start speed are set so
  the starter sword at strength 10 keeps today's opening (0.1 s) and reverse (0.05 s); the other orders fall out of
  the physics: the reverse is quickest (the blade is already there), the same swing again or its 45° neighbour
  slowest (the blade travels back across).
- Swing time (wind-up, live, recover) × sqrt((m / m0) / (strength / 10)), clamped to 0.5–2×. No strength requirement
  or lockout: too heavy a weapon just hits the 2× clamp and costs more stamina.
- Impact speed v = (strength / 10)^0.25 / sqrt(m / m0) × flow. Flow: the speed carried into the new swing's direction
  adds to it (topping at today's 1.25×), so looping or continuing swings hit harder and a quick reverse gets none. A
  gap, a block, a dodge or a hit taken drops the blade to rest. It replaces chain momentum.
- Damage = power × (m / m0) × v × 9 = power × sqrt(m / m0) × (strength / 10)^0.25 × flow: double strength is +19%.
- Not broken: momentum (m × v), not energy (m × v²), so fast combos can't explode; heavy hits are bigger but slower,
  so damage per second is the same for every mass at the same strength. Weapons differ by reach, power, stagger and
  punish windows instead.
- Stamina per swing ∝ the kinetic energy the wielder adds (½ I ω², braking too), against the starter sword's swing:
  heavy weapons and hard reversals cost more, flowing chains less. A block costs by the incoming impact momentum.
- Stagger (poise damage) comes from impact momentum (m × blade speed), not power.
- A buffered dodge or next attack still waits until the blade is done, never cutting it short; done now includes
  braking the blade, so heavy weapons let go later.
- The nine moves stay (swipes and the click pick one); the physics only sets timing, speed and cost between them.
- The parry window stays a fixed 0.15 s (fair to read); the parried side's stun scales with the parrier's blade
  momentum against theirs, clamped.
- Enemies use the same rules.

Open: armour as a percentage cut (blunt beats armour).
