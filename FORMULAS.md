# Formulas

Every calculation that decides how the game plays, as the code does it today: the formula, what each term is, where
its numbers live, and a worked example at the starting stats (every stat 10: Early Yan with no points placed).
Units: seconds, metres and m/s in the arena, tiles and tiles/s on the overworld; HP, stamina, poise and item weight
have none. A fight runs in steps of 1/60 s (`FIXED_DT`), so its times round to those.
The other knobs (looks, camera, netcode) are in ARCHITECTURE.md's
[Where to tune things](ARCHITECTURE.md#where-to-tune-things).

Keep it current: a PR that changes a calculation or its numbers changes it here too.

- [Stats](#stats)
- [The core](#the-core)
- [Weapon attacks](#weapon-attacks)
- [Body blows](#body-blows)
- [Guards](#guards)
- [Parries, guard breaks and feints](#parries-guard-breaks-and-feints)
- [The hybrid style](#the-hybrid-style)
- [The Posture style](#the-posture-style)
- [The One Strike style](#the-one-strike-style)
- [The Master Cuts style](#the-master-cuts-style)
- [Poise and stagger (enemies)](#poise-and-stagger-enemies)
- [Stun and invulnerability (players)](#stun-and-invulnerability-players)
- [Stamina](#stamina)
- [Movement](#movement)
- [Carry limit and burden](#carry-limit-and-burden)
- [Skills](#skills)
- [Damage taken](#damage-taken)
- [Enemies](#enemies)
- [Encounters and drops](#encounters-and-drops)
- [Healing and refills](#healing-and-refills)

## Stats

`Stats` and its formulas are in `shared/src/battle/stats.ts`. A player's come from their core (`coreStats`, below);
an enemy's are in its file in `server/src/core/enemies/`. Every one is ×1 at 10 (`AVERAGE_STAT`).

| Stat | Start | Formula | Where |
|---|---|---|---|
| strength | 10 | physical damage × √(strength / 10); carry limit 60 × (strength / 10)^¼ | `physicalDamage`, `carryLimit` |
| agility | 10 | walking and dodging × (agility / 10)^¼, in the arena and on the overworld | `moveSpeed` |
| stamina | 10 | the stamina bar = 10 × stamina | `staminaMaxOf` |
| skillpower | 10 | skill damage × √(skillpower / 10) | `skillDamage` |
| vitality | 10 | the most HP = 10 × vitality | `maxHpOf` |
| defense | 10 | physical damage taken × 50 / (40 + defense) | `physicalTakenFactor` |
| special defense | 10 | skill damage taken × 50 / (40 + special defense) | `skillTakenFactor` |
| toughness (hidden) | 10 | a stun or stagger × 10 / toughness | `stunTime` |
| stamina recovery (hidden) | 10 | stamina refill × stamina recovery / 10 | `staminaRegenPerSec` |
| health regen (hidden) | 10 | HP a second = vitality × health regen / 200 | `hpRegenPerSec` |

Enemies have every stat at 10 but skillpower 0 (the Goblin Warlock's 10) and health regen 0. An enemy's HP is its own
`maxHp`, not its vitality (enemy realms come later). Only an enemy that casts (the warlock) has a stamina bar.

HP and stamina carry from one fight to the next (`Vitals`). When the stats change (a breakthrough, a point placed), a
bar that grows adds what it grew to what's in it, and one that shrinks only cuts what's in it to fit (`grownVitals`).

## The core

`CORE` and its rules in `shared/src/soul/core.ts`. Five realms (Yan, Sol, Lux, Ling, Tian) of three steps (Early,
Middle, Peak): 15 steps, each finished by filling it with essence.

- **Fill to finish step n** (1-15) = round(100 × 2^((n − 1) / 3)) (`fillToFinish`): 100, 126, 159, 200, ... 2540;
  11,927 in all. Essence past a step's fill carries into the next; finishing step 15 leaves the core whole, taking no
  more.
- **What a step gives:** every shown stat + 1 × 2^realm (1, 2, 4, 8, 16), the hidden three + 1, and 2 × 2^realm free
  points. After all 15: 103 each before points, the hidden 25, and 186 points.
- **Free points** go into the shown stats, one at a time, outside fights; taken back one at a time only by a campfire.
- **Essence** (an item's `essence` effect in `ITEMS`): boar 20, Kobold Swordsman 40, Kobold Greatsword 50, Goblin
  Warlock 30. Absorbing takes 2 s (`useTime`). The first step is 5 boars.
- **Death:** the step's fill is lost; with none, the step (and its gains); points over what's left are taken back off
  the stats with the most first (`coreAfterDeath`).

Example: Early Yan, 90 in: a boar's essence (20) breaks through to Middle Yan with 10 in. Every shown stat is 11, the
hidden ones 11, 2 points free; the most HP 110, the stamina bar 110, and HP and stamina each 10 more than before.

## Weapon attacks

All of it is `ATTACKS`, `COMBAT`, `attackSteps`, `attackDamage` and `attackCost` in `shared/src/weapons/weapons.ts`,
with each weapon's numbers in `WEAPONS`. Nothing varies with how an attack is reached: the same attack with the same
weapon always takes the same time and deals the same damage.

| Term | Formula | Notes |
|---|---|---|
| wind-up | `landTime` × heft (a chain's 2nd and 3rd: `chainLandTime` × heft), ÷ an Air Imbue's swift factor | from the press to the blade going live; drawn back for the first 60% (`drawShare`), driven for the rest |
| live | `liveTime` × heft | the hitbox is up |
| recovery | `recoverTime` × heft | walking at 25% (`moveFactor`); the next attack in the chain can start in it |
| damage | the weapon's `damage` × `damageFactor` × √(strength / 10) | light 1, heavy 2 |
| poise damage | `poiseDamage` | light 12, heavy 24 |
| stamina | `cost` × heft | light 12, heavy 20 |

| Attack | Wind-up | Chained | Live | Recovery | Recoil when blocked |
|---|---|---|---|---|---|
| Light | 0.45 | 0.4 | 0.1 | 0.35 | 0.3 |
| Heavy | 0.85 | 0.7 | 0.12 | 0.55 | 0.5 |

A chain is an attack started in the last one's recovery, at most `maxChain` 3; after the third, the next waits out its
recovery and starts a new chain. A dodge waits only for the blade to be done (the end of its live time).

By weapon, at strength 10 (light / heavy; times in seconds):

| Weapon | Heft | Damage | Wind-up | Chained | Stamina |
|---|---|---|---|---|---|
| Sword | 1 | 9 / 18 | 0.45 / 0.85 | 0.4 / 0.7 | 12 / 20 |
| Longsword | 1.2 | 11 / 22 | 0.54 / 1.02 | 0.48 / 0.84 | 14.4 / 24 |
| Greatsword | 1.6 | 16 / 32 | 0.72 / 1.36 | 0.64 / 1.12 | 19.2 / 32 |
| Kobold blade | 1 | 14 / 28 | 0.45 / 0.85 | 0.4 / 0.7 | none |
| Kobold greatsword | 1.6 | 14 / 28 | 0.72 / 1.36 | 0.64 / 1.12 | none |

Strength: a sword light at strength 20 deals 9 × √2 = 12.7; strength doesn't change times or costs.

**Reach** (`attackShape`): (arm reach + L) × the side's factor, to the target's surface; arcs by angle to its centre
(any angle within 0.3 m). Arm reach is `PLAYER.armReachM` 0.8 (an enemy's `wielder.armReachM`, also 0.8).

| Side | Reach factor | Arc | The sword (1.9 m) |
|---|---|---|---|
| Left, right | 1 | 160° | 1.9 m |
| Top | 1.3 | 60° | 2.47 m |

While an attack's blade is live it carries you forward at `lungeSpeed` 4 m/s; otherwise you walk at 25%
(`moveFactor`) while attacking.

An enemy's attack runs the same timings and damage; it deals no poise damage, costs no stamina, and holds its tell
first (`windup` before a chain's first, `chainWindup` before the next: `fight/behaviors/weapon.ts`).

## Body blows

An enemy's lunge or charge (`addHitAhead`): damage = its `damage` × √(strength / 10). Landing on a player who isn't
blocking, it knocks them back at its `knockback` m/s (plus `lift` up; not while Warded) and takes control away
(hitstun) for (`HITSTUN_TIME` 0.25 + `HITSTUN_PER_KNOCKBACK` 0.02 × knockback) × 10 / toughness (`combat.ts`). A
weapon's hit only hurts: no knockback, no hitstun.

| Blow | Damage | Knockback (m/s) | Hitstun (s) |
|---|---|---|---|
| Boar bite (lunge) | 16 | 8 | 0.41 |
| Boar charge | 30 | 15 | 0.55 |
| Warlock's staff (lunge) | 5 | 3 | 0.31 |

## Guards

`blocks`, `COMBAT` in `weapons.ts`; `guardOf` and `combatSystem` in `combat.ts`.

- A guard blocks an attack from the side across from it (the attacker's left by your right; top by top), from within
  70° either side of where its holder faces (`guardMinDot` 0.34). A body blow comes from the top.
- A player's guard counts only while idle (no action, no hitstun) with a sword in hand; a Kobold's while it walks up or
  holds its tell, its old side while its guard moves (`ENEMY_GUARD.moveTime` 0.3 s).
- Blocking is free: no stamina, no damage. A blocked weapon attack ends, and its wielder recoils for its
  `recoilTime` (light 0.3 s, heavy 0.5 s; an enemy's next chain waits that plus its cooldown). A blocked body blow
  pushes you back at its knockback × `pushbackFactor` 0.6 m/s.

Example: a boar's charge into a top guard: no HP, no stamina, pushed at 9 m/s. A Kobold's light into the right guard
from its left: nothing lands, and it recoils 0.3 s.

## Parries, guard breaks and feints

`PARRY`, `GUARD_BREAK`, `FEINT`, `parryOpenTime`, `guardBreakOpenTime` in `weapons.ts`; the parry in `combat.ts`, the
guard break in `fight/weapons/guard-break.ts`, the feint in the player's controller and `feintable` (`swing.ts`).

- **Parry:** a heavy pressed at most `PARRY.windowTime` 0.25 s before a weapon's attack lands (the step it lands
  counts), from the guard across it (as a block would be) and facing within 70°, parries it. The heavy is spent, its
  stamina given back; the attack ends, unhurt. The attacker is opened (no guard, no control) for the parrier's light's
  land time × heft + `openMarginTime` (a parried light 0.15 s, a heavy 0.45 s). Body blows can't be parried.
- **Guard break:** costs `GUARD_BREAK.cost` 10. `grabTime` 0.15 s after the press it takes the nearest foe within
  `reachM` 1.9 m (centre to its edge) and 45° of where you face (`minDot` 0.7), through any guard, if it holds a blade
  and isn't mid-attack (winding up or live), dodging, guard breaking, held or opened. Nobody taken, you're busy until
  0.6 s (`whiffTime`), unguarded. Taken, it's held `techTime` 0.4 s: a guard break pressed by it then (not before)
  counters it, both pushed apart at 5 m/s. Not countered, it's opened for the grabber's heavy's land time × heft +
  `openMarginTime` 0.2 s, and can't be guard broken again until `immuneTime` 0.6 s after that.
- **Feint:** guard break pressed during your heavy's wind-up while more than `FEINT.cutoffTime` 0.15 s of it is left
  ends it for `FEINT.cost` 10 more stamina; you're free (and guarding) at once. A light can't be feinted.
- An opened enemy's next attack waits out the opening, not its cooldown too.

| With | A light parried opens for | A heavy parried | Guard broken | Feintable until (heavy) |
|---|---|---|---|---|
| Sword (heft 1) | 0.6 s | 0.9 s | 1.05 s | 0.68 s after the press |
| Longsword (1.2) | 0.69 s | 0.99 s | 1.22 s | 0.85 s |
| Greatsword (1.6) | 0.87 s | 1.17 s | 1.56 s | 1.2 s |

Example: a Kobold's heavy (0.85 s) is parried by a sword heavy pressed 0.2 s before it lands: 20 stamina spent and
given back, nobody hurt, and the Kobold is open 0.9 s; your light, pressed at once, lands 0.45 s later. A guard
break on a guarding Kobold grabs it 0.15 s after the press; 0.4 s later its guard breaks (unless it countered: 30%),
and it's open 1.05 s, long enough for your heavy (0.85 s).

## The hybrid style

The sections above are For Honor's, the default combat style. A fight in the hybrid style (its starter's setting)
plays by these instead: `CHAIN`, `MOMENTUM`, `HYBRID`, `COUNTER_PARRY` in `shared/src/weapons/hybrid.ts`; the rules
in `shared/src/battle/fight/styles/hybrid/`. Damage still goes × √(strength / 10), and every time × the heft.

- **Wind-up** (press to the blade going live): a light `CHAIN.startupTime` by how it follows the last swing (an
  opening or after a stab 0.1 s, the reverse 0.05 s, another line 0.1 s, a perpendicular one 0.16 s) ×
  (1 − 0.1 × momentum, momentum at most 4); a heavy the same + 0.35 s; a stab 0.14 s. Live 0.1 s (a heavy 0.12 s),
  then recovering 0.08 s (a heavy 0.2 s). It chains if it starts during the last attack or within `gapTime` 0.25 s of
  its end.
- **Momentum:** each chained swing adds `MOMENTUM.gain` (the reverse 1, another line 0.5, a perpendicular 0.25), at
  most 4, and is lost on a gap, a dodge, a block, a cast, the chant, the bag, a hit taken or being parried.
- **Damage:** a swing the weapon's damage × (1 + 0.25 × momentum, ×2 at most), a heavy ×2 more; a stab × 1.25 ×
  (1 + 0.5 × momentum) and spends it. **Stamina:** a light 16, a heavy 24, a stab 20 (× heft). **Poise:** 12, 24, 18.
- **Reach:** (arm 0.8 m + blade) × 1 across (160°), × 1.15 on a diagonal (110°), × 1.3 up or down (60°), × 1.75 for a
  stab (16°).
- **Held block:** from in front (within 70°), a hit costs damage × 1 stamina and a weapon chips 20% of its damage;
  a body blow pushes you back at 60% of its knockback. A heavy, or too little stamina, breaks it: staggered 0.8 s.
- **Tap parry:** a block pressed at most `tapParryTime` 0.25 s before a weapon lands parries it, free; the attacker is
  staggered `riposteTime` 0.4 s. No window if the last press was under `retapTime` 0.5 s before.
- **Counter-parry:** your swing's blade gone live at most 0.15 s before theirs lands, the swing meeting theirs head-on
  (share 1) or 45° off (share 0.5), or a stab against a stab: an enemy is staggered 1 s × share and slides back 1.5 m ×
  share; a player is staggered 0.5 s × share and knocked back at 6 m/s × share.
- **Kick:** 15 stamina; lands 0.2 s in on the nearest foe within 1.4 m (centre to edge) and 45°; a held block is
  staggered 0.6 s, anyone else not mid-attack shoved (staggered 0.25 s, pushed at 7 m/s). Over at 0.5 s. The kick
  key in your wind-up with more than 0.15 s left feints it for 10.
- **The Kobold** (`hybrid` in its weapon attack): its first swing goes live 1.1 s after it starts, the next ones
  0.45 s (a heavy 0.35 s more), × its blade's heft; 0.5 s of recovery after a chain; it blocks walking up (from 0.3 s
  in), tap-parries 25% of a player's swings and kicks a player who has held a block 1 s, half the time.

Example: a sword light, then the reverse, then the reverse again: wind-ups 0.1, 0.045 and 0.04 s; damage 9, 11.25
and 13.5; momentum 2. A stab next deals 9 × 1.25 × 2 = 22.5 and spends it. Blocked held, that first light costs the
blocker 9 stamina and 1.8 HP.

## The Posture style

A fight in the Posture style plays by `POSTURE_MOVES` and `POSTURE` in `shared/src/weapons/posture.ts`; the rules in
`shared/src/battle/fight/styles/posture/`. Every time × the heft, damage × the weapon's × √(strength / 10),
posture × the attacker's heft. Poise isn't used by its swings: posture is.

| Attack | Wind-up | Live | Recovery | Damage | Posture a guard takes | Stamina |
|---|---|---|---|---|---|---|
| swing 1-3 | 0.3 (chained 0.25) | 0.1 | 0.3 | ×0.8 | 12 | 0 |
| swing 4 (finisher) | 0.45 | 0.12 | 0.45 | ×1.5 | 20 | 0 |
| perilous thrust | 0.6 | 0.1 | 0.5 | ×1.5 | 30 (unguardable) | 15 |
| perilous sweep | 0.55 | 0.12 | 0.5 | ×1.2, staggers 0.4 s | 20 (unguardable) | 15 |

- **Posture:** players 100, the Kobold Swordsman 100, the Kobold Greatsword 120, the boar 80, the Warlock 60 (`posture`
  on each enemy's def). From 1 s after it last grew it falls 20 a second × 1.5 guarding × (0.3 + 0.7 × HP share).
- **Guard** (held, 140° in front, idle): no HP lost, the posture above. A guarded body blow (the boar's lunge 30, the
  Warlock's poke 10; one with none, like the boar's charge, can't be guarded) pushes you back at 60% of its knockback.
- **Deflect:** the guard pressed at most `windowTime` 0.2 s (12 steps) before the hit lands, that step counting. You
  take a quarter of its posture; the attacker 15, +5 for each deflect of theirs in a row (each within 1 s of the last),
  at most +15 (25 for a body blow), and recoils 0.25 s. A press under 0.5 s after letting the guard go opens a window
  0.05 s (3 steps) shorter than the last, down to 0.067 s (4 steps); a deflect or a press 0.5 s after letting go gives
  the whole window back. A perilous thrust deflects only within 0.12 s; a sweep never.
- **A hit landed** gives the target half its posture. **Broken** (full): staggered 1.2 s (an enemy 1.5 s); the first
  weapon hit in it is a deathblow, 35% of the most HP (through defense), posture back to 0; untaken, it ends at half.
- **Mikiri:** a dodge toward a thrust's thrower (within 45°) that the thrust meets in its first 0.3 s: you stop unhurt;
  the thrower takes 45 posture and is opened 0.6 s. **Sweeps** miss anyone in the air; a left click in the air within
  1.5 m of someone sweeping kicks off them: 30 posture, staggered 0.3 s, no damage.
- **Zanshin:** the guard pressed within 0.15 s after your blade's live time ends, on a swing that hit or was guarded:
  15 off your posture and 0.1 s off its recovery.
- **The Kobold** (`posture` in its weapon attack): strings of 2-4 swings, the first winding up 0.6 s, the rest 0.4 s,
  25% of them 0.3 s later (its blade drawn as quick and held high); 30% of strings end in a perilous attack (a thrust
  45%, a sweep 30%, a grab 25%: 0.5 s, unguardable, 25 damage, 30 posture, staggered 0.6 s; a dodge beats it); 0.6 s
  of recovery, then its cooldown. Walking up it guards; it deflects 30% of your swings (20% of thrusts) and strikes at
  once, steps back from 30% of sweeps, and over 70% posture it backs off 2 m past its reach.

Example: the Kobold's three-swing string, each deflected: it takes 15, 20 and 25 (60 posture), you 3 each. Four of
your swings into its guard (12 each) before it recovers break it (108); your next light is a deathblow of
160 × 0.35 = 56 HP.

## The One Strike style

A fight in the One Strike style plays by `ONE_STRIKE` in `shared/src/weapons/one-strike.ts`; the rules in
`shared/src/battle/fight/styles/one-strike/`. Every time × the heft (a punch's × 1). A thrust's damage is a share of
the target's most HP, through `hurt` (defense, Warded and shields still count); strength, the weapon's damage stat,
Empowered and Cursed don't. Poise and stamina regen work as everywhere.

| Move | Wind-up | Live | Recovery | Reach (centre to their edge) | Stamina |
|---|---|---|---|---|---|
| line change (one line) | 0.1 | | | | 0 |
| thrust | 0.3 | 0.1, stepping in at 5 m/s | 0.5, or 0.35 if it landed | arm + blade + 0.3 m, 12° either side | 8 × heft |
| beat | 0.18 (then free at once) | | | the shorter of the two thrust reaches + 0.3 m, 45° | 15 × heft |
| punch (disarmed) | 0.15 | 0.08 | 0.3 | arm + 0.3 m, 30° either side | 0 |

- **Lines:** high, middle, low; a fight starts at the middle, high to low is two moves. Moving, knocked off line or
  lying loose, a blade holds no line; staggered or grabbed neither. It doesn't move while its own thrust or beat runs.
- **A thrust** at the line the target's blade holds, the target facing it (140°), clashes: both pushed apart at 4 m/s,
  the thruster recoils 0.25 s × heft, the target 0.15 s. At any other line it lands: a person's high (head) 100%,
  middle (body) 60%, low (legs) 20% and lamed for the rest of the fight (walking × 0.5, no dodge or jump); the boar's
  low (head) 100%, middle (back) 60%, high passes over. A landed thrust staggers 0.25 s (× 10 / toughness) unless the
  target's own blade is out, so two blades out at once both land (a double). A target closer than half the blade's
  length (centre to its edge) is inside the point: no hit.
- **The disarm:** a blade still moving toward the thrust's line as it lands, facing it, disarms the thruster: no hit,
  the thruster recoils 0.25 s, and its blade lands 3 m beyond it, away from the disarmer, at least 0.4 m inside the
  wall. With a 0.1 s move that's a press in the last 0.1 s before it lands (0.2 s for two lines); sooner, the blade is
  there in time and it clashes.
- **The beat:** lands 0.18 s after the press on the nearest foe within its reach whose blade holds your line: their
  blade off line 0.45 s (no thrust, no line change; a thrust or beat still winding up ends). Their line moved or out
  of reach, your own blade is off line 0.35 s.
- **Disarmed:** a punch deals 4 × √(strength / 10) and staggers 0.3 s (× 10 / toughness); standing within 0.6 m of
  your blade (centre to it) picks it up in 0.35 s, standing still. Nobody else can.
- **The boar:** its lunge comes on the low line (a low blade facing it clashes it: it recoils 0.4 s); charging onto a
  blade held low for 0.3 s by someone facing it (30°) and not dodging, it takes 100% of its most HP and the holder
  is pushed back about 1 m (7 m/s easing off over 0.3 s), unhurt. **The Warlock's** poke comes on the middle line and
  can be clashed, never disarmed; its body takes a person's zones.
- **The Kobold** (`oneStrike` in its weapon attack): thrusts wind up 0.4 s × heft; it reacts 0.3 s ± 0.08 after
  what it sees; it holds its measure, its thrust's reach + 0.2 m (± 0.15). Matched in reach, every 0.6-1.4 s it
  changes line (then thrusts once there, if you didn't follow) 40%, beats 30%, waits 30%; facing a mismatched blade
  in reach it thrusts. You changing line in reach: it follows 60%. You thrusting at another line: it tries the
  disarm 35% (only if it can be moving in time; it times the move for the last moment), steps back 40% (its
  sidestep, 0.3 s at 8 m/s). Disarmed, it walks to its blade.

Example: a sword thrust at the middle line of a Kobold holding high lands for 160 × 0.6 = 96 HP (its defense 10:
× 1). The same thrust at a player's low line takes 100 × 0.2 = 20 HP and lames them; at the Kobold's high, it
clashes.

## The Master Cuts style

A fight in the Master Cuts style plays by `BREAKS` and `MASTER_CUTS` in `shared/src/weapons/master-cuts.ts`; the rules
in `shared/src/battle/fight/styles/master-cuts/`. Every time × the heft; damage is the weapon's × the attack's factor
× √(strength / 10), through `hurt` (defense counts), as For Honor's; poise damage 12 a strike, 24 a master cut.

| Guard | Strike (left click) | Wind-up | Damage | Arc, reach | Master cut (right click) | Arc, reach | Breaks |
|---|---|---|---|---|---|---|---|
| Vom Tag (I) | Oberhau | 0.45 | × 1.2 | 160°, × 1 | Scheitelhau | 40°, × 1.3 | Alber |
| Ochs (U) | Oberstich | 0.3 | × 0.9 | 30°, × 1.25 | Schielhau | 60°, × 1.15 | Pflug |
| Pflug (O) | Unterstich | 0.3 | × 0.9 | 30°, × 1.25 | Zwerchhau | 140°, × 1 | Vom Tag |
| Alber (K) | Unterhau | 0.4 | × 1 | 140°, × 1 | Krumphau | 100°, × 1 | Ochs |

Reach is (arm + blade) × the factor, from the centre to the target's edge.

- **Strikes:** live 0.1 s, then 0.35 s of recovery; 10 stamina × heft. One started in the last one's recovery chains,
  three at most (then the next waits for the recovery); a chained one winds up × 0.85.
- **Master cuts:** wind-up 0.35 s, live 0.12 s, recovery 0.4 s, × 1.3 damage, 16 stamina × heft. No chains.
- **Guards:** a fight starts in Vom Tag. A change takes 0.25 s (0.15 s in an attack's recovery), 3 stamina, with no
  guard while it moves: no attack or counter until it's there (a press waits). Never while the blade is out.
- **The counter:** a hit landing at most 0.3 s after your master cut's press (that step too), you facing it (140°).
  From the guard that breaks the attacker's it displaces: their attack ends, they're open 0.6 s, your master cut goes
  on and its stamina is given back. From any other it binds: both attacks end, the attacker recoils 0.45 s and you
  0.3 s; your cut's stamina is given back and each pays 8. A master cut at the guard it breaks can't be countered.
  The boar's and Warlock's blows come from no guard: a counter binds them. No stamina: a click does nothing.
- **Fehler:** a guard change in a wind-up with more than 0.15 s left turns the attack into the new guard's (strike or
  cut), its wind-up left at least 0.2 s × heft, the guard there at once; 6 stamina, once per attack.
- **Ringen:** For Honor's guard break and its counter, unchanged.
- **The Kobold** (`masterCuts` in its weapon attack): its strikes and master cuts wind up 0.3 s longer than yours (a
  counter's doesn't); it holds a guard 1.5-3 s; 0.35 s after your guard settles it moves to the one that breaks it
  half the time. In reach: you in the guard its guard breaks, the master cut 60%; else strings of 2-3 strikes, each
  from a guard picked at random, each 20% turned by a Fehler 0.25 s before it lands; 0.6 s of recovery, then its 1.2 s
  cooldown. Your attack from the guard its guard breaks: it displaces 45%; from another: binds 30%; pressing 0.2 s
  before it lands. An idle player in reach: it wrestles 20%, and counters wrestling 30%.

Example: a sword's Oberhau deals 9 × 1.2 = 10.8 to a defense-10 target; the Kobold blade's Scheitelhau 14 × 1.3 = 18.2.

## Poise and stagger (enemies)

`enemyBrainSystem` (`fight/behaviors/brain.ts`), with `poise`, `poiseRegen` and `staggerTime` in each enemy's def.

- A hit takes its poise damage: a light 12, a heavy 24, an Earth skill 20 × the hit's share.
- Poise comes back at `poiseRegen` a second (not while staggered), up to `poise`.
- At 0 or less it's staggered for `staggerTime` × 10 / toughness and its poise refills; not while charging, stunned,
  recoiling or already staggered.
- Other stuns: a boar slamming the wall, `charge.stunTime` 2.2 s; 3 Lightning stacks, 1 s × 10 / toughness
  (`elements.lightning`).
- Enemies have no hurt invulnerability, and a hit doesn't stun them.

Example: a boar (36 poise, 8 a second, 1 s stagger) hit by a chain of sword lights 0.5 s apart: 36 − 3 × 12 + 8 × 1
= 8 after three, so the next staggers it; two heavies and a light (24 + 24) do it on the second.

## Stun and invulnerability (players)

`PLAYER` in `shared/src/battle/player.ts`; `combat.ts`.

- **Hitstun** (no control): a body blow (0.25 + 0.02 × knockback) × 10 / toughness; recoiling from a blocked attack
  0.3 s (light) or 0.5 s (heavy); parried or guard broken, the opening above (and none while held by a guard break,
  0.4 s at most). Toughness shortens only the body blow's: the counterplay's openings stay as they are.
  Weapon hits and skills give none.
- **Hurt invulnerability:** `hurtInvuln` 0.6 s after a weapon or body hit lands, against weapon and body hits.
- **Dodge i-frames:** from `dodge.iframeStart` 0 to `iframeEnd` 0.32 s of the 0.42 s dodge, weapon and body hits miss.
- Neither stops a skill: Bolts, Beams, Novas, clouds and burning hurt through them, and through a guard.
- **What breaks off a chant**, a cast's wind-up, writing a page or the bag: any hitstun (losing the chant's words), or
  a dodge (keeping them). An enemy's chant breaks when it's stunned, recoiling, staggered or killed (`cantCast` in
  `fight/skills/skilled.ts`). A weapon hit doesn't break a chant.

## Stamina

`PLAYER` and the player's controller (`fight/player/controller.ts`).

- The bar is 10 × the stamina stat (100). It refills at `staminaRegenPerSec` 45 × stamina recovery / 10 a second
  (× 1.5 while Charged), from `staminaRegenDelay` 0.6 s after an action ends: not while attacking, dodging, casting or
  recoiling, but while standing, walking, chanting, writing or in the bag. Empty to full: 0.6 + 100 / 45 = 2.8 s. It
  doesn't refill on the overworld.
- Any stamina above 0 starts an attack or a dodge; its cost may take the bar down to 0. A skill needs its whole cost
  to start, and pays it on release. A guard costs nothing.

| Action | Cost at strength 10 | Where |
|---|---|---|
| Light / heavy attack | 12 / 20 × heft: sword 12 / 20, longsword 14.4 / 24, greatsword 19.2 / 32 | `ATTACKS`, `attackCost` |
| A heavy that parries | nothing: its cost is given back | `parried` in `combat.ts` |
| Guard break | 10 | `GUARD_BREAK.cost` |
| Feint | 10, on top of the heavy's | `FEINT.cost` |
| Dodge | 22; heavy × 1.3 = 28.6; overloaded can't; Hasted × 0.7 | `PLAYER.dodge.cost`, `BURDEN.heavyDodgeCost` |
| Skill | its words' cost (below); a held Beam its own words × 2 a second | `skillCost`, `beam.heldCostFactor` |

The Goblin Warlock's bar works the same (100, 45 a second, paused while it winds up a cast).

## Movement

- **Arena walking:** `PLAYER.moveSpeed` 6 × (agility / 10)^¼ × burden pace (0.5 overloaded) × statuses (Rooted 0.4,
  Hasted 1.3) = 6 m/s; × 25% attacking, × 40% winding up a cast (`castMoveFactor`); accel 60 m/s²
  (25 in the air).
- **Dodge:** (12 + (3 − 12) × (t / 0.42)²) × (agility / 10)^¼ m/s for 0.42 s (`dodge.speed`, `endSpeed`,
  `duration`): about 3.8 m, where the walk keys point (backwards with none).
- **Jump:** `jumpSpeed` 8.5 m/s against `GRAVITY` 24 m/s²: 1.5 m high, 0.71 s up and down.
- **Enemies** (`approachSpeed`): `walkSpeed` × (agility / 10)^¼ × max(0, cos of the angle to the target) ×
  clamp(distance − 2.2, 0, 1) (or − its `keepAway.farM`); inside `keepAway.nearM` it backs off at that speed ×
  clamp(nearM − distance, 0, 1). Rooted slows them too.
- **Overworld:** the level's `playerSpeed` (5 tiles/s on the Grass Field) × burden pace × (agility / 10)^¼
  (`overworldPace`).

## Carry limit and burden

`CARRY_LIMIT_AT_AVERAGE` in `shared/src/battle/stats.ts`, `BURDEN` in `shared/src/items/burden.ts`.

- limit = 60 × (strength / 10)^¼ = 60; weight = the bag's and the equipment's items (the cloth weighs nothing).
- light up to the limit; heavy over it (a dodge × 1.3); overloaded over `overloadedAt` 1.2 × it, 72 (no dodging,
  walking × `overloadedPace` 0.5, in the arena and on the overworld).
- A new player carries 17: sword 3, longsword 4.5, greatsword 8, skillbook 1.5.

## Skills

`SKILL` and `skillCost` in `shared/src/skills/skill.ts`; `SKILL_EFFECTS` and `shotOf` in `shared/src/skills/effects.ts`;
`strike` in `fight/skills/strike.ts`. Examples at D = 10.

- **Cost:** (Σ over segments of form 3 + 2 per element + 1 per modifier) × `chainGrowth` 2^(segments − 1). Bolt Fire
  5; Bolt Fire Split Split 7; Bolt Fire, then Nova Lightning: (5 + 5) × 2 = 20.
- **Release time:** 0.3 + 0.1 × words (every form, element and modifier). Bolt Fire 0.5 s.
- **D** = `SKILL_EFFECTS.damage` 10 × √(skillpower / 10) × the caster's damage dealt (Empowered 1.2, Cursed 0.85).
- **A hit** = Σ over its elements share × D × factor × (1 − resist) (no enemy resists yet); with no element,
  0.6 D. factor = Amplify 1.5 per word × Split 0.9 per word × the form's share (a Beam tick 0.5, a cloud pulse 0.4,
  an Imbue hit 0.5). Statuses go on in full whatever the factor.

| Element | Share | Hit | Status |
|---|---|---|---|
| Fire | 0.8 | 8 | Burning 4 s: 0.25 D a second (10 in all); a new hit refreshes it |
| Water | 0.5 | 5 | Wet 6 s |
| Earth | 1.2 | 12, and 20 × factor poise | Rooted 2 s: moves × 0.4 |
| Air | 0.4 | 4, knocked at 12 × factor m/s | |
| Lightning | 1.0 | 10, and 5 to the nearest other foe within 5 m | Shocked 5 s; the 3rd stack stuns an enemy 1 s |
| Light | 0.5 | 5 | Marked 8 s |
| Darkness | 0.9 | 9; the caster heals 20% of it | Cursed 6 s: deals × 0.85 |

Reactions, on whoever a skill hits (players in duels too), each with a cooldown per target
(`SKILL_EFFECTS.reactions`), checked after the statuses go on:

| Reaction | When | What | Cooldown |
|---|---|---|---|
| Conduct | Lightning on Wet | Lightning × 1.5, arcing to 2 within 6 m at 50%; the Wet is used up | 3 s |
| Doused | Fire on Wet, or Water on Burning | both cleared | 2 s |
| Fanned | Air on Burning | the burn × 2, spread to the nearest other foe within 4 m | 4 s |
| Eclipse | Darkness on Marked | 1.5 D to every foe within 3 m of the target, itself too; the Mark used up, no Curse | 5 s |

Forms and modifiers:

- **Bolt:** 20 m/s (× 1.5 per Swift), 16 m, 0.3 m radius (× 0.8 per Split); n Splits make 2^n Bolts; Pierce goes
  through 2 more per word; Follow turns 3 rad/s per word.
- **Beam:** 10 m long, 0.35 m wide (× 1.5 per Widen); a tick of 0.5 on release and every 0.5 s (÷ 1.5 per Swift) for
  1 s (× 2 per Extend), so 3 ticks (1.5 hits) unheld; held, it lasts as long as it's held and paid, then its 1 s.
- **Nova:** everyone within 3 m (× 1.5 per Widen). With Extend it leaves a cloud for 8 s (× 2 per further Extend),
  pulsing 0.4 every second: 8 pulses, 3.2 hits.
- **Imbue:** the next 3 sword hits within 8 s (both × 2 per Extend) each strike 0.5 of a hit; Swift makes your
  attacks' wind-ups ÷ 1.5 while it lasts.
- **Delay:** the hand-off to the next segment waits 1 s per word.
- **Self:** Fire, Empowered 8 s (deals × 1.2); Water, heals 0.3 D and clears harmful statuses; Earth, Warded 6 s
  (takes × 0.7, no knockback); Air, Hasted 5 s (moves × 1.3, dodges × 0.7); Lightning, Charged 5 s (stamina refills
  × 1.5); Light, a shield of 1 D for 6 s; Darkness, Siphoning 8 s (heals 10% of the damage you deal). Extend × 2 the
  time, Amplify × 1.5 the heal and shield.

Example: the Goblin Warlock's Bolt Fire hits you for 8, then burns 10 over 4 s; split, two Bolts of 7.2 (the burn
doesn't stack).

**Chanting** costs no time but picking the words, then the release time. The warlock says a word every `wordTime`
0.45 s and releases after (words + 1) × 0.45 s: Bolt Fire takes 1.35 s, then 0.5 s to release. Within `quickCastM` 6 m
it quick-casts (0.5 s). Writing a page in a fight takes `SAVE_IN_FIGHT_TIME` 2 s.

## Damage taken

`hurt` and `damageDealtFactor` in `fight/skills/statuses.ts`.

- Dealt = damage × the attacker's Empowered 1.2 × Cursed 0.85 (weapon, body and skill hits alike).
- Taken = dealt × 50 / (40 + defense) for a weapon or body hit, × 50 / (40 + special defense) for a skill's (a burn
  too), × Warded 0.7, less what the Light shield absorbs, off HP (never below 0). Any damage stops HP regen for 5 s.
- Siphoning heals the attacker 10% of what was taken. A player with the dev cheat on takes nothing.

## Enemies

Each in `server/src/core/enemies/<id>.ts`.

| | Wild Boar | Kobold Swordsman | Kobold Greatsword | Goblin Warlock |
|---|---|---|---|---|
| HP | 160 | 160 | 160 | 40 |
| Poise, regen a second, stagger | 36, 8, 1 s | 40, 10, 0.8 s | 40, 10, 0.8 s | 20, 8, 1 s |
| Walk | 3.2 m/s | 2.6 m/s | 2.6 m/s | 2.4 m/s |
| Hits | bite 16, charge 30 | light 14, heavy 28 | light 14, heavy 28 (1.6 × as slow) | staff 5; Bolt Fire 8 + 10 burning |

- **Boar:** bites within 2.8 m (0.65 s wind-up), then can't again for 0.75 + 0.6 s; charges from 5-22 m (1.1 s wind-up,
  locking its aim 0.3 s before; 17 m/s for up to 1.6 s; no stagger while charging), first after 2 s, then 4.5 s after
  recovering or the wall's 2.2 s stun.
- **Kobolds:** a chain of 2 or 3 (even odds), each attack heavy 30% of the time; before each, its guard moves to one of
  the other two sides (0.3 s) and holds there, 0.5 s in all before the first and 0.35 s before the others, then it
  attacks from there at its weapon's timings, stepping in at 3 m/s while live; then 0.9 s to recover and 1.2 s more
  before the next chain; first after 1.5 s. On guard it changes side every 1.5-3 s. Its counters, each rolled from
  the fight's seed: a player's heavy winding up at it within its attack reach is parried 35% of the time (rolled as the
  heavy starts; it presses its own heavy 0.2 s before yours would land, so a feint after that baits it); 25% of its
  heavies are feints (at the cutoff); 25% of the times it would attack an idle player within guard break reach, it
  guard breaks instead; 30% of guard breaks on it are countered, 0.25 s in. Having opened you (a parry or a guard
  break), it strikes a light at once. A Bolt aimed within about 26° of it is
  side-stepped 60% of the time (8 m/s for 0.3 s: 2.4 m), at max(0.25 s, release time − 0.1 s) into its wind-up.
- **Goblin Warlock:** keeps 4-7 m away; pokes within 1.6 m (0.4 s wind-up, then 0.5 + 0.8 s before the next); casts
  within 14 m once its last cast's effects are gone and 1.2 s more have passed: Bolt Fire, adding Follow 1 time in 3 and
  Split 1 in 4, each rolled on its own.

## Encounters and drops

- **Tall grass** (`grass` in each level's file in `server/src/core/world/floors/1/`, rolled in
  `server/src/core/overworld/player.ts`): every `stepDist` 1 tile walked in it, a `chance` roll (0.12 on the Grass
  Field and in the Mistwood, 0.06 in the Waking Hollow); the enemy by weight (only boars so far). At 0.12, on average
  one every 8.3 tiles (1.7 s at 5 tiles/s), and 0.88^10 = 28% of the time 10 tiles pass without one; at 0.06, one
  every 16.7 tiles (3.3 s). None for `safeTime` 2 s after a fight.
- **Overworld enemies** come back `respawnTime` after their fight is over: the boar 8 s, the others 12 s.
- **Drops** (`rollDrops`): each row rolled on its own, once per fallen enemy for the whole fight (the winners share
  it). Every enemy drops its own essence, always (chance 1). A boar, besides: meat 0.6, hide 0.35, tusk 0.25, so
  none of those 0.4 × 0.65 × 0.75 = 19.5% of the time, and 2.25 weight on average. The Kobolds and the warlock drop
  only their essence.

## Healing and refills

- **Boar meat:** + 35% of the most HP (its `consumable`'s `healShare`; 35 at the start), once its `useTime` (1 s) is
  up, on the overworld or in a fight; refused at full HP.
- **HP regen:** vitality × health regen / 200 HP a second (0.5 at the start: empty to full in 200 s), on the
  overworld, in fights and in the arena after a win; in a fight, not for 5 s after any damage (`HP_REGEN_PAUSE_TIME`).
  Players only: enemies' health regen is 0.
- **Campfire:** within `REST_RANGE_TILES` 1.6 (+ `LAG_SLACK_TILES` 0.6 on the server): HP and stamina to full.
- **After a fight:** won, what it left you, at least 1 HP; lost, full HP and stamina (by the core after the death) at
  the level's start; a duel gives back what you came in with.
- **In a fight:** meat (above), and skills: Self Water 0.3 D, Darkness 20% of its hit, Siphoning 10% of the
  damage you deal.
