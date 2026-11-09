# Formulas

The shape of every calculation that decides how the game plays, and the file that owns its numbers. The numbers
themselves live only in the code (and the tests read them from there). Units: seconds, metres and m/s in the arena,
tiles on the overworld. A fight runs in fixed steps (`FIXED_DT`), so its times round to those. Every stat is ×1 at the
average, `AVERAGE_STAT` (10); "s / 10" below means a stat over that average.

## Stats

`shared/src/battle/stats.ts`. A player's stats come from their core; an enemy's are in its file in
`server/src/core/enemies/`, grown by its area's core steps (Enemies). Every effect goes × (stat / 10)^power, the
power its row in `STAT_POWERS`. Damage's power is the bars' plus defense's, so fighters with equal stats take as many
hits to kill each other at every step.

- **HP** = `BASE_HP` (an enemy: its own `maxHp`) × (vitality / 10)^bar. **Stamina bar** = `BASE_STAMINA` ×
  (stamina / 10)^bar. Both whole.
- **Physical damage** × (strength / 10)^damage; **skill damage** × (skillpower / 10)^damage.
- **Walking and dodging** × (agility / 10)^move, in the arena and on the overworld.
- **Damage taken** × (10 / defense)^defense, special defense for skills.
- **Stuns and staggers** × (10 / toughness)^toughness. **Stamina refill** × (stamina recovery / 10)^staminaRecovery.
- **HP regen** a second = the most HP × health regen / 10 × `HP_REGEN_SHARE_PER_SEC`, paused after any damage
  (`HP_REGEN_PAUSE_TIME`); players only.
- **Carry limit** = `CARRY_LIMIT_AT_AVERAGE` × (strength / 10)^carry.
- **Pushback taken** (a player) = 1 / ((strength / 10)^a × (steadiness / 10)^b), clamped (`KNOCKBACK_TAKEN`); an
  enemy's is its own `knockbackFactor`.
- When stats change, a bar that grows adds what it grew; one that shrinks only cuts what's in it (`grownVitals`).

## The core

`CORE` in `shared/src/soul/core.ts`. Realms of steps, each finished by filling it with essence.

- **Fill to finish step n** = `firstFill` × `killGrowth`^(n − 1) × `realmEssenceFactor`^realm, the realm the step is
  in (0 for Yan). So step n takes `killGrowth`^(n − 1) times the first step's kills of foes of its own realm, whatever
  the foe. Essence past a step carries into the next; a whole core takes no more.
- **A step gives** every shown stat `firstRealmGain` × `realmFactor`^realm, the hidden ones `hiddenGain`, and
  `firstRealmPoints` × `realmFactor`^realm free points.
- **Death** takes the step's fill, or with none the step; points over what's left come off the biggest stats first.
- **Essence** per monster is its item's `essence` effect (`shared/src/items/items.ts`), and it drops
  `realmEssenceFactor`^realm of them, the realm of the core steps it has grown by (`essenceFactor`).

## Inscriptions and blessings

- **Slots** = 1 + steps + floor(steps / 3) (`inscriptionSlots`, `shared/src/soul/inscriptions.ts`); each inscription
  is a permanent status (`STATUS_DEFS`, `shared/src/battle/statuses.ts`).
- **Carving** costs coins and essence by the sigil's rarity (`CARVE_PRICES`); removing costs a multiple of it
  (`REMOVE_PRICES`), both in `server/src/core/content/shops.ts`.
- **Blessed** while faith with a god ≥ `BLESSING_FAITH` (`shared/src/soul/blessings.ts`); faith grows by quest
  rewards. Each blessing is a permanent status.

## Weapon attacks

`CHAIN`, `MOMENTUM`, `HYBRID` in `shared/src/weapons/hybrid.ts`; `STRENGTH_QUICKENING`, `STRENGTH_DISCOUNT` in
`shared/src/weapons/weapons.ts`; each class's base table (per strike: wind-up, live, recovery, cost, typed damage,
poise damage; then whiff and feint recovery, raise time, parry weight, length, `minStrength`) in
`shared/src/weapons/tables.ts`, each weapon its class's table with its own fields over it (`ITEMS`).

- **Grip strength** = the wielder's strength × `TWO_HAND_STRENGTH_FACTOR` for a lone melee weapon held in both
  hands, else their own (`appliedStrength`, `shared/src/weapons/kinds.ts`). It's the strength in every weapon
  number below; the body's numbers (carry, pushback, walking) keep the wielder's own.
- **Wielding**: a weapon goes into a hand only if every weapon held after reaches its `minStrength` at its grip
  strength (`unwieldableHand`, checked in `moveGear`); when strength drops (points taken back, an inscription
  removed) or a save loads, one under it goes into the bag, or a pile at their feet (`shedUnwieldable`).
- **Quickening** = 1 − min(`STRENGTH_QUICKENING.max`, `perPoint` × points of grip strength over `minStrength`), never
  over 1 (`strengthTimeFactor`). Every time of a weapon's goes × it; a shield has no minimum and is never quickened.
- **Weapon tiers** keep their table and raise only `quality` (damage): a better sword hits harder, not quicker.
- **Wind-up** = max(`CHAIN.minWindupTime`, the strike's table wind-up × `CHAIN.windupShare` × quickening), the share
  by how the swing follows the same hand's last (opening, reverse, another line, perpendicular); a stab's is its own
  in any chain (`windupTime`, `wayStepsAfter`). Live and recovery are the strike's × quickening; a whiff adds the
  weapon's `whiffRecoverTime` × quickening (`weaponTime`).
- **Chaining**: a swing chains if it starts within `gapTime` of either hand's last; each hand keeps its own chain.
- **Momentum** gains by chain kind up to `MOMENTUM.max`; a swing deals × min(`maxDamage`, 1 + `damagePerPoint` ×
  momentum); a stab × (1 + `stabBonusPerPoint` × momentum) and spends it.
- **A strike** deals its table's typed damage (a swing slash and blunt, a stab only stab) × quality × momentum, each
  type × physical damage at grip strength (Stats) and taken on its own (`strikeDamage`); its poise damage is the
  table's. A weapon's shown damage is its light's swing and its stab's stab (`weaponDamage`).
- **Stamina** = the strike's table cost × the strength discount (`strikeCost`): 1 −
  min(`STRENGTH_DISCOUNT.max`, `perPoint` × points of grip strength over `minStrength`), never over 1
  (`strengthDiscount`). It never grows with the core while the bar does, so stamina matters less as you grow.
- **Reach** = (arm reach + blade length) × the swing's or stab's reach factor, in an arc by the swing's line
  (`wayShape`).
- **The body**: walking × `swinging.moveFactor` from press to recovery, carried at `lungeSpeed` while live, the live
  blade's turn capped (`liveTurnRadPerSec`), a whiff carried on through its longer recovery (`whiffCarrySpeed`).
- **Enemies** swing through the same functions from their weapon and strength; their def holds only pacing.

## Bows (placeholder)

`BOW` and its functions in `shared/src/weapons/bow.ts`; the bow class's table (draw times and cost, arrow damage,
`powerMps`) in `shared/src/weapons/tables.ts`; a quiver's `pack.holds` in `ITEMS`.

- **Draw** costs the bow's `draw.cost` × the strength discount; full after `draw.fullTime` × quickening; a release
  before `draw.minTime` × quickening looses then.
- **Damage** = the bow's damage × (`minDamageShare` + (1 − `minDamageShare`) × share drawn) × physical damage
  (Stats).
- **Speed** = `powerMps` × (t² + 2t) / 3, t the share drawn (Minecraft's draw curve).
- **Flight**: dv/dt = g − k v (gravity and drag, `flightAfter`), solved exactly each step; unlocked it leaves straight
  for the crosshair's spot, locked on in the low arc that meets the target (`launchAt`).
- **Nocking** waits `nock.quiverTime` with arrows in the quiver, else `nock.bagTime`.

## Body blows

An enemy's lunge, charge, pounce, slam or sweep: its `damage` × physical damage (Stats), all blunt. Each blow's damage,
reach and knockback are in the enemy's file (`server/src/core/enemies/<id>.ts`).

## Hits and pushback

`fight/combat.ts`, `fight/weapons/defend.ts`.

- **A hit that lands only hurts**: no push, no stun. A player then has `hurtInvuln` (`PLAYER`) and loses momentum.
- **Only a block pushes**: blocker speed = the hit's knockback × resistance × `HYBRID.block.pushbackFactor` × the
  guard's `pushFactor`. The hit's knockback is `knockbackSpeed` per strike, an arrow's share of its speed, a body
  blow's own. Statuses can scale resistance.

## Blocks

`HYBRID.block` and `GUARDS` in `hybrid.ts`; `fight/weapons/defend.ts`.

- **Held block**, from in front: chip = damage × the guard's `chipFraction`; stamina = damage (× `heavyStaminaFactor`
  for a heavy) × the guard's `staminaFactor` × (10 / grip strength)^blockStamina (`blockStaminaShare`). A hit that
  takes the last stamina breaks the guard for `brokenTime`. Holding drains `holdStaminaPerSec`. An enemy pays the
  hit's poise.
- **Against a wall**, chip × (1 + (`pinnedChipFactor` − 1) × the share of the slide the wall stops).
- **Raise time** = the guard's own `raiseTime` × quickening (`guardRaiseTime`).
- **Perfect window** = `perfectTime` × blade length / `perfectAtLengthM` (`perfectBlockTime`), opened by a press not
  within `remashTime` of the last. Blocked perfectly, the attacker loses `perfectDrain` and recoils
  `perfectRecoilTime`.
- **Feint**: block in a heavy's wind-up before `feint.cutoffTime`, for `feint.cost`; that hand recovers
  its weapon's `feintRecoverTime` × quickening.

## Swing parries and counters

`HYBRID.parry` and `HYBRID.counter` in `hybrid.ts`; `fight/weapons/parry.ts`, `fight/behaviors/weapon.ts`.

- **Angle**: the exact reverse way is a full parry, near it a partial one (`parryKind`); stabs never parry.
- **Window** = `windowTime` × blade length / `perfectAtLengthM` (`parryWindowTime`); blades live within `clashTime`
  of each other clash, staggering both `clashStaggerTime`.
- **Weight** = the blade's `parryWeight` × √(grip strength / 10) × `heavyWeightFactor` for a heavy (`swingWeight`).
- **Recoil** = max(`minRecoilTime`, base × clamp(parrier's weight / parried's, `minRatio`, `maxRatio`))
  (`parryRecoilTime`); parried or perfect-blocked by a swordsman that counters, `counter.recoilTime`.
- **A counter** winds up as an opening swing with the swordsman's blade and waits for its cooldown.

## Poise and stagger (enemies)

`fight/behaviors/brain.ts`; `poise`, `poiseRegen`, `staggerTime` in each enemy's def. Each hit (blocked too) takes its
strike's poise damage; poise refills at `poiseRegen`; at 0 the enemy is staggered `staggerTime` × 10 / toughness. Any
stun or stagger ends the attack under way and its attacks wait their whole cooldown after it
(`fight/behaviors/common.ts`).

## Stun and invulnerability (players)

`PLAYER` in `shared/src/battle/player.ts`. Only earned staggers stun a player: a broken guard, being blocked
perfectly, a parry's recoil, a clash. After a weapon or body hit, `hurtInvuln`. A dodge's i-frames run from
`dodge.iframeStart` to `iframeEnd`, counted in steps; the next dodge waits `dodge.cooldown`. Skills hurt through
i-frames, invulnerability and blocks.

## Stamina

`PLAYER`; the controller in `fight/player/controller.ts`. Refill = `staminaRegenPerSec` × stamina recovery's factor
(Stats) × statuses, starting `staminaRegenDelay` after an action ends, not while attacking, dodging, casting, blocking
or staggered; not on the overworld. Any stamina above 0 starts an attack or a dodge; a skill needs its whole cost.
Costs: strikes (above), a held block and blocked hits (Blocks), `PLAYER.dodge.cost` × burden, skills (below).

## Movement

- **Arena**: `PLAYER.moveSpeed` × agility factor × burden pace × statuses, slowed while attacking or casting.
- **Dodge**: a speed easing from `dodge.speed` to `endSpeed` over `duration`, × agility factor.
- **Jump**: `jumpSpeed` against `GRAVITY`.
- **Enemies** approach at `walkSpeed` × agility factor, slowed by the angle to the target and near it, or keep away
  (`keepAway`).
- **Overworld**: `PLAYER_SPEED` (`server/src/core/world/world.ts`) × burden pace × agility factor.

## Carry limit and burden

`BURDEN` in `shared/src/items/burden.ts`. Weight = everything carried and worn (the cloth weighs nothing). Light up
to the carry limit; heavy over it (dodges × `heavyDodgeCost`); overloaded over `overloadedAt` × it (no dodging,
walking × `overloadedPace`).

## Skills

`SKILL` and `skillCost` in `shared/src/skills/skill.ts`; `SKILL_EFFECTS` and `shotOf` in `shared/src/skills/effects.ts`.

- **Cost** = Σ over segments (form + elements + modifiers at their word costs) × `chainGrowth`^(segments − 1).
- **Release time** = base + per word.
- **D** (a skill's base damage) = `SKILL_EFFECTS.damage` × skill damage (Stats) × the caster's damage dealt.
- **A hit** = Σ over its elements share × D × factor (no element: a plain share); factor = the modifiers' product
  (Amplify up, Split down) × the Form's share (a Beam tick, a cloud pulse, an Imbue hit). Statuses go on in full.
- **Modifiers** apply in order to the shot built so far: a "×" one compounds, a "+" one adds (`shotOf`).
- **Reactions** check after the stage's statuses go on, each with a cooldown per target.
- **Statuses** multiply their stat factors per stack and across statuses (lifesteal adds); put on again, a status
  keeps the longer time and gains a stack up to its cap (`STATUS_DEFS`). The product stops at `MOD_CAPS` (damage
  dealt, damage taken, stamina refill, attack and dodge costs), however many buffs are on; a 0 (the First Door's
  damage taken) stays 0.

## Damage taken

`hurt` and `hurtPhysical` in `shared/src/battle/fight/health.ts`. Dealt = damage × the attacker's statuses; taken =
dealt × the defense factor (Stats) × the target's statuses, less any shield, never below 0; each damage type is taken
on its own. A spar floors HP at `TRAINING_YIELD_SHARE` of the most (`server/src/core/game/training.ts`).

## Enemies

Each enemy's HP, poise, speeds, attacks, pacing, drops and overworld behaviour are in
`server/src/core/enemies/<id>.ts`; their behaviours' rules in `shared/src/battle/fight/behaviors/`.

- **Grown by core steps** (`enemyAt`): an enemy met in a region is grown by its `enemySteps` (a spawn's own `steps`
  first): its stats gain what a core's gain over that many steps, and its HP goes by its vitality as a player's.
  Training spars are never grown. Swordsmen take
their timing from their weapon and strength (Weapon attacks); beasts keep their own attack timings.

## Encounters and drops

- **Tall grass**: every `stepDist` walked in it, a `chance` roll; the enemy picked by weight from the region's
  `grass` table (`server/src/core/world/regions/`); none for `safeTime` after a fight.
- **Respawn** `respawnTime` after the enemy's fight is over (its file).
- **Drops** (`rollDrops`, `server/src/core/enemies/index.ts`): each row rolled on its own, once per fallen enemy for
  the whole fight; essence always.
- **Treasure**: one roll a kill against cumulative per-tier chances (the enemy's `treasure`), picking from the tier's
  `TREASURE`; a unique only while it's free.

## Healing and refills

Consumables heal a share of the most HP or refill stamina once their `useTime` is up (`consumable` in `ITEMS`); HP
regen (Stats); a campfire refills both within `REST_RANGE_TILES`; skills heal by element (Skills).

## Money and prices

`COIN_VALUE` in `shared/src/items/coins.ts`; the rest in `server/src/core/content/shops.ts`.

- **Buying** = worth (`ITEM_VALUES`) × the region's `priceFactor`, × (1 − `FIRST_PURCHASE_DISCOUNT`) the first time.
- **Selling** = floor(worth × `SELL_SHARE`).
- **Paying** takes the smallest coins that fit, then one coin that covers the rest; change in the fewest coins.
- **Changing** is 1 coin for 100 of the next smaller, or back, no fee.
