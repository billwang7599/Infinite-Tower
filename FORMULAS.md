# Formulas

Every calculation that decides how the game plays, as the code does it today: the formula, what each term is, where
its numbers live, and a worked example at the default stats (strength, agility and skillpower 10, a stamina bar of
100: everyone has these for now). Units: seconds, metres and m/s in the arena, tiles and tiles/s on the overworld; HP,
stamina, poise and item weight have none. A fight runs in steps of 1/60 s (`FIXED_DT`), so its times round to those.
The other knobs (looks, camera, netcode) are in ARCHITECTURE.md's
[Where to tune things](ARCHITECTURE.md#where-to-tune-things).

Keep it current: a PR that changes a calculation or its numbers changes it here too.

- [Stats](#stats)
- [Weapon swings](#weapon-swings)
- [Body blows](#body-blows)
- [Blocking](#blocking)
- [Parries](#parries)
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
| strength | 10 | a body blow's damage = base × strength / 10; a weapon's swing goes by its fourth root (below) | `physicalDamage`, `planSwing` |
| agility | 10 | arena walking speed = base × agility / 10 | `moveSpeed` |
| skillpower | 10 | a skill's base damage D = 10 × skillpower / 10 | `skillDamage`, `SKILL_EFFECTS.damage` |

Enemies have 100 / 0 / 10 / 10 (stamina, skillpower, agility, strength), but the Goblin Warlock's skillpower is 10.
Only an enemy that casts (the warlock) has a stamina bar.

HP: the player's `PLAYER.maxHp` is 100; an enemy's is its `maxHp`. HP and stamina carry from one fight to the next
(`Vitals`).

## Weapon swings

All of it is `planSwing` and `SWING` in `shared/src/weapons/weapons.ts`, with each weapon's numbers in `WEAPONS` (its
mass is its item's `weight` in `shared/src/items/items.ts`). Every ratio is against the starter sword (m0 = 3,
I0 = 0.49) at strength 10.

| Term | Formula | What it is |
|---|---|---|
| I | m × (b² + L² / 12) | moment of inertia: m mass, b `balanceM` (hand to centre of mass, m), L `length` (m) |
| k | clamp(√((I / I0) / (strength / 10)), 0.5, 3) | time factor: every time of the swing is × k (`minTimeFactor`, `maxTimeFactor`) |
| s | (strength / 10)^¼ / √(m / m0) | impact speed per unit of flow |
| u | the blade's speed along the new swing's way | in shares of the from-rest impact speed |
| flow | max(u, min(1.25, √(u² + 1))) | the drive's end speed (`maxFlow` 1.25): 1 from rest |
| momentum p | (m / m0) × s × flow = √(m / m0) × (strength / 10)^¼ × flow | |
| damage | power × p; a stab × 1.25 | power is the weapon's `damage`; `PLAYER.stab.damageFactor` |
| poise damage | 12 × p; a stab 18 × p | `PLAYER.swing.poiseDamage`, `PLAYER.stab.poiseDamage` |
| effort | (I / I0) × s² × lacking² × (1 + 0.5 × braked²) | lacking = max(1, unclamped k / k), only past the 3× clamp; braked: blade speed stopped (`brakeEffort` 0.5) |
| stamina | 16 × effort; a stab 20 × effort | `PLAYER.swing.cost`, `PLAYER.stab.cost` |

The blade is a point in the screen plane (±1 a swing's ends, 0 the guard) with a velocity. The next swing takes the
quicker of two ways; a stab has one:

- **Stop:** brake (speed × 0.2) and set it to the swing's start (`setTime` 0.15 × √distance), then drive from rest:
  flow 1, braked = the speed it had.
- **Loop** (only with some speed u already on the new way): turn the sideways part (sideways × 0.2), loop round
  (`loopTime` 0.1 / u), then drive from u: braked = the sideways speed.
- **Stab:** brake (braked = the speed it had), set back to the guard (0.15 × √distance), draw back (`stabDrawTime`
  0.2), then drive from rest.
- Drive = `driveTime` 0.2 / (u + flow). Wind-up = (prep + drive) × k; live `activeTime` 0.1 × k; follow-through
  flow × 0.2 × k. A swing lets go after its wind-up and live time; a dodge or the next attack waits for that.
- After letting go the blade moves its way at its flow, slowing evenly to 0 by the end of the follow-through, so an
  attack started earlier carries more of it, and one left to run its course stops at its far end. A swing ended before
  it lets go rests the blade at the guard; one cut off mid-follow-through (an enemy staggered or stunned, a player
  knocked into hitstun) keeps its speed for `gapTime` 0.25 s, then stops where it is. A block, a dodge, a chant, a cast
  or the bag puts the blade at rest at the guard, as does a hit taken between swings (a weapon hit mid-swing lets the
  swing go on); a blocked or parried blade stops dead where it met.

The starter sword at strength 10 (every row but the first follows an `lr` swing):

| Next | Wind-up (s) | Flow | Damage | Poise | Stamina |
|---|---|---|---|---|---|
| Any swing from the guard (an opening) | 0.35 | 1 | 9 | 12 | 16 |
| `lr` again, as the last lets go | 0.19 | 1.25 | 11.25 | 15 | 16 |
| 45° off it (`tlbr`), as the last lets go | 0.39 | 1.22 | 11.0 | 14.7 | 20 |
| Reverse (`rl`), as the last lets go | 0.40 | 1 | 9 | 12 | 24 |
| Across (`tb`), as the last lets go | 0.58 | 1 | 9 | 12 | 24 |
| `rl` / `lr`, blade stopped at the far side | 0.20 / 0.41 | 1 | 9 | 12 | 16 |
| Stab from the guard / a stopped far side / as a swing lets go | 0.40 / 0.55 / 0.75 | 1 | 11.25 | 18 | 20 / 20 / 30 |

By weapon, an opening at strength 10:

| Weapon | m | b | L | Power | I / I0 | k | Wind-up | Damage | Stamina |
|---|---|---|---|---|---|---|---|---|---|
| Sword | 3 | 0.25 | 1.1 | 9 | 1 | 1 | 0.35 | 9 | 16 |
| Longsword | 4.5 | 0.3 | 1.4 | 11 | 2.33 | 1.53 | 0.53 | 13.5 | 24.8 |
| Greatsword | 8 | 0.45 | 1.9 | 16 | 8.22 | 2.87 | 1.00 | 26.1 | 49.3 |
| Kobold blade | 3 | 0.25 | 1.1 | 14 | 1 | 1 | 0.35 | 14 | none |
| Kobold greatsword | 8 | 0.45 | 1.9 | 14 | 8.22 | 2.87 | 1.00 | 22.9 | none |

Strength: the sword's opening at strength 20 has k = 0.71 (0.25 s), damage 9 × 2^¼ = 10.7 and costs 16 × √2 = 22.6.
From strength 40 its times stop shrinking (k = 0.5), while its damage and cost still grow.

**Reach** (`attackShape`): (arm reach + L) × the line's factor, to the target's surface; arcs by angle to its centre
(any angle within 0.3 m). Arm reach is `PLAYER.armReachM` 0.8 (an enemy's `wielder.armReachM`, also 0.8).

| Line | Reach factor | Arc | The sword (1.9 m) |
|---|---|---|---|
| Horizontal (`lr`, `rl`) | 1 | 160° | 1.9 m |
| Diagonal | 1.15 | 110° | 2.19 m |
| Vertical (`tb`, `bt`) | 1.3 | 60° | 2.47 m |
| Stab | 1.75 (`STAB_REACH_FACTOR`) | a ray 0.15 m either side (`STAB_WIDTH`) | 3.33 m |

While a swing's blade is live it carries you forward at `lungeSpeed` 4 m/s; otherwise you walk at 25%
(`swing.moveFactor`) while swinging.

An enemy's swing is planned the same way with its strength, but its wind-up is max(its telegraph, the plan's), its
live time its `active` × k, it deals no poise damage and costs no stamina (`fight/behaviors/weapon.ts`).

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

## Blocking

`PLAYER.block`, applied in `hitPlayer` (`shared/src/battle/fight/combat.ts`). Held, it stops a hit from within 70° of
the aim (`minDot` 0.34, cos 70°):

- stamina cost = the hit's momentum × `staminaPerMomentum` 14 (a weapon), or its damage × `staminaPerDamage` 1 (a
  body blow);
- a blocked swing still deals `chipFraction` 0.2 of its damage; a stab or a body blow none;
- you're pushed back at the hit's knockback × `pushbackFactor` 0.6 m/s;
- short of the cost, the bar empties and the guard breaks: staggered `guardBreakTime` 0.8 s;
- you walk at 40% (`moveFactor`) while blocking.

Example: a Kobold's opening (momentum 1, 14 damage) costs 14 stamina and 2.8 HP, pushing you at 3 m/s; the Kobold
Greatsword's (1.63, 22.9) costs 22.9 and 4.6 HP; a boar's charge costs 30 and no HP, pushing you at 9 m/s.

## Parries

`PARRY`, `parryShare` and `guardShare` in `weapons.ts`; `stunFor` and `combatSystem` in `combat.ts`.

- **When:** your swing went live no more than `window` 0.15 s before their hit lands, with them within 60° of your
  swing's direction (`minDot` 0.5). Hurt invulnerability doesn't stop a parry.
- **Share by angle:** your swing the reverse of theirs 1; 45° off the reverse `offAngleShare` 0.5; anything else 0. A
  stab parries only a stab (1).
- **An enemy parried:** stunned `stunTime` 1 × share × clamp(your momentum / its momentum, 0.5, 2); knocked back
  to slide `knockbackDist` 1.5 × share m (at √(2 × `slideDecel` 30 × 1.5 × share) m/s); its next attack waits the
  stun plus its cooldown; while stunned, your hits deal × `bonusDamage` 1.5 and no poise damage.
- **A player parried** (by a guarding Kobold, or a duelist): staggered `playerStaggerTime` 0.5 × share ×
  clamp(parrier's momentum / yours, 0.5, 2), knocked back at `playerKnockbackSpeed` 6 × share m/s, no extra damage. A
  guarding Kobold counts its blade's opening momentum.
- **A Kobold on guard** (facing you within 60°) parries a swing coming at the side it guards (share 1) or one 45° off
  (0.5), from 0.3 s after it's back on guard (`parryReaction`), at most once per 1.5 s (`parryCooldown`); it always
  blocks a stab. Its guarded side holds 1.5-3 s and takes 0.3 s to move (`GUARD`).

Example: your opening sword swing (1) parries a Kobold's opening (1) head-on: 1 s stun, 1.5 m back, then your openings
hit it for 13.5. Its chained 45° swing (1.22): 0.82 s. Your greatsword (1.63): 1.63 s. A sword opening into a guarding
Kobold Greatsword (its 1.63 against your 1): you're staggered 0.82 s.

## Poise and stagger (enemies)

`enemyBrainSystem` (`fight/behaviors/brain.ts`), with `poise`, `poiseRegen` and `staggerTime` in each enemy's def.

- A hit takes its poise damage: a swing 12 × momentum, a stab 18 × momentum, an Earth skill 20 × the hit's share. A
  weapon hit on a parried enemy takes none.
- Poise comes back at `poiseRegen` a second (not while staggered), up to `poise`.
- At 0 or less it's staggered for `staggerTime` and its poise refills; not while charging, stunned, parried or already
  staggered.
- Other stuns: a boar slamming the wall, `charge.stunTime` 2.2 s; 3 Lightning stacks, 1 s (`elements.lightning`).
- Enemies have no hurt invulnerability, and a hit doesn't stun them.

Example: a boar (36 poise, 8 a second, 1 s stagger) hit by sword openings 0.4 s apart: 36 − 3 × 12 + 8 × 0.8 = 6.4
after three, so the fourth staggers it. An opening and two looped swings (12 + 15 + 15, about 0.29 s apart) do it on
the third.

## Stun and invulnerability (players)

`PLAYER` in `shared/src/battle/player.ts`; `combat.ts`.

- **Hitstun** (no control): a body blow 0.25 + 0.02 × knockback; a broken guard 0.8 s; parried 0.5 × share × the
  momentum ratio. Weapon hits and skills give none.
- **Hurt invulnerability:** `hurtInvuln` 0.6 s after a weapon or body hit lands, against weapon and body hits.
- **Dodge i-frames:** from `dodge.iframeStart` 0 to `iframeEnd` 0.32 s of the 0.42 s dodge, weapon and body hits miss.
- Neither stops a skill: Bolts, Beams, Novas, clouds and burning hurt through them, and through a block.
- **What breaks off a chant**, a cast's wind-up, writing a page or the bag: any hitstun (losing the chant's words), or
  a dodge (keeping them). An enemy's chant breaks when it's stunned, parried, staggered or killed (`cantCast` in
  `fight/skills/skilled.ts`). A weapon hit doesn't break a chant.

## Stamina

`PLAYER` and the player's controller (`fight/player/controller.ts`).

- The bar is the stamina stat (100). It refills at `staminaRegenPerSec` 45 a second (× 1.5 while Charged), from
  `staminaRegenDelay` 0.6 s after an action ends: not while swinging, blocking, dodging, casting or staggered, but
  while standing, walking, chanting, writing or in the bag. Empty to full: 0.6 + 100 / 45 = 2.8 s. It doesn't refill on
  the overworld.
- Any stamina above 0 starts a swing, stab or dodge; its cost may take the bar down to 0. A skill needs its whole cost
  to start, and pays it on release. A block needs none to start.

| Action | Cost at strength 10 | Where |
|---|---|---|
| Swing | 16 × effort: sword 16-24, longsword 24.8-37.2, greatsword 49.3-74 | `PLAYER.swing.cost`, `planSwing` |
| Stab | 20 × effort: sword 20, or 30 braking a moving blade | `PLAYER.stab.cost` |
| Dodge | 22; heavy × 1.3 = 28.6; overloaded can't; Hasted × 0.7 | `PLAYER.dodge.cost`, `BURDEN.heavyDodgeCost` |
| Block | the hit's momentum × 14, or a body blow's damage | `PLAYER.block` |
| Skill | its words' cost (below); a held Beam its own words × 2 a second | `skillCost`, `beam.heldCostFactor` |

The Goblin Warlock's bar works the same (100, 45 a second, paused while it winds up a cast).

## Movement

- **Arena walking:** `PLAYER.moveSpeed` 6 × agility / 10 × burden pace (0.5 overloaded) × statuses (Rooted 0.4,
  Hasted 1.3) = 6 m/s; × 25% swinging, × 40% blocking, × 40% winding up a cast (`castMoveFactor`); accel 60 m/s²
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
  swings' wind-ups ÷ 1.5 while it lasts.
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
| Hits | bite 16, charge 30 | 14 × momentum: 14 opening, up to 17.1 chained | 14 × momentum: 22.9 opening, up to 28 chained | staff 5; Bolt Fire 8 + 10 burning |

- **Boar:** bites within 2.8 m (0.65 s wind-up), then can't again for 0.75 + 0.6 s; charges from 5-22 m (1.1 s wind-up,
  locking its aim 0.3 s before; 17 m/s for up to 1.6 s; no stagger while charging), first after 2 s, then 4.5 s after
  recovering or the wall's 2.2 s stun.
- **Kobolds:** a chain of 2 or 3 (even odds) of random moves, never the same twice running; a 1.1 s telegraph before the
  first, 0.45 s before the others (or the blade's own wind-up if longer); live 0.12 × k s, stepping in at 3 m/s; then
  0.9 s to recover and 1.2 s more before the next chain; first after 1.5 s. A Bolt aimed within about 26° of it is
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
- **Drops** (`rollDrops`): each row rolled on its own, for each winner. A boar: meat 0.6, hide 0.35, tusk 0.25, so
  nothing 0.4 × 0.65 × 0.75 = 19.5% of the time, and 2.25 weight on average. The Kobolds and the warlock drop nothing.

## Healing and refills

- **Boar meat:** +35 HP (`healHp`), up to 100; on the overworld only, refused at full HP.
- **Campfire:** within `REST_RANGE_TILES` 1.6 (+ `LAG_SLACK_TILES` 0.6 on the server): HP and stamina to full (100,
  and the stamina stat).
- **After a fight:** won, what it left you, at least 1 HP; lost, full HP and stamina at the level's start; a duel
  gives back what you came in with.
- **In a fight:** only skills heal: Self Water 0.3 D, Darkness 20% of its hit, Siphoning 10% of the damage you deal.
