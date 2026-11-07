# Sword Combat — Design Spec v2

The user's spec (Nov 5, 2026), then the user's decisions for Phase 1, which override it where they differ.

A first-person, mouse-driven melee system where every weapon is a point in a three-stat space and every loadout's
identity emerges from what sits in each hand. Stamina is the only resource; fights are won by reading the opponent,
not out-twitching them.

## What it is

One modular melee system, played in first person, with the sword driven by the mouse rather than by a menu of canned
animations. The player has a light, a heavy, and a stab; a held block with a tight perfect-block window; a
swing-parry; and a dodge. Swing direction comes from a quick mouse flick across seven directions (no upward swing).

There is one resource: stamina. Attacking, blocking, parrying, feinting and dodging all spend it, and running dry
breaks your guard. Blocking is the safe defence; parrying with your own swing is the riskier, higher-reward one.

Every weapon is defined by three numbers — weight, reach, and damage type — and nothing else. Hold Q to switch which
hand you control, so a dagger in one hand, a dagger in both, a sword and shield, a lone longsword, or a two-handed
greatsword are all the same system reading different stats. Weapon and loadout identity is meant to emerge from those
stats and from what sits in each hand, not from bespoke per-weapon rules.

## The aim

Four pillars. Every mechanic should serve at least one of them, and any mechanic that fights them loses.

1. **Readable above all.** Every time a player loses an exchange they should know why — "parried too early," "he
   feinted me," "I overextended." The blade can be fast; intent must be slow. This is the pillar that overrules the
   others, because unreadable chaos is the single thing most likely to sink the game.
2. **Self-balancing through stats.** Because weapons are just three numbers, the stats themselves must keep weapons
   roughly even. Weight is the master dial: a heavier weapon is slower and costs more stamina but hits harder, so
   damage-per-second normalises on its own and the difference between weapons becomes feel, not power.
3. **Identity emerges, it isn't authored.** Dual-wield, sword-and-shield, lone longsword and greatsword should each
   play differently as a consequence of the stat and hand rules, with no special-case code. Short reach is the
   inside-fighter rule; a shield off-hand is the defensive build.
4. **No stunlock.** A weapon hit does damage only — no knockback, no stun — and the victim gets brief invulnerability
   afterwards. Fights are decided by reads and stamina, never by catching someone in a loop they can't escape.

## The feel

A single exchange should feel like a committed, weighty guessing game, not a flurry of clicks. The blade carries
momentum: it is slow to start and slow to stop, so throwing an attack is a decision you can be punished for, and
whiffing carries your body forward into a natural counter.

The moment-to-moment loop is a read. The attacker chooses light, heavy, stab, or feint; the defender chooses block
(safe, hard timing), swing-parry (risky, easy timing), or dodge. Both are watching the wind-up for the tell. A fight
is won in those small bets, the same place fencing, For Honor, and Mordhau find their fun.

Impact has to land physically — hit-stop, sound, and a bit of weight on contact — or a connecting sword feels like a
stat ticking down. This is the part no spec can promise; it is found by hand in the prototype, and it matters more
than any number below. The target is simple: after a fight, the player wants to go again.

## The modular model

The heart of v2. A weapon is three stats, and a loadout is two hands. Everything else is read off those.

**Three stats, three roles.**

| Stat | What it drives | The identity that emerges |
|---|---|---|
| Weight | Speed, stamina cost, and damage, all at once — heavier is slower, costlier, harder-hitting | The master dial; keeps DPS roughly even so weapons differ in tempo, not power |
| Reach | The distance your edge connects (stab reaches further) | Spacing identity for free — short reach must close in, long reach controls range but is weak inside |
| Damage type | How a hit interacts with guards and armour | The rock-paper-scissors axis (see below) |

**Weight is the master dial.** In v1, weight only touched speed and stamina, so a light weapon was strictly better.
In v2, weight also drives damage: hitDamage ∝ weight, on top of strength and the heavy/stab multipliers. A dagger
swinging twice as fast for half the damage is now a choice, not a free win.

**Damage type** is the third axis, resolved against the defender's guard and armour:

| Type | Against guards / armour | Role |
|---|---|---|
| Cut | Normal | Generalist |
| Pierce | Ignores some block-through and finds gaps | The answer to shields and heavy armour |
| Blunt | Ignores most armour; bigger guard-stamina drain and pushback | The answer to heavy guards |

**Two hands make the loadout.** Q switches the hand you control, instantly — the free weave between hands is the
whole point of dual-wield. Each hand runs its own momentum chain and its own recovery timer, and that per-hand
recovery is the real cap on attack rate: you can't swing a hand that's still recovering, so a dual-wielder weaves
between two recovering hands while a single-weapon user waits on one. A swap never cancels the other hand's recovery
or your current attack's recovery, so it can't be used to escape an overextension punish. Q only matters when both
hands hold weapons — with a shield or an empty off-hand there's nothing to swap to, so your guard (read from your
off-hand) stays put. Single vs twin weapon then falls out with no extra rules:

- **Lone weapon** (off-hand empty): the one-blade guard — 140° coverage, 20% damage through, normal stamina.
  Balanced.
- **Dual-wield** (a blade in each hand): swing one hand, swap instantly, swing the other while the first recovers —
  higher sustained tempo, but the worst guard in the game (two-blade: 140°, 32% through, ×1.35 stamina), double
  drain. Each hand keeps its own momentum chain, so the weave stays pure pressure — you just forgo the lone weapon's
  cleaner guard and bigger single-hand cash-out. Aggressive and fragile.
- **Weapon + shield** (shield off-hand): the best guard (180°, 8% through, ×0.6 stamina), paid for by giving up the
  off-hand attack and the shield's swing-parry — it only blocks. Defensive.
- **Two-hander:** one weapon, both hands, high weight and reach — the one-blade guard, but power and spacing. Slow and
  dominant at range. Built as decision 9 (below): any lone melee weapon is held in both hands, for 2× strength.

## Attacks

**Directions.** Seven flick directions: across both ways, down from the top, and four diagonals. No upward swing.
When locked on, attacks go where you face. Width of the hit depends on direction (160° across, 110° diagonal, 60°
overhead, 16° stab), so a wide across-swing trades precision for coverage.

**Timing.** Each attack is wind-up (readable) → live blade (~0.1 s) → recovery (~0.08 s). Wind-up depends on how the
swing follows the last one: an opening swing or one after a stab is slowest, a reverse swing is fastest, a
perpendicular change slowest of the chained options. Weight scales every timing by how heavy the wielder feels the
weapon: feltWeight = (weight / the Basic Sword's) × 10 / strength, one linear rule for every weapon, so strength
lightens a light weapon as much as a heavy one; the floor below is what keeps anything from going superhuman.

**The hard floor — the reactability guarantee.** After all scaling, every wind-up passes through one clamp:

```
finalWindup = max(0.40 s, computed)
```

No combination of strength, light weight, or momentum can ever produce a swing faster than 0.40 s. Because the system
is modular and you can't hand-check every possible weapon, this single clamp is what keeps every attack reactable.
Human reaction is ~0.22 s; a 0.40 s wind-up leaves a real window to read the direction and respond.

**Momentum pays in damage, not speed.** A swing chains if it starts within 0.25 s of the last ending. Each chained
swing adds momentum (reverse +0.25, another direction +1, perpendicular +0.5, capped at 4) — note the gradient rewards
varying direction, so the strong play is an unpredictable, hard-to-mirror-parry string rather than metronoming one
line. Crucially, momentum no longer speeds up the wind-up (that both kept the floor honest and killed the one-button
spam meta). Instead:

- Each point of momentum gives +25% damage (capped at ×2).
- A stab spends all momentum for +50% damage per point — the cash-out. Bank it or spend it is the core offensive
  decision.
- Dodging, blocking, casting, getting hit, or being perfect-blocked breaks the chain.

**Damage.** Base scales with weight and with √(strength/10); a heavy does ×2, a stab ×1.25. Target lethality: a clean
unarmoured hit is near-lethal, duels end in a handful of clean hits, so every read matters.

**Body.** You walk at 25% while attacking, and a live blade carries you forward at 4 m/s. A whiffed committed swing
overextends you — forward carry plus extra recovery — which is the natural punish for throwing wildly. Turn rate is
capped during the live phase so you can drag and accelerate a little for timing mixups, but can't do 180° spins that
break readability.

## Defence

Four tools, two of them skill-expressions that sit at opposite ends of the risk scale.

**Held block** covers your front and drains stamina while held. A blocked hit costs stamina equal to its damage
(double for a heavy) and still lets a share through; if a hit takes your last stamina your guard breaks and you're
staggered 0.8 s. Raising the guard isn't instant (fast with a sword, slow with a greatsword). Guard coverage and
leakage come from your off-hand:

| Guard | Damage through | Stamina | Pushback | Coverage |
|---|---|---|---|---|
| Shield | 8% | ×0.6 | ×0.6 | 180° |
| One blade | 20% | ×1 | ×1 | 140° |
| Two blades | 32% | ×1.35 | ×1.2 | 140° |

**Perfect block** (safe, hard timing). Press block in a tight window just before impact (~0.2 s with a sword, longer
for longer blades). You take nothing; the attacker loses stamina and recoils 0.4 s. Mashing is locked out — pressing
again too soon opens no window. This is the low-risk defence with the demanding timing.

**Swing parry** (risky, easy timing). Meet their swing with yours: the exact reverse direction is a full parry, within
45° is a partial, and stabs never parry. The window is deliberately more generous than the perfect block (~0.3 s
sword, ~0.38 s longsword, ~0.52 s greatsword), but you pay for it by committing a swing. A full parry recoils them
0.8 s and opens them up; if both blades go live within 0.05 s it's a clash and both stagger. Note: because there's no
up-swing, overheads have no reverse and so can't be swing-parried — only blocked. That makes the overhead the honest,
un-cheese-able attack by design.

**Feint.** Press block during a heavy's wind-up to cancel it into a block for stamina. It costs enough, with enough
recovery, that it's a tool and not spam.

**Dodge.** ~3.8 m over 0.42 s for 30 stamina, invulnerable only from 0.05–0.25 s, with a short cooldown. Expensive and
tightly-windowed on purpose — a read, not a panic button.

## Weapons

Starting values, all derived from the three stats — tune from here. Weight is relative to the Basic Sword (1.0 here;
its heft in the game is 3.0, so a heft is the weight × 3); reach is the full edge reach; damage type sets the
guard/armour interaction. These are points in the stat space, not special cases.

| Weapon | Hands | Weight | Reach (m) | Type | Plays like |
|---|---|---|---|---|---|
| Dagger | 1 (or 2 for twin) | 0.45 | 1.4 | Pierce | Fast, cheap, must close in; twin = tempo + fragile guard |
| Basic Sword | 1 | 1.0 | 2.2 | Cut | The baseline; flexible generalist |
| Longsword | 2 | 1.3 | 2.5 | Cut | Reach and power, the easiest parry windows, slower guard |
| Greatsword | 2 | 1.9 | 2.9 | Cut | Slow, heavy, very readable, dominant at range |
| Mace | 1 | 1.5 | 1.9 | Blunt | The armour-breaker; big guard drain and pushback, punishing whiff |
| Shield | off-hand | — | — | — | Not a weapon: the 180° / 8%-through guard, no off-hand attack |

Read the table as tradeoffs, not tiers: the dagger's 0.45 weight makes it fast and cheap but low-damage and short, so
it lives or dies on closing distance and the stab cash-out; the greatsword's 1.9 makes it slow and expensive but it
out-reaches and out-hits everything, so it loses when someone gets inside. Pierce and blunt exist to answer the shield
and heavy guards respectively, so no single defensive loadout is safe against the whole roster.

**Open question:** fix the game's max stamina (everything is costed against it). At ~100, a duel runs roughly six to
seven committed swings deep before guard-break territory, which feels about right — pin the number before the first
balance pass.

## What to avoid

The specific failure modes, each with the symptom and the guard already built against it.

1. **Unreadable chaos.** The thing that pushed Half Sword's early access to mixed reviews: physics and ragdoll
   overwhelming the read, so losses feel random. Guarded by the 0.40 s wind-up floor and clear directional tells. If a
   fight ever feels arbitrary, fix this before anything else.
2. **Incentive-stacking on one option.** If the fastest swing is also the highest-momentum and the easiest to use,
   everyone metronomes it and the meta flattens (Mordhau feint-spam, the v1 reverse-swing stack). Guarded by splitting
   the gradients: reverse is fast but low-momentum, varying direction builds momentum, and momentum no longer buys
   speed.
3. **Neglecting feel for numbers.** A balanced spec with no hit-stop, weight, or sound is not fun. Feel is ~80% of
   melee enjoyment and lives only in the prototype. Don't tune the stat table before the single sword feels good to
   swing and land.
4. **Flat offense.** With no stun and 0.6 s victim-invuln, landing a clean hit can feel like nothing happened. Watch
   for this specifically in playtest — the reward is tempo (their chain breaks, yours survives), and if that doesn't
   read as an advantage, it's the first thing to fix.
5. **Scope creep.** Physics melee plus modular spellcrafting plus projectiles plus many weapon classes is several
   games' worth of surface area, and the netcode alone is hard. Prove the core duel — one weapon, block,
   perfect-block, parry, dodge, against one hand-tuned enemy — feels good before building anything else on top.
6. **PvE that doesn't earn the system.** The combat is built for a mind; against dumb AI it collapses into "block,
   wait, repeat." Enemies have to feint, mix up, and bait parries (the Kobold is hand-tuned for exactly this). PvE fun
   is a function of enemy-AI effort, not the combat rules — budget for it or keep PvE small.
7. **Ignoring latency in PvP.** A 0.40 s window is reactable offline but shrinks by your ping online. Budget parry and
   perfect-block windows against latency from the start, or fast attacks become unreactable on even moderate ping and
   the whole read layer breaks for online play.

## The user's decisions (Phase 1 only)

These override the spec above where they differ.

1. Hits do damage only. A hit with the guard down: no knockback, no stun, then the existing 0.6 s post-hit
   invulnerability. This protects the player from being looped. Enemies still stagger when their poise breaks (#319's
   system stays). That's the reward the player earns by landing hits, not a stun from a single hit. Players have no
   poise stagger.
2. Blocking still pushes you back (#316 stays): ~5 cm on a light, ~19 cm on a heavy; guard push factor (shield ×0.6,
   one ×1, two ×1.2); strength/steadiness resist it (0.25–2×); wall pin doubles chip. Pushback is movement only: it
   must never lock controls (you can turn, block, step and attack while sliding). Don't let it become a wall loop: you
   can always act while pinned.
3. Hit-stop is local: the attacker's blade and a touch of camera stop for ~50 ms on contact. The fight never pauses
   ("nothing should ever pause the whole fight").
4. Weapon weight: the Basic Sword is the measure (every weight was rescaled by 1/1.3, then tripled, the user: "for all
   swords, triple their weight"; the shield and the bow too, so every weight is on one scale: the Basic Sword, the
   Kobold blade, the Wooden shield and the training bow 3.0, the longsword 3.57, the greatsword and the Kobold
   greatsword 4.86; the old stick halved instead, to 0.385, and its damage 5 to 3: "half the weight of the stick. it
   shouldnt be doing that much damage either"). Felt = (weight / the Basic Sword's) × 10 / strength, one linear rule
   for every weapon and guard, light ones included (it replaced felt = weight under 1 and max(1, 1 + (weight − 1) ×
   10 / strength) over it), so the Basic Sword feels 1.0 at strength 10, 2.0 at 5 and 0.5 at 20. Wherever weight
   sets a time it's the felt weight. A light weapon's low weight lowers its wind-up, down to the floor.
5. Every final wind-up = max(0.40 s, computed). Raise the base times and keep the spread, don't flatten it to the
   floor. Basic Sword at strength 10: reverse 0.40, other 0.48, perpendicular 0.60, opening/after a stab 0.56; heavy
   opening stays ~0.92 (#317 feel); stab 0.45. Live 0.13 s, recovery 0.10 s (today's post-#317 sword values).
6. Momentum pays in damage only (+25%/point, cap ×2; stab cashes out +50%/point), it no longer shortens wind-ups.
7. Phase 1 only: one sword duel that feels good. No damage types, armour, dagger/mace, three-stat weapons, enemy AI
   feints or latency budgets (that's Phase 2). Q stays an instant tap.
8. The sword is renamed the Basic Sword: the base, comparison weapon, weight 3.0 (felt 1.0 at base strength, 10),
   every other weapon measured against it. Its stored item id stays `sword`, so saves and inventories don't break.
9. Two hands (after Phase 1): a melee weapon with the other hand empty is held in both, automatically ("the two handed
   sword is just when only 1 sword is equipped, it auto sets that as two hands"), and the grip puts 2× the strength into
   the weapon ("it increases strength applied to the weapon by 2x? that would mean 1 handed sword blocks is worse"),
   through the same math as any strength, no table of its own: felt heft (so every time and cost), damage (√2), the
   guard's raise and a parry's weight. A block's stamina goes × 10 / that strength for every guard, so a two-handed
   block costs half and a stronger fighter blocks more cheaply; chip stays the guard's. Enemies alike, but the Kobolds
   stay one-handed ("i want the kobalts to stay one handed"). With felt heft linear in 1 / strength, two hands halve
   every weapon's, the Basic Sword's too (0.5 at strength 10, its lights at the 0.4 s floor); kept at 2× after that
   rule, not retuned.

## Notes from building Phase 1

- Recovery is one mechanism, kept per hand (`HandChain.recoverSteps` beside the swing's own recovery): a swing's
  recovery, a whiff's longer one and a feint's all land on the hand that swung, and that hand can't swing until it's
  over; with a blade in each hand the other may. There's no per-fighter feint counter.
- #322's felt-heft numbers were rescaled with the Basic Sword at 1: a feint recovers 0.38 s × felt heft (was 0.3 ×
  the old 1.3, so the Basic Sword's stays 0.38 s at strength 10), and a whiff adds 0.2 s × felt heft (0.2 s with the
  Basic Sword at strength 10).
  A whiff still holds the whole body (no dodge, block, switch or other hand) until it ends, as #322 has it.
- Enemies swing by the player's math (the user: "nobody should have any special preset table that differs from the
  math"): the swordsmen's def `windup`, `chainWindup` and `recover` (and #325's × 1.3 on them) are gone; a Kobold, the
  Kobold Greatsword and Bram wind up, swing and recover through `windupTime`, `chainKind` and `wayStepsAfter` from
  their weapon and strength. To make one easier or harder, change its weapon or stats, or its pacing (cooldown, chain
  length, chances).
- A swordsman's counter (after it parries or perfect-blocks) winds up as a player's opening with its blade and waits
  its cooldown like any swing; the one it beat recoils 0.25 s (`HYBRID.counter.recoilTime`), so the counter can be
  blocked or dodged. FORMULAS.md, "Swing parries", has the numbers.
- Decisions 1 and 2 (#326) pin the open question on stamina: the bar is 100 at the start (10 a point), and a save
  with more loads cut to it. FORMULAS.md, "Hits and pushback", has the rules.
- Damage types are built as numbers and display only (the user's names: slash, stab and blunt for cut, pierce and
  blunt): a weapon's three come from 3 × heft × quality split by its profile, a swing dealing slash and blunt and a
  stab only its own stab (no × 1.25), so damage still scales with weight. Swords stab weakly; rapiers and spears, to
  come, are the stab weapons. How each type meets guards and armour (the table above) is still open, for armour.
  AGENTS.md, "Damage types", and FORMULAS.md, "Weapon attacks", have the rule and the numbers.
