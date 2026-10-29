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
- Five weapons, all swords: the sword (1.1 m, mass 3, balance 0.25 m, power 9), the longsword (1.4 m, 4.5, 0.3 m,
  power 11) and the greatsword (1.9 m, 8, 0.45 m, power 16), and the Kobolds' own blades, which never drop: the Kobold
  blade (the sword's length, mass and balance, 14 power) and the Kobold greatsword (the greatsword's, 14 power). The
  longsword's and greatsword's power is the agent's pick so their damage per second matches the sword's at strength 10
  (their balance is further out, so they swing slower than their mass alone would make them). Every player gets a
  longsword and a greatsword in the bag (the starter kit), and dying never takes them.
- The client picks a weapon's look by item (`WEAPON_LOOKS`) and its motion by kind (`MOTIONS`), both in
  `client/src/visuals/battle/weapons.ts`. The trail and the thrust are timed by each swing's own live time.

### Inertia-based swings

The user's idea: weapons get mass and balance, the wielder's strength drives the blade, and a swing's start, speed and
combos come from the blade's momentum. Decided by the user: damage is the weapon's power × its mass × the blade's
speed at impact, so a combo that keeps the blade moving pays off; the wielder's strength mainly sets swing speed
(against the weapon's mass) and still scales damage a little; enemies follow the same rules; the order swings come in
is decided by inertia alone ("lean whatever makes it feel more smooth & realistic"). The equations are the agent's,
for the user to review; all of it is `planSwing` and `SWING` in `weapons.ts`, deterministic math in the shared fight.

- Mass m is the item's weight, balance b the centre of mass's distance from the hand (the agent's picks), the moment
  of inertia I = m × (b² + L² / 12), the blade of length L counted as a rod. Every ratio is against the starter sword
  (m0, I0) at strength 10. The user then asked for slower, more exaggerated swings that start slow and carry on by
  momentum ("the start is slow but the momentum carries it"); the times below are the agent's picks for that.
- A swing is a stroke: set (the blade brought from rest to the swing's start, rest to rest: `setTime` 0.15 s ×
  √distance in the screen plane), driven (a constant push from its start speed to impact, so from rest the angle goes
  with t²: `driveTime` 0.2 s), live (`activeTime` 0.1 s, at its impact speed), then the follow-through (the same push
  braking it to rest: 0.2 s × its impact speed). Between swings the blade is a point in the screen plane, ±1 a swing's
  ends, its velocity in shares of the from-rest impact speed; a swing lets go on its far side at its impact speed,
  slowing through the follow-through. The drawn blade (`strokeOf`) follows the same steps: a third of a half-turn
  driving, a third live, a third following through, from rest.
- The next swing takes the quicker of two ways. Stop: brake the blade (as long as the follow-through would) and set it.
  Loop: speed already on the new way carries the blade round to its start (`loopTime` 0.1 s at the impact speed,
  longer slower), braking only what goes sideways, and the drive starts at that speed: from u it ends at √(u² + 1),
  up to 1.25× (the same swing again; its 45° neighbour 1.22×; across or reversed, none).
- With the starter sword, from rest 0.35 s to impact; the same swing again as the last lets go 0.19 s, its neighbour
  0.39 s, a reverse 0.4 s (brake 0.2 + drive 0.2; once the follow-through has stopped the blade, the drive alone),
  across 0.58 s. A stab brakes the blade, sets it back at the guard as a swing sets it to its start (0.15 s × √ the
  distance), draws back 0.2 s, thrusts in a drive, and follows through back to the guard (0.4 s from the guard, 0.55 s
  from a swing's far side, 0.75 s straight after a swing lets go; the greatsword 1.15 s and 1.58 s).
- Every time × √((I / I0) / (strength / 10)), clamped to 0.5–3×: the longsword 1.53× (0.53 s from rest), the greatsword
  2.87× (1.0 s from rest, the same again 0.54 s, a reverse 1.15 s, a follow-through 0.57 s).
- Impact speed v = (strength / 10)^0.25 / √(m / m0) × flow, flow the drive's end speed.
- Momentum = (m / m0) × v; damage = power × momentum, the stab's × 1.25. Double strength is +19%; a heavier weapon
  hits harder but slower, so damage per second is the same for every mass at the same strength and balance. An opening
  swing hits for 9 with the sword, 13.5 with the longsword, 26 with the greatsword.
- Stamina per swing = its cost × (I / I0) × (v / v0)² × (1 + ½ × the braked speed²): every drive costs an opening's,
  and braking costs half what giving the blade as much energy would (`brakeEffort`). With the starter sword an opening
  16, the same again 16, its neighbour 20, a reverse or across 24; a stab 20, 30 braking a moving blade. The longsword
  costs 1.55× (an opening 24.8), the greatsword 3.08× (an opening 49, a reverse 74). Too heavy a weapon (past the 3×
  clamp) pays the speed it lacks squared.
- Poise damage is the swing's or stab's × momentum. A block costs `PLAYER.block.staminaPerMomentum` (14, what a
  Kobold's blow cost before inertia) × the hit's momentum; a body blow still by its damage.
- A parry's window stays 0.15 s. The parried side's stun (or stagger) is scaled by the parrier's blade momentum over
  theirs, clamped to 0.5–2× (the agent's pick); a swordsman parrying from guard counts an opening swing's momentum.
  A parry 45° off head-on (the user's) scales the stun, stagger and knockback by `PARRY.offAngleShare` (0.5).
- The blade stays where its swing left it (the user: "sword stays where last swung. and from there its inertia"),
  still moving for `SWING.gapTime` (0.25 s) after an attack ends, then stopped there; it doesn't drift back. A block, a
  dodge, a hit taken, being parried, a chant, a cast or the bag rest it at the guard at once. From the guard, a swing
  is an opening; from a stopped blade, the set is the distance to the swing's start (with the starter sword after
  `lr`: `rl` 0.2 s, `brtl` / `trbl` 0.33 s, `tb` / `bt` 0.38 s, `lr` again 0.41 s; the greatsword 2.87× that). A stab
  doesn't depend on where the blade is, only how fast it moves.
- A buffered dodge or attack waits until the swing lets go (its wind-up and live time), so a heavier blade lets go
  later; it's never cut short.
- The Kobold's 1.1 s and 0.45 s wind-ups stay as telegraphs; the blade's own wind-up is only a floor. It never swings
  the same way twice running, so most of its chained swings now take the blade's 0.5-0.6 s; the Kobold Greatsword's
  chained ones 1.1-1.7 s. A telegraph longer than the blade needs holds the blade being set; the drive keeps its own
  time. Its chained swings flow like the player's (a 45° neighbour hits for 17). It follows through as it recovers. It
  has no stamina bar, so its swings cost nothing.

## Later: weapons from parts

Hilts and blades as parts, put together into a weapon. `Weapon` stays the resolved stats, so parts would compute it
(a blade gives length and most of the damage, a hilt speed and balance) and nothing that swings would change.

Open: whether parts are items in the bag, where they're put together (anywhere, a campfire, a smith), whether a
weapon's kind comes from its blade, and how a built weapon is saved (an item id isn't enough any more).

## Open

- Armour as a percentage cut (blunt beats armour).
