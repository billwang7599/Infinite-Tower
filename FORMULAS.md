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
- [Blocks](#blocks)
- [Swing parries](#swing-parries)
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
| stamina | 10 | the stamina bar = 15 × stamina | `staminaMaxOf` |
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
hidden ones 11, 2 points free; the most HP 110, the stamina bar 165, HP 10 more than before and stamina 15 more.

## Weapon attacks

`CHAIN`, `MOMENTUM`, `HYBRID`, `wayStepsAfter`, `strikeDamage` and `strikeCost` in `shared/src/weapons/hybrid.ts`, with
each weapon's numbers in `WEAPONS` (`weapons.ts`); the rules in `fight/player/sword.ts` and `fight/weapons/`. Damage
goes × √(strength / 10), and every time and stamina cost × the heft the wielder feels (`feltHeft`): 1 + (heft − 1) ×
10 / strength. Strength 10 feels a weapon's heft as it is, 20 half the extra, 5 twice it; a sword (heft 1) feels the
same to everyone. Below a weapon's `minStrength` it can't be wielded at all (sword 0, longsword 6, greatsword 9; the
Kobolds' blades as theirs).

- **Wind-up** (press to the blade going live): a light `CHAIN.startupTime` by how it follows the last swing (an
  opening or after a stab 0.35 s, the reverse 0.25 s, another line 0.3 s, a perpendicular one 0.45 s) ×
  (1 − 0.1 × momentum, momentum at most 4), never under `minStartupTime` 0.25 s, ÷ an Air Imbue's swift factor; a
  heavy the same + 0.35 s; a stab 0.3 s. A swing down from the top has no reverse.
  Drawn back for the first 60%, driven for the rest. Live 0.1 s (a heavy 0.12 s), then recovering 0.08 s (a heavy
  0.2 s). It chains if it starts during the last attack or within `gapTime` 0.25 s of its end.
- **Momentum:** each chained swing adds `MOMENTUM.gain` (the reverse 1, another line 0.5, a perpendicular 0.25), at
  most 4, and is lost on a gap, a dodge, a block, a cast, the chant, the bag, a hit taken or being blocked perfectly.
- **Damage:** a swing the weapon's damage × (1 + 0.25 × momentum, ×2 at most), a heavy ×2 more; a stab × 1.25 ×
  (1 + 0.5 × momentum) and spends it. **Stamina:** a light 10, a heavy 16, a stab 12 (× heft). **Poise:** 12, 24, 18.
- **Reach** (`wayShape`): (arm reach + blade) × 1.15 for every swing (2.19 m with the sword), its arc by line: 160°
  across, 110° on a diagonal, 60° down from the top; × 1.75 for a stab (16°), to the target's surface; arcs by angle
  to its centre (any angle within 0.3 m). Arm reach is `PLAYER.armReachM` 0.8 (an enemy's `wielder.armReachM`, also
  0.8).
- While an attack's blade is live it carries you forward at `HYBRID.swinging.lungeSpeed` 4 m/s; otherwise you walk at
  25% (`moveFactor`) while attacking.

By weapon, at strength 10, an opening swing (light / heavy; times in seconds):

| Weapon | Heft | Damage | Wind-up | Stamina (light / heavy / stab) |
|---|---|---|---|---|
| Sword | 1 | 9 / 18 | 0.35 / 0.7 | 10 / 16 / 12 |
| Longsword | 1.2 | 11 / 22 | 0.42 / 0.84 | 12 / 19.2 / 14.4 |
| Greatsword | 1.6 | 16 / 32 | 0.56 / 1.12 | 16 / 25.6 / 19.2 |
| Kobold blade | 1 | 14 / 28 | (its own, below) | none |
| Kobold greatsword | 1.6 | 14 / 28 | (its own, below) | none |

Example: a greatsword (heft 1.6) feels 1.3 at strength 20, 1.6 at 10 and 2.2 at 5: an opening light winds up 0.46,
0.56 or 0.77 s and costs 13, 16 or 22 stamina.

An enemy's swing deals the same damage and costs no stamina. **The Kobold** (its weapon
attack, `server/src/core/enemies/kobold-swordsman.ts`): its first swing goes live 1.1 s after it starts, the next ones
0.45 s (a heavy 0.35 s more), × its blade's heft; 0.5 s of recovery after a chain; it blocks walking up (from 0.3 s
in), and perfect-blocks 30% of the swings a player starts at it while walking up (`perfectBlockChance`). It feints 20%
of its heavies (`heavyFeintShare`): 0.15 s before the blade would go live it pulls back into its block, ends the
chain and waits its 1.2 s cooldown.

Example: a sword light, then the reverse, then the reverse again: wind-ups 0.35, 0.25 and 0.25 s (the reverse's
0.25 can't go lower); damage 9, 11.25 and 13.5; momentum 2. A stab next deals 9 × 1.25 × 2 = 22.5 and spends it.

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

## Blocks

`HYBRID.block` in `hybrid.ts`; `fight/weapons/defend.ts`.

- **Held block:** from in front (within 70°), a weapon chips 20% of its damage and costs a player its damage in
  stamina (a heavy × `heavyStaminaFactor` 2); a body blow costs its damage and pushes you back at 60% of its
  knockback. A hit that takes the last of the stamina (or more) breaks the guard: staggered `brokenTime` 0.8 s.
  Holding it drains `holdStaminaPerSec` 5 a second, you walk at 40%, and stamina doesn't refill. An enemy's block
  costs it the hit's poise instead (below).
- **Raising the guard:** a block (held or perfect) stops nothing until the guard is up, `raiseTime` 0.05 s +
  `raiseTimePerHeft` 0.17 s × (felt heft − 1) after the press (`guardRaiseTime`): sword 0.05, longsword 0.08,
  greatsword 0.15 s at strength 10, 0.1 s at 20. An enemy's rises after its `blockReactTime`.
- **Perfect block:** the window opens as the guard comes up and lasts `perfectTime` 0.2 s × blade length /
  `perfectAtLengthM` 1.1 (`perfectBlockTime`): sword 0.2, longsword 0.25, greatsword 0.35 s. A weapon landing in it
  (even with block let go again) is stopped with no stamina and no chip; the attacker loses `perfectDrain` 10 stamina
  (if it has a bar) and is staggered `perfectRecoilTime` 0.4 s. No window if the last press was under `remashTime` 0.5 s
  before. Body blows can't be blocked perfectly.
- **Feint:** block pressed in a heavy's wind-up, up to `HYBRID.feint.cutoffTime` 0.15 s before the blade goes live,
  pulls it back into the held block for `feint.cost` 10 stamina. It opens no perfect window (and, as a press, closes
  the next 0.5 s's) and ends the chain. Lights and stabs can't be feinted.

Example: blocked held, a sword light costs the blocker 9 stamina and 1.8 HP, a sword heavy 36 stamina and 3.6 HP; a
boar's charge into it costs 30 stamina and pushes the blocker back at 9 m/s, no HP.

## Swing parries

`HYBRID.parry` in `hybrid.ts`; `fight/weapons/parry.ts`.

- **Angle:** the exact reverse of the incoming way (as you see it) is a full parry, within 45° a partial one; stabs
  never count.
- **Timing:** when a blade would land, the defender's swing went live up to its window before (`perfectBlockTime`:
  sword 0.2, longsword 0.25, greatsword 0.35 s, and while its swing lasts) and it parries; or it goes live up to the
  attacker's window after, and the attacker's blade parries it. Within `clashTime` 0.05 s of each other: a clash.
- **Weight:** heft × √(strength / 10), × `heavyWeightFactor` 2 for a heavy.
- **Recoil** of the parried: base (`fullRecoilTime` 0.8 s, `partialRecoilTime` 0.5 s) × clamp(parrier's weight /
  parried's, `minRatio` 0.5, `maxRatio` 2), never under `minRecoilTime` 0.2 s. A clash staggers both the base time.
- **The Kobold** parries `parryChance` 15% of the swings it reads (those it doesn't perfect-block).

Example: a sword heavy fully parrying a sword light: weights 2 and 1, the light recoils 0.8 × 2 = 1.6 s; a light
partly parrying a heavy: 0.5 × 0.5 = 0.25 s.

## Poise and stagger (enemies)

`enemyBrainSystem` (`fight/behaviors/brain.ts`), with `poise`, `poiseRegen` and `staggerTime` in each enemy's def.

- A hit takes its poise damage: a light 12, a heavy 24, a stab 18, an Earth skill 20 × the hit's share; so does a
  hit it blocks.
- Poise comes back at `poiseRegen` a second (not while staggered), up to `poise`.
- At 0 or less it's staggered for `staggerTime` × 10 / toughness and its poise refills; not while charging, stunned
  or already staggered.
- Other stuns: a boar slamming the wall, `charge.stunTime` 2.2 s; 3 Lightning stacks, 1 s × 10 / toughness
  (`elements.lightning`).
- Enemies have no hurt invulnerability, and a hit doesn't stun them.

Example: a boar (36 poise, 8 a second, 1 s stagger) hit by a chain of sword lights 0.5 s apart: 36 − 3 × 12 + 8 × 1
= 8 after three, so the next staggers it; two heavies and a light (24 + 24) do it on the second.

## Stun and invulnerability (players)

`PLAYER` in `shared/src/battle/player.ts`; `combat.ts`.

- **Hitstun** (no control): a body blow (0.25 + 0.02 × knockback) × 10 / toughness; blocked perfectly or with the
  guard broken, the stagger above. Toughness shortens only the body blow's: the counterplay's openings stay as they are.
  Weapon hits and skills give none.
- **Hurt invulnerability:** `hurtInvuln` 0.6 s after a weapon or body hit lands, against weapon and body hits.
- **Dodge i-frames:** from `dodge.iframeStart` 0 to `iframeEnd` 0.32 s of the 0.42 s dodge, weapon and body hits miss.
- Neither stops a skill: Bolts, Beams, Novas, clouds and burning hurt through them, and through a block.
- **What breaks off a chant**, a cast's wind-up, writing a page or the bag: any hitstun (losing the chant's words), or
  a dodge (keeping them). An enemy's chant breaks when it's stunned, staggered or killed (`cantCast` in
  `fight/skills/skilled.ts`). A weapon hit doesn't break a chant.

## Stamina

`PLAYER` and the player's controller (`fight/player/controller.ts`).

- The bar is 15 × the stamina stat (150). It refills at `staminaRegenPerSec` 45 × stamina recovery / 10 a second
  (× 1.5 while Charged), from `staminaRegenDelay` 0.6 s after an action ends: not while attacking, dodging, casting,
  blocking or staggered, but while standing, walking, chanting, writing or in the bag. Empty to full:
  0.6 + 150 / 45 = 3.9 s. It doesn't refill on the overworld.
- Any stamina above 0 starts an attack or a dodge; its cost may take the bar down to 0. A skill needs its whole cost
  to start, and pays it on release.

| Action | Cost at strength 10 | Where |
|---|---|---|
| Light / heavy / stab | 10 / 16 / 12 × felt heft: longsword 12 / 19.2 / 14.4, greatsword 16 / 25.6 / 19.2 | `HYBRID`, `strikeCost` |
| Holding a block | 5 a second | `HYBRID.block.holdStaminaPerSec` |
| A blocked hit | its damage (a heavy × 2); a perfect block nothing | `HYBRID.block.heavyStaminaFactor` |
| Blocked perfectly (the attacker) | 10 | `HYBRID.block.perfectDrain` |
| Feinting a heavy | 10 | `HYBRID.feint.cost` |
| Dodge | 22; heavy × 1.3 = 28.6; overloaded can't; Hasted × 0.7 | `PLAYER.dodge.cost`, `BURDEN.heavyDodgeCost` |
| Skill | its words' cost (below); a held Beam its own words × 2 a second | `skillCost`, `beam.heldCostFactor` |

The Goblin Warlock's bar works the same (150, 45 a second, paused while it winds up a cast).

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
| Poise, regen a second, stagger | 36, 8, 1 s | 80, 10, 0.8 s | 80, 10, 0.8 s | 20, 8, 1 s |
| Walk | 3.2 m/s | 2.6 m/s | 2.6 m/s | 2.4 m/s |
| Hits | bite 16, charge 30 | light 14, heavy 28 | light 14, heavy 28 (1.6 × as slow) | staff 5; Bolt Fire 8 + 10 burning |

- **Boar:** bites within 2.8 m (0.65 s wind-up), then can't again for 0.75 + 0.6 s; charges from 5-22 m (1.1 s wind-up,
  locking its aim 0.3 s before; 17 m/s for up to 1.6 s; no stagger while charging), first after 2 s, then 4.5 s after
  recovering or the wall's 2.2 s stun.
- **Kobolds:** a chain of 2 or 3 (even odds), each swing any of the 7 ways or a stab, never the same twice running,
  heavy 30% of the time; its first goes live 1.1 s after it starts and the rest 0.45 s (a heavy 0.35 s more), × its
  blade's heft, stepping in at 3 m/s while live; then 0.5 s to recover and 1.2 s more before the next chain; first
  after 1.5 s. Walking up it blocks from 0.3 s in. Rolled from the fight's seed: walking up, it perfect-blocks 30% of
  a player's swings (rolled as each starts) and answers at once with a chained swing. A Bolt
  aimed within about 26° of it is side-stepped 60% of the time (8 m/s for 0.3 s: 2.4 m), at max(0.25 s, release time − 0.1 s) into its wind-up.
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
