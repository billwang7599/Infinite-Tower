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
- [Inscriptions](#inscriptions)
- [Blessings](#blessings)
- [Weapon attacks](#weapon-attacks)
- [Bows (placeholder)](#bows-placeholder)
- [Body blows](#body-blows)
- [Hits and pushback](#hits-and-pushback)
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
- [Money and prices](#money-and-prices)

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
| toughness (hidden) | 10 | an enemy's stun or stagger × 10 / toughness (nothing stuns a player it would shorten) | `stunTime` |
| stamina recovery (hidden) | 10 | stamina refill × stamina recovery / 10 | `staminaRegenPerSec` |
| health regen (hidden) | 10 | HP a second = vitality × health regen / 200 | `hpRegenPerSec` |
| steadiness (hidden) | 10 | a player's pushback × (10 / strength)^¼ × (10 / steadiness)^½, kept in 0.25-2 (`KNOCKBACK_TAKEN`) | `knockbackTakenFactor` |

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
- **What a step gives:** every shown stat + 1 × 2^realm (1, 2, 4, 8, 16), the hidden four + 1, and 2 × 2^realm free
  points. After all 15: 103 each before points, the hidden 25, and 186 points.
- **Free points** go into the shown stats, one at a time, outside fights; taken back one at a time only by a campfire.
- **Essence** (an item's `essence` effect in `ITEMS`): boar 20, grey wolf 25, Kobold Swordsman 40, Kobold Greatsword
  50, Kobold Shieldbearer 45, Goblin Warlock 30, bog lurker 45. Absorbing takes 2 s (`useTime`). The first step is 5 boars.
- **Death:** the step's fill is lost; with none, the step (and its gains); points over what's left are taken back off
  the stats with the most first (`coreAfterDeath`).

Example: Early Yan, 90 in: a boar's essence (20) breaks through to Middle Yan with 10 in. Every shown stat is 11, the
hidden ones 11, 2 points free; the most HP 110, the stamina bar 110, HP 10 more than before and stamina 10 more.

## Inscriptions

`INSCRIPTIONS` and the rules in `shared/src/soul/inscriptions.ts`; what each status does in `STATUS_DEFS`
(`shared/src/battle/statuses.ts`).

- **Slots** (`inscriptionSlots`) = 1 + s + floor(s / 3), s the steps finished (at most 14): Early Yan 1, Middle Yan 2,
  Peak Yan 3, Early Sol 5, Peak Tian (and a whole core) 19. A death that costs a step keeps every ring, even past the
  slots left; none more can be carved until the core grows back.
- **Grit** (uncommon): + 4 strength and + 4 vitality on the core's stats (40 more HP at the start).
- **Embers** (rare): burning does you no harm (`burnTakenFactor` 0); each weapon hit you land sets the foe burning 3
  per second for 3 s (`weaponBurnPerSec`, `EMBERS.burnTime`), on again from 3 s at the next hit: 9 a hit on top of
  the sword's 16.
- **Last Breath** (epic): an attack or a dodge with too little stamina is paid for, the part you lack × 0.5 HP
  (`hpPerStaminaShort`). At 0 stamina only if your HP is more than that: a light (10) costs 5 HP, a dodge (30) 15.
  Paying never takes your last HP.
- **Red Blade** (legendary): your weapon hits heal 25% of the damage they deal (`weaponLifesteal`), on top of any
  lifesteal; a sword's 16 heals 4.
- **The First Door** (unique): once a fight, a blow that would bring you to 0 HP leaves you at 1 (`FIRST_DOOR`) and
  takes no damage at all for 2 s (`openedDoor`, damage taken × 0).
- **Carving** (`CARVE_PRICES`, `server/src/core/content/shops.ts`), by the sigil's rarity, copper and essences of any
  kind: common 50c + 1, uncommon 2s + 3, rare 10s + 6, epic 40s + 12, legendary 1g 50s + 25, unique 3g + 40.
  Essences are paid cheapest first (boar before Kobold), off the cloth then the bag.
- **Removing** (`REMOVE_PRICES`) = carving × 3 in coins (`REMOVE_PRICE_FACTOR`) and × 2 in essence: Grit 6s + 6.

## Blessings

`BLESSINGS` and `BLESSING_FAITH` in `shared/src/soul/blessings.ts`; what each does in `STATUS_DEFS`.

- **Blessed** while faith with a god ≥ 100, for each god that has a blessing; no cap.
- **Faith:** + a quest step's `reward.faith` (Kaelith 20 from each of three quests, Haldis 30, Brannoc 30), or + 25
  from the admin panel (`FAITH_CHEAT`, `server/src/core/game/cheats.ts`). Never lost yet.
- **Kaelith's Edge:** damage dealt × 1.1 (a sword's 16 does 17.6). **Brannoc's Anvil:** damage taken × 0.9, pushback
  × 0.5. **Haldis's Hearth:** stamina refill × 1.2.

## Weapon attacks

`CHAIN`, `MOMENTUM`, `HYBRID`, `wayStepsAfter`, `strikeDamage` and `strikeCost` in `shared/src/weapons/hybrid.ts`,
`DAMAGE_PER_HEFT`, `DAMAGE_PROFILES` and `weaponDamage` in `shared/src/weapons/weapons.ts`, with each weapon's numbers
in its `weapon` (`ITEMS`); the rules in `fight/player/sword.ts` and `fight/weapons/`. A weapon's heft is on one scale
with the Basic Sword's, 3 (the stored id is still `sword`; the shield and the bow weigh 3 too).
Damage goes × √(strength / 10), and every time and stamina cost × the heft the wielder feels (`feltHeft`): (heft /
the Basic Sword's 3) × 10 / strength, one linear rule for every weapon and guard, light ones too, so the Basic Sword
feels 1 at strength 10, 2 at 5 and 0.5 at 20. Below a weapon's `minStrength` it can't be wielded at all (Basic Sword
0, longsword 6, greatsword 9; the Kobolds' blades as theirs).

The strength in every weapon number here (felt heft, so every time and stamina cost; damage; the guard's raise; a
block's stamina; a parry's weight) is the grip's (`appliedStrength` in `kinds.ts`): a melee weapon with nothing in the
other hand is held in both (`gripOf`), and puts the wielder's strength × `TWO_HAND_STRENGTH_FACTOR` 2 into it; anything
in the other hand (a skillbook, a shield, a second blade) keeps it one-handed, at the wielder's own, as do hands marked
`oneHanded` (every Kobold's). Players and enemies alike; a bow is never two-handed this way. The body's numbers (carry
limit, pushback taken, walking) keep the wielder's own strength. Felt heft goes as 1 / strength, so two hands halve
every melee weapon's (at strength 10 the Basic Sword 0.5, the greatsword 0.81, the old stick 0.06) and make it hit √2 as
hard.

- **Wind-up** (press to the blade going live): a light `CHAIN.startupTime` by how it follows the last swing of the
  same hand (an opening or after a stab 0.56 s, the reverse 0.4 s, another line 0.48 s, a perpendicular one 0.6 s), ÷
  an Air Imbue's swift factor; a heavy the same + `HYBRID.heavy.extraTime` 0.36 s; a stab 0.45 s. Then × felt heft,
  and never under `CHAIN.minWindupTime` 0.4 s, for every swing, a player's or an enemy's. Momentum doesn't change it.
  A swing down from the top has no reverse. Drawn back for the first 60%, driven for the rest. Live 0.13 s (a heavy
  0.15 s), then recovering 0.1 s (a heavy 0.26 s). It chains if it starts within `gapTime` 0.25 s of the end of the
  last swing by either hand.
- **Recovery, per hand:** a hand can't swing again until its swing's recovery is over; a press waits for it. With a
  blade in each hand, the other hand can swing as soon as the first's blade is done (a switch, Q, waits for that
  too, then is instant), and the first hand's recovery runs on (`HandChain.recoverSteps`); a switch never cuts it.
- **Momentum,** each hand its own (`WielderData.chains`): each chained swing adds `MOMENTUM.gain` (the reverse 0.25,
  another line 1, a perpendicular 0.5), at most 4, and both hands' is lost on a gap, a dodge, a block, a cast, the
  chant, the bag, a hit taken or being blocked perfectly.
- **A weapon's damage** (`weaponDamage`) comes in three types, slash, stab and blunt, each a whole number. Its swing is
  `DAMAGE_PER_HEFT` 5 × heft × quality (1 for every weapon so far), and its profile (`DAMAGE_PROFILES`) splits it:
  slash and blunt as shares of the swing, stab as a fraction of it, each rounded. A sword slash 0.9, blunt 0.1, stab
  0.55; the longsword, the thrusting sword, stab 0.7; a greatsword slash 0.8, blunt 0.2, stab 0.4. Two are off the
  rule by their own `baseDamage` (what the profile splits instead): the old stick, 3, all blunt, stab a third; and the
  bow, 20, all stab (it's ranged).
- **A strike's damage** (`strikeDamage`): a swing deals the weapon's slash and its blunt as two damages, a heavy both
  × 2; a stab deals only its stab. A swing × (1 + 0.25 × momentum, ×2 at most); a stab × (1 + 0.5 × momentum) and
  spends that hand's. Each type × √(strength / 10) and taken on its own (Damage taken). **Stamina:** a light 13, a
  heavy 21, a stab 16 (× felt heft).
  **Poise:** 12, 24, 18. **Knockback**, pushing only a guard it's blocked by: 4, 8, 6 m/s (Hits and pushback, below).
- **Reach** (`wayShape`): (arm reach + blade) × 1.15 for every swing (2.19 m with the Basic Sword), its arc by line:
  160° across, 110° on a diagonal, 60° down from the top; × 1.75 for a stab (16°), to the target's surface; arcs by
  angle to its centre (any angle within 0.3 m). Arm reach is `PLAYER.armReachM` 0.8 (an enemy's `wielder.armReachM`,
  also 0.8).
- **The body** (`HYBRID.swinging`, `fight/weapons/commit.ts`; players and swordsmen alike): from the press to the
  swing's end you walk at `moveFactor` 25% (a swordsman at 25% of its walk up), and while the blade is live it carries
  you forward along it at `lungeSpeed` 4 m/s. A live blade turns toward the aim (a swordsman's toward its target) at
  most `liveTurnRadPerSec` 3 rad/s. A swing whose live time meets no one (out of reach, dodged) overextends: its
  recovery runs `whiffRecoverTime` 0.2 s × felt heft longer, you're carried on at `whiffCarrySpeed` 1.5 m/s all through
  it, and nothing else starts until it ends (a press waits); the chain's gap counts from that later end. The longer
  recovery is the swinging hand's, as is a feint's (`HYBRID.feint.recoverTime` 0.38 s × felt heft, in
  `HandChain.recoverSteps`).

Example: a Basic Sword light is live 8 steps (0.13 s), carrying you 0.53 m and turning at most 0.4 rad (23°). Landed,
it recovers 0.1 s; whiffed, 0.1 + 0.2 = 0.3 s, carried another 0.45 m.

By weapon, at strength 10 one-handed (something in the other hand, or a Kobold's), an opening swing (light / heavy;
times in seconds, as the fight's steps round them):

| Weapon | Heft (felt) | Slash + blunt (light / heavy), stab | Wind-up | Live | Recovery | Stamina (light / heavy / stab) |
|---|---|---|---|---|---|---|
| Old stick | 0.385 (0.13) | 0 + 3 / 0 + 6, 1 | 0.4 / 0.4 | 0.02 / 0.02 | 0.02 / 0.03 | 1.7 / 2.7 / 2.1 |
| Basic Sword | 3 (1) | 14 + 2 / 28 + 4, 8 | 0.57 / 0.92 | 0.13 / 0.15 | 0.1 / 0.27 | 13 / 21 / 16 |
| Longsword | 3.57 (1.19) | 16 + 2 / 32 + 4, 12 | 0.67 / 1.1 | 0.15 / 0.18 | 0.12 / 0.32 | 15.5 / 25 / 19 |
| Greatsword | 4.86 (1.62) | 19 + 5 / 38 + 10, 10 | 0.9 / 1.48 | 0.22 / 0.25 | 0.17 / 0.42 | 21.1 / 34 / 25.9 |
| Kobold blade | 3 (1) | 14 + 2 / 28 + 4, 8 | 0.57 / 0.92 | 0.13 / 0.15 | 0.1 / 0.27 | none |
| Kobold greatsword | 4.86 (1.62) | 19 + 5 / 38 + 10, 10 | 0.9 / 1.48 | 0.22 / 0.25 | 0.17 / 0.42 | none |

The Basic Sword's chained lights: the reverse 0.4 s, another line 0.48 s, a perpendicular one 0.6 s; its stab 0.45 s.
The longsword's 0.48, 0.57, 0.72 and 0.53 s; the greatsword's 0.65, 0.78, 0.97 and 0.73 s.

The same at strength 10 held in both hands (strength 20 put in, so each felt heft halved):

| Weapon | Felt heft | Slash + blunt (light / heavy), stab | Wind-up | Live | Recovery | Stamina (light / heavy / stab) |
|---|---|---|---|---|---|---|
| Old stick | 0.06 | 0 + 4.24 / 0 + 8.49, 1.41 | 0.4 / 0.4 | 0.02 / 0.02 | 0 / 0.02 | 0.8 / 1.3 / 1 |
| Basic Sword | 0.5 | 19.8 + 2.83 / 39.6 + 5.66, 11.31 | 0.4 / 0.47 | 0.07 / 0.08 | 0.05 / 0.13 | 6.5 / 10.5 / 8 |
| Longsword | 0.6 | 22.63 + 2.83 / 45.25 + 5.66, 16.97 | 0.4 / 0.55 | 0.08 / 0.08 | 0.07 / 0.15 | 7.7 / 12.5 / 9.5 |
| Greatsword | 0.81 | 26.87 + 7.07 / 53.74 + 14.14, 14.14 | 0.45 / 0.75 | 0.1 / 0.12 | 0.08 / 0.22 | 10.5 / 17 / 13 |

Two-handed, the Basic Sword's and the longsword's chained lights and stabs are all at the 0.4 s floor; the
greatsword's 0.4, 0.4, 0.48 and 0.4 s.

Example: a greatsword (heft 4.86) feels 0.81 at strength 20, 1.62 at 10 and 1.8 at 9 (its least): an opening light
winds up 0.45, 0.9 or 1 s and costs 10.5, 21.1 or 23.4 stamina. The Basic Sword feels 0.5, 1 or 2 at 20, 10 or 5: an
opening light 0.4 s (the floor), 0.57 or 1.12 s, for 6.5, 13 or 26 stamina. The old stick (heft 0.385) feels 0.13
at 10: every wind-up, a heavy's too, held at the 0.4 s floor. Held in both hands each is as at twice the strength:
the greatsword at 10 two-handed is the one at 20.

An enemy's swing deals the same damage, costs no stamina and holds its body by the same rules (the body, above). Its
swings are timed by the same functions as a player's, from its weapon and the strength its grip puts in
(`weaponAttackSystem`, `fight/behaviors/weapon.ts`): a chain's first swing and a counter are openings, each next one
is chained on from the last way (`chainKind`), and its next swing waits for the last one's recovery (a whiff's too).
Its def holds only pacing: the cooldown between chains, chain lengths, shares and chances. **The Kobold** (its weapon
attack, `server/src/core/enemies/kobold-swordsman.ts`) holds its blade in one hand, its hands `oneHanded`: the
one-handed table's Kobold blade, its chained lights the Basic Sword's; the Kobold Greatsword the greatsword's. It
won't parry a swing it could only meet by winding up under the 0.4 s floor. It blocks walking up (from 0.3 s in), and
perfect-blocks 30% of the swings a player starts at it while walking up (`perfectBlockChance`). It feints 20% of its
heavies (`heavyFeintShare`): 0.15 s before the blade would go live it pulls back into its block, ends the chain and
waits its 1.2 s cooldown.

Example: a Basic Sword light (one-handed) from the left, then down from the top left, then from the left again (another
line each time): wind-ups 0.57, 0.48 and 0.48 s; momentum 1, then 2; damage 14 + 2, 17.5 + 2.5 and 21 + 3 (slash +
blunt). A stab next deals 8 × (1 + 0.5 × 2) = 16 stab and spends it. Three reverses instead would build only 0.5
(damage 16, 17, 18 in all), at 0.4 s each. The Basic Sword's swing, 5 × 3 = 15, splits into slash 13.5 and blunt
1.5, rounded 14 and 2 (halves round up, so it deals 16), its stab 15 × 0.55 = 8.25, 8; the longsword's, 5 × 3.57 =
17.85, into 16.07 and 1.79, so 16 and 2, its stab 12.495, 12. Held in both hands, every type is × √2 through the
strength: a light 19.8 + 2.83, a stab 11.31.

## Bows (placeholder)

Placeholders, every number (AGENTS.md, "Bows"). `BOW`, `drawTime`, `drawCost`, `loosedDamage`, `drawnPower`,
`loosedSpeed`, `flightAfter` and `nockTime` in `shared/src/weapons/bow.ts`, a bow's `powerMps` and a quiver's
`pack.holds` in `ITEMS`; the draw in `fight/player/bow.ts`, the flight in `fight/weapons/projectile.ts`.

- **Draw:** costs `draw.cost` 8 stamina × felt heft as it starts; full after `draw.fullTime` 1 s × felt heft, and
  a release before `draw.minTime` 0.25 s × felt heft looses then. You walk at `draw.moveFactor` 50%.
- **Nocking:** after loosing, `nock.quiverTime` 0.3 s before the next draw if the quiver holds an arrow, else
  `nock.bagTime` 0.8 s. A quiver's one cell holds 60 arrows (`holds.stackSize`; a bag cell 20); they're shot first.
- **Damage** = each type of the bow's (`weaponDamage`: its `baseDamage` 20, all stab, off the melee rule) ×
  (`minDamageShare` 0.3 + 0.7 × the share drawn, at most 1) × √(strength / 10).
- **Speed** = the bow's `powerMps` × (t² + 2t) / 3, t the share drawn (at most 1): Minecraft's draw curve
  (`drawnPower`, which the draw meter shows).
- **Flight** (Minecraft's, in metres: `flightAfter`): dv/dt = g − k v, gravity g = `gravityMps2` −20 m/s² (Minecraft's
  0.05 blocks a tick²) and drag k = `dragPerSec` 0.2 /s, so it keeps e^−0.2 = 82% of its speed a second (Minecraft's
  0.99 a 1/20 s tick). After t s: v = v₀ e^−kt + g (1 − e^−kt) / k, and it has gone v₀ c + g (t − c) / k with
  c = (1 − e^−kt) / k. Each step moves it there exactly (sweeping the chord), so the trail drawn back along it is the
  path flown. At most `lifeTime` 3 s; it leaves 0.6 m ahead and 0.15 m above your middle.
- **Aim:** with no lock-on, straight at the spot under the crosshair (`aimAt`), no arc; locked on, in the low arc at
  that speed that meets the target's middle under the drag and gravity (`launchAt`: the pitch stepped up by 0.5° from
  the straight line until the flight reaches the middle's height there, then halved 50 times), straight at it if it
  can't. Poise 10 on an enemy, knockback 0.07 × its speed (pushing a guard: Hits and pushback); blocked like a light
  (below). Stuck, it lies `stuckTime` 2 s.

Example: the Training bow (20 stab, 60 m/s) let go at once (a share of 0.25) deals 20 × (0.3 + 0.7 × 0.25) = 9.5 at
60 × (0.0625 + 0.5) / 3 = 11.25 m/s, and loosed level from chest height lands 3.3 m off; held 1 s or more, 20 at
60 m/s. A full draw loosed level drops 7 cm by 5 m, 0.28 m by 10 m, 0.74 m by 16 m (the arena's middle to its wall),
1.8 m by 25 m and 3.1 m by 32 m (wall to wall), and from chest height lands 17.5 m off.

## Body blows

An enemy's lunge, charge, pounce, slam or sweep (`addHitAhead`): damage = its `damage` × √(strength / 10), all blunt
(the agent's pick; bites too, for now). Landing on a player who isn't blocking, it only hurts, as every hit that lands
(Hits and pushback, below); its `knockback` pushes only a guard that blocks it.

| Blow | Damage | Knockback (m/s) |
|---|---|---|
| Boar bite (lunge) | 16 | 8 |
| Boar charge | 30 | 15 |
| Wolf bite (pounce) | 15 | 6 |
| Lurker slam | 38 | 12 |
| Lurker tail sweep | 20 | 10 |
| Warlock's staff (lunge) | 5 | 3 |

## Hits and pushback

`land` and `knockbackOf` in `fight/combat.ts`; the push in `blocked` (`fight/weapons/defend.ts`).

- **A hit that lands does damage only** (combat v2, the user: "Hits do damage only"): a weapon, an arrow or a body
  blow on anyone with the guard down hurts, and nothing more: no knockback, no lift, no stun. A player then has
  `hurtInvuln` 0.6 s and their momentum chain breaks. An enemy staggers only when its poise breaks (Poise, below),
  never from one hit. Air is a skill, and still blows its target away (Skills).
- **Only a block pushes:** a hit into a held guard sets the blocker moving at the hit's knockback × the target's
  resistance × `HYBRID.block.pushbackFactor` 0.6 × the guard's `pushFactor` (shield 0.6, one blade 1, two blades 1.2),
  half away from the attacker and half along the blow; the floor and the wall stop it as they stop any move. One
  rule for players and enemies. It's movement only: it takes no control away, so a blocker sliding back, or pinned to
  the wall, can turn, step, keep blocking, attack or dodge on the very next step. Blocked perfectly, no push.
- **The hit's knockback:** `knockbackSpeed` in `HYBRID`, a light 4 m/s, a stab 6, a heavy 8, whatever the blade and
  the strength; an arrow `knockbackShare` 0.07 × its speed as it strikes; a body blow its own (above); Air 12 × its
  factor (Skills).
- **Resistance:** an enemy's `knockbackFactor` (1 if not given; Enemies, below), none while it's armored, committed to
  a blow; a player's `knockbackTakenFactor` (strength and steadiness, Stats above: 1 at the start, 0.84 at strength
  20, 0.63 at steadiness 25, never under 0.25); either × its statuses' knockback factor (Warded and Bulwark 0,
  Brannoc's Anvil 0.5).
- **The slide:** a blocking player slows at `PLAYER.accel` 60 m/s², so slides v² / 120 (a sword light 5 cm, a heavy
  19 cm); an enemy at its state's acceleration (25 m/s² walking), so a Kobold blocking slides about 0.1 m from a
  light, 0.23 m from a stab and 0.42 m from a heavy (in 1/60 s steps). Only the wielders block (the Kobolds, Bram), so
  the boar's, wolf's and lurker's factors now only meet Air.

## Blocks

`HYBRID.block` in `hybrid.ts`; `fight/weapons/defend.ts`.

- **Held block:** from in front (within 70°), a weapon chips 20% of its damage (of each type) and costs a player its
  damage, all types together, in stamina (a heavy × `heavyStaminaFactor` 2), × 10 / the grip's strength
  (`blockStaminaShare`): a stronger blocker spends less, and a blade in both hands half; a body blow costs its damage
  (× 10 / strength too) and pushes you back at 60% of its knockback. A hit that takes the last of the stamina (or
  more) breaks the guard: staggered `brokenTime` 0.8 s.
  Holding it drains `holdStaminaPerSec` 5 a second, you walk at 40%, and stamina doesn't refill. An enemy's block
  costs it the hit's poise instead (below), and pushes it back by the same rule as a player.
- **By guard** (`GUARDS` in `hybrid.ts`, the hands' guard from `guardOf` in `kinds.ts`): a shield in either hand
  blocks for the hands; else a melee weapon in each is two blades, else one weapon is one blade. The held block's
  chip, its stamina and its push go by it: shield 8% chip, stamina × 0.6, push × 0.6, covering 90° either side;
  one blade the numbers above; two blades 32% chip, stamina × 1.35, push × 1.2. The perfect window and raise time
  take the shield's own length and heft (the Wooden shield: 1.1, so 0.2 s, and heft 3, up in 0.1 s), or the
  swinging blade's.
- **Pushed back** (Hits and pushback, above): a sword light 2.4 m/s with one blade, a heavy 4.8, a stab 3.6; movement
  only, never a lock.
- **Backed against the wall:** the wall stopping all of that slide, the chip goes × `pinnedChipFactor` 2; part of it,
  × 1 + (2 − 1) × the share stopped (`pinnedShare` in `defend.ts`, swept by the physics). Players and enemies alike.
  Body blows chip nothing, so nothing more.
- **Raising the guard:** a block (held or perfect) stops nothing until the guard is up, `raiseTime` 0.1 s +
  `raiseTimePerHeft` 0.22 s × (felt heft − 1) after the press, never under 0 (`guardRaiseTime`): Basic Sword 0.1,
  longsword 0.14, greatsword 0.24 s at strength 10 one-handed (0, 0.01 and 0.06 s held in both hands, as at strength
  20; 0.32 s for the Basic Sword at 5); the old stick 0 (instant). An enemy's rises after its `blockReactTime`.
- **Perfect block:** the window opens as the guard comes up and lasts `perfectTime` 0.2 s × blade length /
  `perfectAtLengthM` 1.1 (`perfectBlockTime`): sword 0.2, longsword 0.25, greatsword 0.35 s. A weapon landing in it
  (even with block let go again) is stopped with no stamina and no chip; the attacker loses `perfectDrain` 10 stamina
  (if it has a bar) and is staggered `perfectRecoilTime` 0.4 s (blocked by an enemy that counters, 0.25 s: Counters,
  under Swing parries). No window if the last press was under `remashTime` 0.5 s
  (30 steps) before, so mashing opens none, while a reader can still press for each swing of a chain. Body blows can't
  be blocked perfectly.
- **Feint:** block pressed in a heavy's wind-up, up to `HYBRID.feint.cutoffTime` 0.15 s before the blade goes live,
  pulls it back into the held block for `feint.cost` 10 stamina. It opens no perfect window (and, as a press, closes
  the next 0.5 s's) and ends the chain. Then the blade recovers `feint.recoverTime` 0.38 s × felt heft (the Basic
  Sword 0.38 s at strength 10) before that hand can swing again, the guard held meanwhile; a swordsman's feint too (no
  parry or counter in it). Lights and stabs can't be feinted.

Example (both one-handed, strength 10): blocked held, a sword light costs the blocker 16 stamina and 3.2 HP, a sword
heavy 64 stamina and 6.4 HP; held in both hands, the blocker spends 8 and 32. A two-handed attacker's light is 19.8
slash + 2.83 blunt, 22.63 in all: 22.63 stamina and 4.53 HP to a one-handed blocker, 11.31 to a two-handed one; a
boar's charge into it costs 30 stamina and pushes the blocker back at 9 m/s, no HP. Behind a shield the light costs
9.6 stamina and 1.28 HP; with two blades 21.6 stamina and 5.12 HP. Backed flat against the wall, the light chips
6.4 HP (shield 2.56); with 10 cm behind, a heavy's 19 cm slide loses about half, so about 1.5 × its 6.4.

## Swing parries

`HYBRID.parry` in `hybrid.ts`; `fight/weapons/parry.ts`.

- **Angle:** the exact reverse of the incoming way (as you see it) is a full parry, within 45° a partial one; stabs
  never count.
- **Timing:** when a blade would land, the defender's swing went live up to its window before (`windowTime` 0.3 s ×
  blade length / `block.perfectAtLengthM` 1.1, `parryWindowTime`: sword 0.3, longsword 0.38, greatsword 0.52 s, wider
  than the perfect block's, and while its swing lasts) and it parries; or it goes live up to the attacker's window
  after, and the attacker's blade parries it. Within `clashTime` 0.05 s of each other: a clash.
- **Weight:** heft × √(the grip's strength / 10), × `heavyWeightFactor` 2 for a heavy (raw heft: only the ratio
  counts): a blade in both hands × √2.
- **Recoil** of the parried: base (`fullRecoilTime` 0.8 s, `partialRecoilTime` 0.5 s) × clamp(parrier's weight /
  parried's, `minRatio` 0.5, `maxRatio` 2), never under `minRecoilTime` 0.2 s. A clash staggers both
  `clashStaggerTime` 0.3 s, whatever the ways and weights. Parried by an enemy that counters, `counter.recoilTime`
  0.25 s whatever the weights (Counters, below).
- **The Kobold** parries `parryChance` 15% of the swings it reads (those it doesn't perfect-block).
- **Counters** (a swordsman's, after it parries a swing or blocks one perfectly; the `riposte` in
  `fight/behaviors/weapon.ts`): one swing, wound up as a player's opening with its blade (`windupTime(strike,
  "opening")` through `wayStepsAfter`: × felt heft, never under `CHAIN.minWindupTime` 0.4 s), started once its
  `cooldown` is over and the player is in its `triggerDist` and in front, as any swing of its own. The one it parried
  or blocked perfectly recoils `HYBRID.counter.recoilTime` 0.25 s: the 0.4 s floor less a Basic Sword's 0.1 s guard
  raise, with a step to spare.

Example: a sword heavy fully parrying a sword light: weights 6 and 3, the light recoils 0.8 × 2 = 1.6 s; a light
partly parrying a heavy: 0.5 × 0.5 = 0.25 s. A one-handed sword light fully parrying a Kobold blade's light (the
same weight, 3): the Kobold recoils 0.8 s; a two-handed one (4.24) 0.8 × 1.41 = 1.13 s. The Kobold's blade parrying
a Basic Sword light that went live too late: the player recoils 0.25 s (free 17 steps on, the systems' order adding
two), and its counter, a light opening (0.56 s), goes live 35 steps after the parry: 18 steps (0.3 s) to raise the
guard (6 one-handed, none in both hands) or dodge; a stab counter (0.45 s) leaves 11.

## Poise and stagger (enemies)

`enemyBrainSystem` (`fight/behaviors/brain.ts`), with `poise`, `poiseRegen` and `staggerTime` in each enemy's def.

- A hit takes its poise damage: a light 12, a heavy 24, a stab 18, an Earth skill 20 × the hit's share; so does a
  hit it blocks.
- Poise comes back at `poiseRegen` a second (not while staggered), up to `poise`.
- At 0 or less it's staggered for `staggerTime` × 10 / toughness and its poise refills; not while charging, stunned
  or already staggered.
- Other stuns: a boar slamming the wall, `charge.stunTime` 2.2 s; 3 Lightning stacks, 1 s × 10 / toughness
  (`elements.lightning`).
- Enemies have no hurt invulnerability, and a hit neither stuns nor moves them (Hits and pushback, above).
- Any stun or stagger (those above, and a perfect block's or a parry's recoil) ends the attack under way (`stun` in
  `fight/behaviors/common.ts`): a Kobold's swing, the rest of its chain and its counter are dropped, and every
  attack waits its whole `cooldown` once the stun is over (the stun's time + `cooldown`; the wolf's, which counts only
  while it circles, `cooldown`). A skill's cooldown already starts with the cast, so it's left alone.

Example: a boar (36 poise, 8 a second, 1 s stagger) hit by a chain of sword lights 0.5 s apart: 36 − 3 × 12 + 8 × 1
= 8 after three, so the next staggers it; two heavies and a light (24 + 24) do it on the second. A Kobold blocked
perfectly mid-chain recoils 0.4 s, waits its 1.2 s cooldown, then winds up a fresh chain's first swing (0.57 s): its
next blade is live 2.17 s after the block.

## Stun and invulnerability (players)

`PLAYER` in `shared/src/battle/player.ts`; `combat.ts`.

- **Hitstun** (no control): only the counterplay's staggers, earned by the other side: the guard broken (0.8 s),
  blocked perfectly (0.4 s), a parry's recoil or a clash. No hit gives any (Hits and pushback), nor do skills; so a
  player's toughness has nothing to shorten for now.
- **Hurt invulnerability:** `hurtInvuln` 0.6 s after a weapon or body hit lands, against weapon and body hits.
- **Dodge i-frames:** from `dodge.iframeStart` 0.05 to `iframeEnd` 0.25 s of the 0.42 s dodge, counted in steps from
  the one it starts on (steps 3 to 14), weapon and body hits miss. Another dodge can't start until `dodge.cooldown`
  0.25 s (15 steps) after one ends.
- Neither stops a skill: Bolts, Beams, Novas, clouds and burning hurt through them, and through a block.
- **What breaks off a chant**, a cast's wind-up, writing a page or the bag: a dodge (keeping the words), or hitstun
  (losing them). A hit doesn't: it only hurts (it still stops eating). An enemy's chant breaks when it's stunned,
  staggered or killed (`cantCast` in `fight/skills/skilled.ts`).

## Stamina

`PLAYER` and the player's controller (`fight/player/controller.ts`).

- The bar is 10 × the stamina stat (100; combat v2 costs everything against 100). It refills at
  `staminaRegenPerSec` 45 × stamina recovery / 10 a second × the statuses' `staminaRegenFactor` (1.5 while Charged,
  1.2 with Haldis's blessing), from `staminaRegenDelay` 0.6 s after an action ends: not while attacking, dodging,
  casting, blocking or staggered, but while standing, walking, chanting, writing or in the bag. Empty to full: 0.6 +
  100 / 45 = 2.8 s. It doesn't refill on the overworld. A save from when the bar was 150 loads cut to the bar.
- Any stamina above 0 starts an attack or a dodge; its cost may take the bar down to 0. A skill needs its whole cost
  to start, and pays it on release.

| Action | Cost at strength 10 | Where |
|---|---|---|
| Light / heavy / stab | 13 / 21 / 16 × felt heft: Basic Sword 13 / 21 / 16, longsword 15.5 / 25 / 19, greatsword 21.1 / 34 / 25.9 | `HYBRID`, `strikeCost` |
| Holding a block | 5 a second | `HYBRID.block.holdStaminaPerSec` |
| A blocked hit | its damage (a heavy × 2) × the guard's stamina factor (shield 0.6, two blades 1.35); a perfect block nothing | `HYBRID.block.heavyStaminaFactor`, `GUARDS` |
| Blocked perfectly (the attacker) | 10 | `HYBRID.block.perfectDrain` |
| Feinting a heavy | 10 | `HYBRID.feint.cost` |
| Dodge | 30; heavy × 1.3 = 39; overloaded can't; Hasted × 0.7 = 21 | `PLAYER.dodge.cost`, `BURDEN.heavyDodgeCost` |
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
- **Overworld:** the world's `playerSpeed` (5 tiles/s, `PLAYER_SPEED` in `server/src/core/world/world.ts`) × burden
  pace × (agility / 10)^¼ (`overworldPace`).

## Carry limit and burden

`CARRY_LIMIT_AT_AVERAGE` in `shared/src/battle/stats.ts`, `BURDEN` in `shared/src/items/burden.ts`.

- limit = 60 × (strength / 10)^¼ = 60; weight = the bag's, the backpack's and every slot's items, the backpack itself
  too (the cloth weighs nothing).
- light up to the limit; heavy over it (a dodge × 1.3); overloaded over `overloadedAt` 1.2 × it, 72 (no dodging,
  walking × `overloadedPace` 0.5, in the arena and on the overworld).
- A new player carries 1: the canvas backpack, empty. A sword weighs 3, a longsword 4.5, a greatsword 8, the
  skillbook 1.5.

## Skills

`SKILL` and `skillCost` in `shared/src/skills/skill.ts`; `SKILL_EFFECTS` and `shotOf` in `shared/src/skills/effects.ts`;
`strike` in `fight/skills/strike.ts`. Examples at D = 10.

- **Cost:** (Σ over segments of form 3 + 2 per element + 1 per modifier) × `chainGrowth` 2^(segments − 1). Bolt Fire
  5; Bolt Fire Split Split 7; Bolt Fire, then Nova Lightning: (5 + 5) × 2 = 20.
- **Release time:** 0.3 + 0.1 × words (every form, element and modifier). Bolt Fire 0.5 s.
- **D** = `SKILL_EFFECTS.damage` 10 × √(skillpower / 10) × the caster's damage dealt (Statuses, below).
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
  through 2 more per word; Follow turns 3 rad/s per word, toward the locked enemy, else the foe at the smallest angle
  off the aim (the nearer of two as far off), none more than 90° off (`followLookRad`); if it falls mid-flight, the
  same off the Bolt's heading.
- **Beam:** 10 m long, 0.35 m wide (× 1.5 per Widen); a tick of 0.5 on release and every 0.5 s (÷ 1.5 per Swift) for
  1 s (× 2 per Extend), so 3 ticks (1.5 hits) unheld; held, it lasts as long as it's held and paid, then its 1 s.
- **Nova:** everyone within 3 m (× 1.5 per Widen). With Extend it leaves a cloud for 8 s (× 2 per further Extend),
  pulsing 0.4 every second: 8 pulses, 3.2 hits.
- **Imbue:** the next 3 sword hits within 8 s (both × 2 per Extend) each strike 0.5 of a hit; Swift makes your
  attacks' wind-ups ÷ 1.5 while it lasts.
- **Delay:** the hand-off to the next segment waits 1 s per word.
- **Self:** Fire, Empowered 8 s (deals × 1.2); Water, heals 0.3 D and clears harmful statuses; Earth, Warded 6 s
  (takes × 0.7, no pushback); Air, Hasted 5 s (moves × 1.3, dodges × 0.7); Lightning, Charged 5 s (stamina refills
  × 1.5); Light, a shield of 1 D for 6 s; Darkness, Siphoning 8 s (heals 10% of the damage you deal). Extend × 2 the
  time, Amplify × 1.5 the heal and shield.
- **Fused Self** (both elements in one Self stage, on top of each one's own): Fire + Air, Frenzy 10 s (stacks to 3:
  each stack deals × 1.1 and attacks cost × 0.85); Water + Light, Renewal 8 s (heals 0.2 D a second); Earth +
  Lightning, Bulwark 6 s (stuns × 0.5, though nothing stuns a player it would shorten; no pushback); Darkness + Fire,
  Bloodrage 8 s (deals × 1.35, takes × 1.25). Extend × 2 the time, Amplify × 1.5 Renewal's heal.

**Statuses** (`STATUS_DEFS` in `shared/src/battle/statuses.ts`) change stats by factors that multiply, once per
stack and across statuses (lifesteal adds). Put on again, a status keeps the longer of its time left and the new
time, takes the new amount and gains a stack up to its cap, all stacks on one timer. A permanent one (no time) counts
the same and never runs out; Self Water's cleanse takes off only harmful timed ones. Example: Frenzy ×2 and Empowered
deal × 1.1 × 1.1 × 1.2 = × 1.452.

Example: the Goblin Warlock's Bolt Fire hits you for 8, then burns 10 over 4 s; split, two Bolts of 7.2 (the burn
doesn't stack).

**Chanting** costs no time but picking the words, then the release time. The warlock says a word every `wordTime`
0.45 s and releases after (words + 1) × 0.45 s: Bolt Fire takes 1.35 s, then 0.5 s to release. Within `quickCastM` 6 m
it quick-casts (0.5 s). Writing a page in a fight takes `SAVE_IN_FIGHT_TIME` 2 s.

## Damage taken

`hurt` and `hurtPhysical` in `shared/src/battle/fight/health.ts` and `modsOf` in `shared/src/battle/statuses.ts`.

- A weapon's or a body blow's damage is typed (slash, stab, blunt; Weapon attacks), and each type is dealt and taken on
  its own, through the rules below (`hurtPhysical`); what the hit took is their sum, each shown as its own number.
  No resistance by type yet (armour will bring them).
- Dealt = damage × the attacker's statuses' damage dealt (Empowered 1.2, Cursed 0.85, Frenzy 1.1 a stack, Bloodrage
  1.35; weapon, body and skill hits alike).
- Taken = dealt × 50 / (40 + defense) for a weapon or body hit, × 50 / (40 + special defense) for a skill's (a burn
  too), × the target's statuses' damage taken (Warded 0.7, Bloodrage 1.25), less what the Light shield absorbs (a
  shield used up comes off), off HP (never below 0). Any damage stops HP regen for 5 s.
- In a spar (Bram's training fights) HP never goes below a share of the most, `TRAINING_YIELD_SHARE` 0.1
  (`server/src/core/game/training.ts`), and a fighter at it has yielded: 100 HP stops at 10. The training dummies (three,
  `DUMMY_SPOTS`) take nothing and each falls once a light, a heavy and a stab have each landed on it.
- Siphoning heals the attacker 10% of what was taken. A player with the dev cheat on takes nothing.

## Enemies

Each in `server/src/core/enemies/<id>.ts`.

| | Wild Boar | Grey Wolf | Bog Lurker | Kobold Swordsman | Kobold Greatsword | Kobold Shieldbearer | Goblin Warlock | Bram (spars only) |
|---|---|---|---|---|---|---|---|---|
| HP | 160 | 70 | 200 | 160 | 160 | 150 | 40 | 60 |
| Poise, regen a second, stagger | 36, 8, 1 s | 30, 12, 0.7 s | 100, 10, 1.2 s | 80, 10, 0.8 s | 80, 10, 0.8 s | 60, 8, 0.8 s | 20, 8, 1 s | 60, 10, 0.8 s |
| Walk | 3.2 m/s | 4.6 m/s | 1.5 m/s | 2.6 m/s | 2.6 m/s | 2.6 m/s | 2.4 m/s | 2.2 m/s |
| Pushback and Air taken (`knockbackFactor`) | 0.7 | 1 | 0.3 | 1 | 1 | 1 | 1 | 1 |
| Hits | bite 16, charge 30 | bite 15 | slam 38, tail 20 | slash + blunt: light 14 + 2, heavy 28 + 4; stab 8 | light 19 + 5, heavy 38 + 10; stab 10 (about 1.6 × as slow) | light 14 + 2, heavy 28 + 4; stab 8 | staff 5; Bolt Fire 8 + 10 burning | blunt: light 4.24, heavy 8.49 (both hands) |

- **Boar:** bites within 2.8 m (0.65 s wind-up), then can't again for 0.75 + 0.6 s; charges from 5-22 m (1.1 s wind-up,
  locking its aim 0.3 s before; 17 m/s for up to 1.6 s; no stagger while charging), first after 2 s, then 4.5 s after
  recovering or the wall's 2.2 s stun.
- **Grey Wolf** (`pounce`, `fight/behaviors/pounce.ts`): circles 4.5 m off at 3.2 m/s (closing in or backing off at
  its walk when further or nearer); 1.2 s plus up to 1.6 s more (rolled from the fight's seed) after each leap, and 1 s
  plus the same at the start, it crouches (0.6 s, tracking you, then locked 0.2 s before), leaps at 13 m/s for 0.35 s
  from within 6.5 m, biting within 1 m; then stands 0.45 s if the bite met you (taken or blocked) or 1.1 s if it met
  nobody, and hops back at 8 m/s for 0.3 s (2.4 m). No stagger from the crouch to the landing.
- **Bog Lurker** (`slam`, `fight/behaviors/slam.ts`): walks up at 1.5 m/s, turning 1.4 rad/s. Within 3 m and facing
  you, it rises (1.3 s, turning toward you at 1.2 rad/s until 0.35 s before) and slams: 2.6 m ahead, 60° either side,
  live 0.15 s; then it stands open 1.5 s. Within 2.8 m and more than about 73° off its facing (cos < 0.3), it coils
  (0.75 s) and sweeps its tail all round (live 0.2 s), then stands 1 s. 0.8 s after either before the next; the
  first after 1.5 s. No stagger from the rise or coil to the blow. A blocked slam costs 38 stamina (a dodge 30).
- **Kobolds:** a chain of 2 or 3 (even odds), each swing any of the 7 ways or a stab, never the same twice running,
  heavy 30% of the time, each timed as a player's swing with its blade (Swords: an opening 0.57 s, chained ones
  0.4-0.6, a heavy 0.36 s more, recovering 0.1 s), creeping up at a quarter of its walk while winding up and carried
  at 4 m/s while live, as a player (the body, under the sword); then 1.2 s before the next chain;
  first after 1.5 s. Walking up it blocks from 0.3 s in. Rolled from the fight's seed: walking up, it
  perfect-blocks 30% of a player's swings (rolled as each starts) and counters (Swing parries, Counters). A Bolt
  aimed within about 26° of it is side-stepped 60% of the time (8 m/s for 0.3 s: 2.4 m), at max(0.25 s, release time − 0.1 s) into its wind-up.
- **Kobold Shieldbearer:** the Swordsman with a Wooden shield in its left hand, so it blocks by the shield's rule (180°
  in front, 8% chip, its push × 0.6), and it swings as the Swordsman does, timed as a player's swing with its Kobold
  blade (it has no times of its own). A chain of 1 or 2, 1.5 s before the next; walking up it blocks from 0.2 s in,
  perfect-blocks 20% of a player's swings and never parries (its blade still meets a crossing blade as anyone's does).
  Its guard is its poise: 60, back 8 a second, so 5 blocked lights or 3 heavies in a row stagger it for 0.8 s. In the
  bot fights (seeds 1-10) a reader wins every one at full HP, and so does one who blocks its swings and presses
  heavies only in its openings; pressing whenever it isn't swinging wins 7 with heavies and every one with lights,
  with about a third of the HP left; one who only swings or only blocks loses every one.
- **Bram:** the Kobolds' rules, kinder: a chain of 1 or 2, heavy 20% of the time, the old stick swung as a player's in
  both hands (the table: felt 0.06, so every swing, a heavy's too, live at the 0.4 s floor, recovering 0 to 0.02 s),
  then 1.8 s before the next chain; first after 2 s; blocks from 0.35 s in walking up, perfect-blocks 10% of swings,
  never parries, never feints.
- **Goblin Warlock:** keeps 4-7 m away; pokes within 1.6 m (0.4 s wind-up, then 0.5 + 0.8 s before the next); casts
  within 14 m once its last cast's effects are gone and 1.2 s more have passed: Bolt Fire, adding Follow 1 time in 3 and
  Split 1 in 4, each rolled on its own.

## Encounters and drops

- **Tall grass** (`grass` in each region's file in `server/src/core/world/regions/`, rolled in
  `server/src/core/overworld/player.ts`): every `stepDist` 1 tile walked in it, a `chance` roll (0.12 on the Grass
  Field and in the Mistwood, 0.06 in the Waking Hollow); the enemy by weight (only boars so far). At 0.12, on average
  one every 8.3 tiles (1.7 s at 5 tiles/s), and 0.88^10 = 28% of the time 10 tiles pass without one; at 0.06, one
  every 16.7 tiles (3.3 s). None for `safeTime` 2 s after a fight.
- **Overworld enemies** come back `respawnTime` after their fight is over: the boar 8 s, the wolf 10 s, the bog lurker
  15 s, the others 12 s.
- **Drops** (`rollDrops`): each row rolled on its own, once per fallen enemy for the whole fight (the winners share
  it). Every enemy drops its own essence, always (chance 1). A boar, besides: meat 0.6, hide 0.35, tusk 0.25, so
  none of those 0.4 × 0.65 × 0.75 = 19.5% of the time, and 2.25 weight on average. A wolf: pelt 0.35, fang 0.6. A
  bog lurker: 2 scales 0.7, a bog pearl 0.05. The Kobolds and the warlock drop only their essence.
- **Treasure** (`treasure` in each enemy's file, `TREASURE` in `server/src/core/enemies/index.ts`): besides, one roll
  a kill for at most one treasure: below the uncommon chance an uncommon one, below that plus the rare chance a rare
  one, and so on to unique, picked at random from the tier's treasures (one sigil each so far). Chances a kill
  (uncommon / rare / epic / legendary / unique): boar 0.03 / 0.008 / 0.002 / 0.0005 / 0.0001; wolf 0.04 / 0.01 /
  0.0025 / 0.0006 / 0.0001; Kobold Swordsman and Goblin Warlock 0.05 / 0.015 / 0.004 / 0.001 / 0.0002; Kobold
  Greatsword 0.06 / 0.02 / 0.005 / 0.0015 / 0.0003; bog lurker 0.06 / 0.02 / 0.006 / 0.0015 / 0.0003. So a boar
  drops some treasure 4.06% of the time, a legendary one about 1 kill in 2000. A unique roll drops it only while it's
  free (nobody's held it within 7 days, and it lies in no pile and on no player online), else nothing.

## Healing and refills

- **Boar meat:** + 35% of the most HP (its `consumable`'s `healShare`; 35 at the start), once its `useTime` (1 s) is
  up, on the overworld or in a fight; refused at full HP. Bread + 20% (20), a health potion + 50% (50), the same way.
- **Stamina tonic:** stamina to full (`staminaShare` 1; 100 at the start), after 1 s; refused at full stamina, not at
  full HP.
- **HP regen:** vitality × health regen / 200 HP a second (0.5 at the start: empty to full in 200 s), on the
  overworld, in fights and in the arena after a win; in a fight, not for 5 s after any damage (`HP_REGEN_PAUSE_TIME`).
  Players only: enemies' health regen is 0.
- **Campfire:** within `REST_RANGE_TILES` 1.6 (+ `LAG_SLACK_TILES` 0.6 on the server): HP and stamina to full.
- **After a fight:** won, what it left you, at least 1 HP; lost, full HP and stamina (by the core after the death) on
  Highmere's platform; a duel gives back what you came in with.
- **In a fight:** meat (above), and skills: Self Water 0.3 D, Darkness 20% of its hit, Siphoning 10% of the
  damage you deal.

## Money and prices

- **Coins** (`COIN_VALUE`, `shared/src/items/coins.ts`): copper 1, silver 100, gold 10000, in copper. Written out
  largest first, leaving out what's 0: 12 345 copper is "1g 23s 45c".
- **Buying** (`server/src/core/content/shops.ts`): the item's worth (`ITEM_VALUES`, copper) × the region's
  `priceFactor` (Highmere 1.5, elsewhere 1), rounded; a player's first purchase at each shop × (1 −
  `FIRST_PURCHASE_DISCOUNT` 0.25), rounded. Bread, worth 4: 6c in Highmere, 5c the first time (4.5 rounds up). A sword,
  worth 300: 4s 50c, 3s 38c the first time.
- **Paying:** coins smallest first, as many of each as fit in what's left whole; if that's short, one more of the
  smallest coin that covers the rest, and the change in the fewest coins. 1g 30c for a 5c loaf: 5 copper, nothing
  back. 33c and 100s for a 3s 38c sword: 33 copper and 3 silver, then 1 more silver, 95c back.
- **Selling:** the worth × `SELL_SHARE` 0.4, rounded down, each: the old stick 2c, boar meat 2c, a hide 10c, a tusk
  16c, a wolf pelt 12c, a fang 6c, a lurker scale 8c, a bog pearl (worth 250) 1s.
- **Changing coins:** 1 for 100 of the next smaller, or 100 for 1 of the next bigger, no fee.
