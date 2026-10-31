# Formulas

Every calculation that decides how the game plays, as the code does it today: the formula, what each term is, where
its numbers live, and a worked example at the default stats (strength, agility and skillpower 10, a stamina bar of
100: everyone has these for now). Units: seconds, metres and m/s in the arena, tiles and tiles/s on the overworld; HP,
stamina, poise and item weight have none. A fight runs in steps of 1/60 s (`FIXED_DT`), so its times round to those.
The other knobs (looks, camera, netcode) are in ARCHITECTURE.md's
[Where to tune things](ARCHITECTURE.md#where-to-tune-things).

Keep it current: a PR that changes a calculation or its numbers changes it here too.

- [Stats](#stats)
- [Weapon attacks](#weapon-attacks)
- [Body blows](#body-blows)
- [Guards](#guards)
- [Parries, guard breaks and feints](#parries-guard-breaks-and-feints)
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

`Stats` and its formulas are in `shared/src/battle/stats.ts`; the player's numbers are `PLAYER_STATS`
(`server/src/core/content/player.ts`), an enemy's are in its file in `server/src/core/enemies/`. They count only in
fights, apart from strength's carry limit. HP isn't a stat.

| Stat | Player | Formula | Where |
|---|---|---|---|
| stamina | 100 | the stamina bar's size | `Stamina.max` from the setup |
| strength | 10 | a body blow's damage = base × strength / 10; a weapon's goes by its fourth root (below) | `physicalDamage`, `attackDamage` |
| agility | 10 | arena walking speed = base × agility / 10 | `moveSpeed` |
| skillpower | 10 | a skill's base damage D = 10 × skillpower / 10 | `skillDamage`, `SKILL_EFFECTS.damage` |

Enemies have 100 / 0 / 10 / 10 (stamina, skillpower, agility, strength), but the Goblin Warlock's skillpower is 10.
Only an enemy that casts (the warlock) has a stamina bar.

HP: the player's `PLAYER.maxHp` is 100; an enemy's is its `maxHp`. HP and stamina carry from one fight to the next
(`Vitals`).

## Weapon attacks

All of it is `ATTACKS`, `COMBAT`, `attackSteps`, `attackDamage` and `attackCost` in `shared/src/weapons/weapons.ts`,
with each weapon's numbers in `WEAPONS`. Nothing varies with how an attack is reached: the same attack with the same
weapon always takes the same time and deals the same damage.

| Term | Formula | Notes |
|---|---|---|
| wind-up | `landTime` × heft (a chain's 2nd and 3rd: `chainLandTime` × heft), ÷ an Air Imbue's swift factor | from the press to the blade going live; drawn back for the first 60% (`drawShare`), driven for the rest |
| live | `liveTime` × heft | the hitbox is up |
| recovery | `recoverTime` × heft | walking at 25% (`moveFactor`); the next attack in the chain can start in it |
| damage | the weapon's `damage` × `damageFactor` × (strength / 10)^¼ | light 1, heavy 2 |
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

Strength: a sword light at strength 20 deals 9 × 2^¼ = 10.7; strength doesn't change times or costs.

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

An enemy's lunge or charge (`addHitAhead`): damage = its `damage` × strength / 10. Landing on a player who isn't
blocking, it knocks them back at its `knockback` m/s (plus `lift` up; not while Warded) and takes control away
(hitstun) for `HITSTUN_TIME` 0.25 + `HITSTUN_PER_KNOCKBACK` 0.02 × knockback (`combat.ts`). A weapon's hit only
hurts: no knockback, no hitstun.

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

## Poise and stagger (enemies)

`enemyBrainSystem` (`fight/behaviors/brain.ts`), with `poise`, `poiseRegen` and `staggerTime` in each enemy's def.

- A hit takes its poise damage: a light 12, a heavy 24, an Earth skill 20 × the hit's share.
- Poise comes back at `poiseRegen` a second (not while staggered), up to `poise`.
- At 0 or less it's staggered for `staggerTime` and its poise refills; not while charging, stunned, recoiling or
  already staggered.
- Other stuns: a boar slamming the wall, `charge.stunTime` 2.2 s; 3 Lightning stacks, 1 s (`elements.lightning`).
- Enemies have no hurt invulnerability, and a hit doesn't stun them.

Example: a boar (36 poise, 8 a second, 1 s stagger) hit by a chain of sword lights 0.5 s apart: 36 − 3 × 12 + 8 × 1
= 8 after three, so the next staggers it; two heavies and a light (24 + 24) do it on the second.

## Stun and invulnerability (players)

`PLAYER` in `shared/src/battle/player.ts`; `combat.ts`.

- **Hitstun** (no control): a body blow 0.25 + 0.02 × knockback; recoiling from a blocked attack 0.3 s (light) or
  0.5 s (heavy); parried or guard broken, the opening above (and none while held by a guard break, 0.4 s at most).
  Weapon hits and skills give none.
- **Hurt invulnerability:** `hurtInvuln` 0.6 s after a weapon or body hit lands, against weapon and body hits.
- **Dodge i-frames:** from `dodge.iframeStart` 0 to `iframeEnd` 0.32 s of the 0.42 s dodge, weapon and body hits miss.
- Neither stops a skill: Bolts, Beams, Novas, clouds and burning hurt through them, and through a guard.
- **What breaks off a chant**, a cast's wind-up, writing a page or the bag: any hitstun (losing the chant's words), or
  a dodge (keeping them). An enemy's chant breaks when it's stunned, recoiling, staggered or killed (`cantCast` in
  `fight/skills/skilled.ts`). A weapon hit doesn't break a chant.

## Stamina

`PLAYER` and the player's controller (`fight/player/controller.ts`).

- The bar is the stamina stat (100). It refills at `staminaRegenPerSec` 45 a second (× 1.5 while Charged), from
  `staminaRegenDelay` 0.6 s after an action ends: not while attacking, dodging, casting or recoiling, but
  while standing, walking, chanting, writing or in the bag. Empty to full: 0.6 + 100 / 45 = 2.8 s. It doesn't refill on
  the overworld.
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

- **Arena walking:** `PLAYER.moveSpeed` 6 × agility / 10 × burden pace (0.5 overloaded) × statuses (Rooted 0.4,
  Hasted 1.3) = 6 m/s; × 25% attacking, × 40% winding up a cast (`castMoveFactor`); accel 60 m/s²
  (25 in the air).
- **Dodge:** 12 + (3 − 12) × (t / 0.42)² m/s for 0.42 s (`dodge.speed`, `endSpeed`, `duration`): about 3.8 m, where
  the walk keys point (backwards with none).
- **Jump:** `jumpSpeed` 8.5 m/s against `GRAVITY` 24 m/s²: 1.5 m high, 0.71 s up and down.
- **Enemies** (`approachSpeed`): `walkSpeed` × agility / 10 × max(0, cos of the angle to the target) ×
  clamp(distance − 2.2, 0, 1) (or − its `keepAway.farM`); inside `keepAway.nearM` it backs off at that speed ×
  clamp(nearM − distance, 0, 1). Rooted slows them too.
- **Overworld:** the level's `playerSpeed` (5 tiles/s on the Grass Field) × burden pace; agility doesn't count.

## Carry limit and burden

`CARRY` in `shared/src/battle/stats.ts`, `BURDEN` in `shared/src/items/burden.ts`.

- limit = `CARRY.base` 30 + `perStrength` 3 × strength = 60; weight = the bag's and the equipment's items (the cloth
  weighs nothing).
- light up to the limit; heavy over it (a dodge × 1.3); overloaded over `overloadedAt` 1.2 × it, 72 (no dodging,
  walking × `overloadedPace` 0.5, in the arena and on the overworld).
- A new player carries 17: sword 3, longsword 4.5, greatsword 8, skillbook 1.5.

## Skills

`SKILL` and `skillCost` in `shared/src/skills/skill.ts`; `SKILL_EFFECTS` and `shotOf` in `shared/src/skills/effects.ts`;
`strike` in `fight/skills/strike.ts`. Examples at D = 10.

- **Cost:** (Σ over segments of form 3 + 2 per element + 1 per modifier) × `chainGrowth` 2^(segments − 1). Bolt Fire
  5; Bolt Fire Split Split 7; Bolt Fire, then Nova Lightning: (5 + 5) × 2 = 20.
- **Release time:** 0.3 + 0.1 × words (every form, element and modifier). Bolt Fire 0.5 s.
- **D** = `SKILL_EFFECTS.damage` 10 × skillpower / 10 × the caster's damage dealt (Empowered 1.2, Cursed 0.85).
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
- Taken = dealt × Warded 0.7, less what the Light shield absorbs, off HP (never below 0).
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

- **Tall grass** (`grass` in `server/src/core/world/floors/1/grass-field.ts`, rolled in
  `server/src/core/overworld/player.ts`): every `stepDist` 1 tile walked in it, a `chance` 0.12 roll; the enemy by
  weight (only boars on the Grass Field). On average one every 8.3 tiles (1.7 s at 5 tiles/s); 0.88^10 = 28% of the
  time, 10 tiles pass without one. None for `safeTime` 2 s after a fight.
- **Overworld enemies** come back `respawnTime` after their fight is over: the boar 8 s, the others 12 s.
- **Drops** (`rollDrops`): each row rolled on its own, once per fallen enemy for the whole fight (the winners share
  it). A boar: meat 0.6, hide 0.35, tusk 0.25, so nothing 0.4 × 0.65 × 0.75 = 19.5% of the time, and 2.25 weight on
  average. The Kobolds and the warlock drop nothing.

## Healing and refills

- **Boar meat:** +35 HP (its `consumable`'s `healHp`), up to 100, once its `useTime` (1 s) is up, on the overworld
  or in a fight; refused at full HP.
- **Campfire:** within `REST_RANGE_TILES` 1.6 (+ `LAG_SLACK_TILES` 0.6 on the server): HP and stamina to full (100,
  and the stamina stat).
- **After a fight:** won, what it left you, at least 1 HP; lost, full HP and stamina at the level's start; a duel
  gives back what you came in with.
- **In a fight:** meat (above), and skills: Self Water 0.3 D, Darkness 20% of its hit, Siphoning 10% of the
  damage you deal.
