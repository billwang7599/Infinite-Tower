# Combat styles

Three more ways to fight with a sword, picked with the per-player Combat style setting next to For Honor and the
Hybrid. The user: "come up with some other combat styles that feel fun and realistic. im thinking we have to both
read the opponent and also reward good weapon play. search online for existing games and their mechanics. we can also
add in/mix in stuff", and "make any assumptions you want". Everything below is the agent's design, built overnight
one PR per style in the order given, for the user to play and retune. None of it is built yet.

## Survey

What makes reading the opponent and handling the weapon matter in each:

- **Mordhau**: windup then release; parry (tap, short window) and riposte; chamber (mirror their attack to block
  and strike at once); feints and morphs (stab to swing) late in the windup; drags and accels (turning the camera
  moves when the blade lands). Reading is timing the release; weapon skill is bending it.
- **Chivalry 2**: much the same (parry, riposte, counter by mirroring, feints, drags), held block drains stamina.
- **For Honor**: three guard sides; matching blocks free; heavy-timed parries, guard breaks, feints; the guard
  indicator makes reading explicit. (Built here.)
- **Kingdom Come: Deliverance**: a five-zone rose (four in KCD2) plus stab; any block stops a frontal hit, a perfect
  block at the last moment then a strike is a master strike that goes through; combos are set direction sequences;
  feints by switching zone just before the strike; stamina is defence. KCD2 cut the zones to lower the floor.
- **Exanima**: physics drives the body and blade; damage comes from momentum (step into the swing, turn into it),
  spacing decides which part of the weapon lands. Weapon skill is everything; reading is spacing and baiting.
- **Sekiro**: posture beside HP; tap guard about 0.2 s (12 frames) before a hit to deflect, spamming shrinks the
  window to 4 frames (reset after 30 frames or a deflect); deflects build the attacker's posture, a broken posture
  opens a deathblow; posture recovers slower at low HP; perilous attacks (thrust, sweep, grab) each have one answer
  (Mikiri step-in, jump, dodge). Reading is rhythm and attack type.
- **Bushido Blade**: no health bars: hits by location (head and torso kill, a leg makes you crawl, an arm goes
  limp); high, mid and low stances; weapon weight sets speed. Reading is stance and distance.
- **Nidhogg**: rapiers at three heights; the same height blocks a lunge; moving your blade into the height of their
  lunge disarms them; one hit kills; unarmed you punch, and you pick a blade up by walking over it. Pure footsie.
- **Half Sword**: the mouse moves the arms; damage from speed and edge alignment; half-swording to thrust through
  armour gaps. Weapon skill is the whole game.
- **Hellish Quart**: blades block each other physically; mocapped HEMA techniques; one deep hit ends a round, and
  double kills happen. Reading is distance and timing.
- **Absolver**: four stances; every attack in your deck moves you to another stance, so your stance tells which
  attacks can come; one defensive trick per style (parry, absorb, dodge).
- **Blade Symphony**: fast, balanced and heavy stances (heavy wins a blade clash over balanced, balanced over fast),
  each with its own pose; holding attack charges tiers, a tier 2 released early catches a defender waiting for 3.
- **Mixed in from elsewhere**: Nioh's Ki Pulse (a tap timed at the end of a combo gives stamina back), and
  Liechtenauer's longsword (the four guards Vom Tag, Ochs, Pflug and Alber, and the master cuts: Zwerchhau breaks Vom
  Tag, Krumphau Ochs, Schielhau Pflug, Scheitelhau Alber), which KCD draws on.

Mordhau and Chivalry are what the Hybrid already takes; the three below take Sekiro, Bushido Blade and Nidhogg, and
Liechtenauer with KCD. Absolver's decks and physics swordplay are under "Not now".

## What all three share

- **The switch.** They plug into the Combat style setting's PR (assumed merged first): one style per fight, fixed at
  its start (the host's setting in a battle, joiners fighting in it; the challenger's in a duel), `Player.style` in
  the fight's state and hash. The Kobolds fight in the fight's style.
- **Keys are slots, each style says what they do.** Mouse buttons stay fixed; keys stay rebindable. The settings
  screen shows the picked style's words for each slot. One new action, `guardDown` (K, and a downward flick, which
  the flick reader now drops), shared by One Strike and Master Cuts.

  | Slot (action) | Default | Posture | One Strike | Master Cuts |
  |---|---|---|---|---|
  | `lightAttack` | left click | swing | thrust (unarmed: punch) | the guard's strike |
  | `heavyAttack` | right click | guard (held) and deflect (the press) | beat | master cut (also the counter) |
  | `guardBreak` | left Shift | perilous thrust | (none) | Ringen (the guard break as built) |
  | the Hybrid's kick | G | perilous sweep | (none) | (none) |
  | `guardLeft` / `guardTop` / `guardRight` | U I O, flicks | (none) | `guardTop` raises the blade | Ochs / Vom Tag / Pflug |
  | `guardDown` (new) | K, flick down | (none) | lowers the blade | Alber |

  Dodge (F), jump (Space), lock-on, skills, the chant, the bag and eating work as now in every style.
- **Code.** Each style is one rules file with its numbers table (`shared/src/weapons/styles/<style>.ts`), its
  player side (`shared/src/battle/fight/styles/<style>.ts`, called from `player/controller.ts` by `Player.style`), its
  hit rules as one branch in `combatSystem`, and its Kobold brain (`fight/behaviors/<style>.ts`, run instead of
  `weaponAttackSystem`), with the Kobolds' per-style numbers in their files under `server/src/core/enemies/`. New
  fight state goes in `save()` / `load()` and the hash. Inputs gain at most one held field per style, Zod-checked.
- **Numbers** are for a heft-1 blade; every time scales by the weapon's heft (longsword 1.2, greatsword 1.6) as now,
  and weapon damage by strength through `physicalDamage` unless a style says otherwise. Anything a player must react
  to (not a read, like the beat) winds up for at least 0.2 s, so PvP still reads at 100 ms of ping (the other
  player's moves show half a ping late). Tests read every number from the style's table.
- **No attack warnings on screen.** Attacks are told by the blade, the sprite and sound only. Bars that show state
  (Posture's posture) and a guard display (Master Cuts', like For Honor's chevrons) are allowed.
- **Art.** Each style lists the poses it needs. They're `SwordPose` keys (`client/src/gfx/look/moves.ts`) that the 3D
  blade (its own PR) follows, so the blade's angle and height read from any side; update ART.md's "What to draw".
- **Each PR** also updates FORMULAS.md (a section per style), ARCHITECTURE.md, AGENTS.md ("Decided by the agent"),
  the README's feature line, and trims this file. Skills still ignore guards, deflects and lines (the current rule).

## 1. Posture (Sekiro, with Nioh's Ki Pulse)

**The idea.** One defensive button and no directions. Both sides have a posture bar that fills under pressure; full,
you're broken and the next hit is a deathblow. You win by keeping a rhythm: deflecting a string of swings breaks the
attacker, and each perilous attack has exactly one right answer. Reading is rhythm and attack type; weapon play is
timing, never mashing, and returning to guard on the beat.

**Controls.** Left click swings (a chain of four). Right click held guards; its press is the deflect. Shift is a
perilous thrust, G a perilous sweep. F toward a thrust is a Mikiri counter; Space over a sweep, then left click in
the air, is a jump kick. U, I, O, K and flicks do nothing.

**Numbers** (`POSTURE`; times × heft; damage × the weapon's, × strength):

| Attack | Windup | Live | Recovery | Damage | Posture when guarded | Stamina |
|---|---|---|---|---|---|---|
| swing 1-3 | 0.3 (in a chain 0.25) | 0.1 | 0.3 | ×0.8 | 12 | 0 |
| swing 4 (finisher) | 0.45 | 0.12 | 0.45 | ×1.5 | 20 | 0 |
| perilous thrust | 0.6 | 0.1 | 0.5 | ×1.5 | unguardable | 15 |
| perilous sweep | 0.55 | 0.12 | 0.5 | ×1.2, stagger 0.4 s | unguardable | 15 |

- Posture: 100 for players and the Kobold Swordsman, 120 the Kobold Greatsword, 80 the boar, 60 the Warlock (enemies
  reuse `Enemy.poise` as posture left). It recovers 20 a second from 1 s after it last grew, ×1.5 while guarding,
  × (0.3 + 0.7 × the HP share): low HP means slow recovery, so chip damage matters.
- Guarding (held; it covers 140° in front, as now): no HP lost; you take the posture above (× the attacker's heft).
  Swings and guarding cost no stamina; posture replaces it.
- Deflect: the guard pressed at most 0.2 s before the hit lands (that step counts). No HP lost; you take a quarter
  of the posture; the attacker takes 15, +5 for each deflect of theirs in the last 1 s (at most +15), and recoils
  0.25 s (a string goes on after it, as in Sekiro). A press within 0.5 s of the last release shrinks the next
  window by 0.05 s, down to 0.067 s (4 steps); a deflect, or 0.5 s without pressing, resets it. Held past the
  window, it's a guard. The perilous thrust deflects only within 0.12 s; the sweep and grab never.
- Mikiri counter: a dodge toward a thrust's thrower (within 45°) when the thrust lands in the dodge's first 0.3 s:
  you stop on the blade, unhurt; the thrower takes 45 posture and is opened 0.6 s.
- Sweeps hit only fighters on the ground. Jumped, left click while still airborne within 1.5 m of the sweeper kicks
  off them: 30 posture, staggered 0.3 s, no damage.
- A hit landed also gives the target half its "guarded" posture.
- Broken (posture full): staggered, a player 1.2 s, an enemy 1.5 s. The first weapon hit in it is a deathblow: 35% of
  the target's most HP (through `hurt`), and posture empties. Not taken, posture drops to half when it ends.
- Zanshin (Nioh's Ki Pulse): pressing guard within 0.15 s after your swing's blade ends, on a swing that hit or was
  guarded, takes 15 off your own posture and 0.1 s off its recovery. Its tell is a flick of the blade and a soft chime.

**The Kobold.** Walks up guarding (your swings fill its posture). Each of your swings, rolled at its start from the
fight's seed: it deflects 30% (then strikes at once, the riposte flag). Its strings are 2-4 swings; 25% of swings are
delayed (windup +0.3 s, the blade held high: the tell); 30% of strings end in a perilous attack: thrust 45%, sweep
30%, grab 25% (the guard break's grab, 0.5 s windup, unguardable, 25 damage and 30 posture, no tech window). Above
70% posture it backs off 2 m to recover, so you have to press it. Your perilous attacks: it deflects a thrust 20% and
steps back from a sweep 30% (the sidestep behavior). The boar's lunge can be guarded (30) or deflected (25 to the
boar); its charge is perilous (dodge it). The Warlock's poke can be guarded or deflected.

**PvP.** Symmetric. Turtling is answered by perilous attacks and by chain timing: the next swing may start anywhere
in the last one's 0.3 s recovery, so a defender can't deflect on a fixed beat, and the spam penalty punishes
guessing. Circling still matters (guards and deflects only cover the front).

**Drawn and heard.** Poses: guard (blade across the body, angled), deflect (a snap forward), the four swings,
the thrust (blade drawn back level at the hip, point forward, body side-on), the sweep (crouched, blade low behind),
the grab (free hand open, leaning in), broken (down on one knee), the deathblow (a thrust through), Zanshin's flick.
Every perilous windup rings one sharp sound, the same for thrust, sweep and grab (Sekiro's kanji as sound). A
deflect clangs higher than a guard and throws sparks; a break thuds. HUD: your posture bar under HP, filling from
both ends to the middle, yellow to red; the locked foe's above its head.

**Reuses.** `startSwing`, `weaponSystem` and `attackShape` (every swing from the top), `parries()`' window check
(keyed to the guard's press step, not a heavy's), `blocked()`'s recoil, `stagger()`, `Enemy.poise` and the brain's
stagger, the grab in `guard-break.ts`, the dodge's i-frames, `grounded` for sweeps, the Kobold's sidestep. New: posture
on players, the deflect clock and penalty, the perilous kinds, a `groundOnly` flag on `ActiveHit`, the HUD bars.

**Tests first.** The window's edges (a press on the landing step deflects, one a step before the window guards);
the penalty shrinking and resetting; posture from guards, deflects and hits, its recovery (by HP and guarding);
breaking and the deathblow; thrusts through a guard, the tight thrust deflect and Mikiri; sweeps missing airborne
targets and the jump kick; Zanshin; the Kobold's seeded deflects, delays and perilous ends; a duel both ways.

## 2. One Strike (Bushido Blade, Nidhogg, Hellish Quart)

**The idea.** Blades kill. You hold your point at one of three lines, high, middle or low, and the opponent can see
it. A thrust at the line their blade holds is stopped; at any other it lands, and where it lands decides everything:
the head kills, the body nearly does, the legs lame you. Moving your blade into the line of their thrust disarms
them. Fights are spacing and nerve: who changes line first, who follows, who's inside the other's point. Weapon play
is length against speed: the greatsword's point reaches first, the sword is quicker and wins once inside.

**Controls.** I (or a flick up) raises the blade a line, K (or a flick down) lowers it; and the wheel, if the Hybrid
has made it an input. Left click thrusts at your line. Right click beats their blade aside. Disarmed, left click
punches.

**Numbers** (`ONE_STRIKE`; times × heft):

- Lines: a move of one line takes 0.1 s (high to low is two moves, passing the middle). Fights start at the middle.
- Thrust: windup 0.3 s, live 0.1, recovery 0.35 (0.5 if it hit nothing); you step in at 5 m/s while live; reach is
  arm + blade + 0.3 m, within 12° either side; 8 stamina. A target closer than half the blade's length is inside the
  point and can't be hit by it.
- Where a thrust lands, as a share of the target's most HP, through `hurt` (so defense still trims it): high (head)
  100%, middle (body) 60%, low (legs) 20% and lamed for the rest of the fight (walking ×0.5, no dodge or jump).
  Strength and the weapon's damage stat don't count here; its length and heft do.
- Clash: a thrust at the line the target's blade holds, facing it, is stopped. Both are pushed apart (4 m/s for
  0.15 s) and the thruster recoils 0.25 s. Two thrusts that both land on one step both hit (a double, as in Hellish
  Quart).
- Disarm: a blade already moving to the line of a foe's thrust when it lands, within its reach, disarms the thruster
  as it arrives, and the thrust doesn't land. So the whole windup is the time to react. Two blades moving to each
  other's line just clash. A still blade is never disarmed.
- Beat (right click): windup 0.18 s, at a foe whose blade holds your line, within the shorter of your two reaches +
  0.3 m. It knocks their blade off line for 0.45 s (no line, no thrust, no line change). If their line changed or
  they left reach before it lands, you're off line yourself for 0.35 s. 15 stamina.
- Disarmed: your blade lands 3 m away, away from the disarmer (inside the wall). Unarmed, left click punches (windup
  0.15, live 0.08, recovery 0.3, reach arm + 0.3 m, 4 damage × strength, staggers 0.3 s). Walking within 0.6 m of
  your own blade picks it up (0.35 s, standing still); nobody else can. The item never leaves the hand slot, so gear
  and saves don't change.
- The boar's low line is its head (100%), its middle its back (60%); a high thrust passes over it. Its lunge comes on
  the low line, so a low blade facing it clashes it (it recoils 0.4 s). Charging onto a blade held low for at least
  0.3 s, facing it within 30°, by someone standing (not dodging), it impales itself: a head hit, and you're pushed
  back 1 m unhurt (how a boar spear is set). The Warlock has a person's lines; its poke is a middle thrust; it can't
  be disarmed.

**The Kobold.** Reacts after 0.3 s (±0.08 from the fight's seed) and fights at its own measure (its reach + 0.2 m).
Matched with you in reach, every 0.6-1.4 s it changes line and thrusts (40%), beats (30%) or waits (30%); facing a
mismatched blade in reach, it thrusts. When you change line in its reach it follows 60% of the time. When you thrust
at another line it tries the disarm 35% (only if it can start moving before the thrust lands) or steps back 40%.
Disarmed, it walks to its blade. The Kobold Greatsword keeps you at the end of its longer, slower point.

**PvP.** Symmetric, and the purest read of the three: staying matched is safe against thrusts but loses to a beat;
moving off line beats a beat but invites a thrust; a thrust at a mismatched foe lands unless they move into its line
in time and disarm you. Every thrust takes 0.3 s to land, so it plays at normal ping. It's still a spar: a head hit
just ends the duel.

**Drawn and heard.** The 3D blade's three lines: high (hilt by the head, point at the face), middle (point at the
chest), low (point at the knees); each move eased over its 0.1 s. Poses: the thrust (arm out, a lunge step), the beat
(a short sharp knock), the clash (both blades jolt), punching, crouching for the blade, a limp when lamed. The
disarmed blade spins away and lies on the floor (the 3D blade's mesh, a fight entity). Sounds: a clash ring, a beat's
knock, a disarm's clatter, a punch. No new HUD.

**Reuses.** `startSwing` and `attackShape` (a thrust is a narrow attack kind with its own steps), the clash through
`blocked()`, `knock`, `stagger()`, `Statuses` for the lame (`statusMoveFactor`), the sidestep behavior, the input's
held-guard pattern for the line. New: `lineOf` (like `guardOf`), the line clock and arrivals, the disarm and the loose
blade entity, zones by target (people, the boar), unarmed punches, the boar's set charge.

**Tests first.** A thrust blocked at the same line and landing at each other line for its share; inside the point;
the double; disarming a thrust by moving to its line before it lands, never a still blade, and two blades moving to
each other's lines clashing; the beat landing and whiffing; the loose blade, punching and picking it up; the lame;
the boar's zones, its lunge clashed and its charge impaled only when set; the Kobold's seeded follows and disarm
tries; a duel both ways.

## 3. Master Cuts (Liechtenauer and Kingdom Come)

**The idea.** Four real longsword guards, each a visible threat and a weakness: every guard is broken by one master
cut, thrown from another guard. There's no held block. Any counter-cut timed into an attack binds it (KCD's perfect
block), but only one thrown from the guard that breaks the attacker's goes through and hits (KCD's master strike).
Reading is seeing their guard and standing in the one that breaks it before they move; weapon play is the timed
counter-cut, changing guard mid-windup to beat a reader, and the bind.

**Controls.** U, I, O and K (or flicks left, up, right, down) take Ochs, Vom Tag, Pflug and Alber. Left click strikes
from your guard; right click throws its master cut, also the counter. Shift is Ringen (the guard break as built).

**Numbers** (`MASTER_CUTS`; times × heft; damage × the weapon's, × strength):

- The guards and what they break: Vom Tag (blade up over the shoulder) throws the Scheitelhau, which breaks Alber;
  Alber (point down, inviting) the Krumphau, which breaks Ochs; Ochs (hilt by the head, point at the face) the
  Schielhau, which breaks Pflug; Pflug (hilt at the hip, point at the chest) the Zwerchhau, which breaks Vom Tag. Each
  guard breaks one and is broken by one; opposite pairs (Vom Tag and Ochs, Alber and Pflug) are even.
- Changing guard takes 0.25 s (0.15 s in an attack's recovery), with no guard while moving; 3 stamina. You start in
  Vom Tag.
- Strikes (left click): the Oberhau from Vom Tag (windup 0.45 s, ×1.2, 160° arc), the Oberstich from Ochs and the
  Unterstich from Pflug (0.3 s, ×0.9, 30°, reach ×1.25), the Unterhau from Alber (0.4 s, ×1, 140°). Live 0.1 s,
  recovery 0.35 s, chains of three (a chained windup ×0.85), 10 stamina.
- Master cuts (right click): windup 0.35 s, live 0.12, recovery 0.4, ×1.3, 16 stamina; the Scheitelhau 40° and reach
  ×1.3, the Krumphau 100°, the Schielhau 60° and reach ×1.15, the Zwerchhau 140°.
- The counter: an attack that would land within 0.3 s after your right click (that step counts), with you facing it
  (140°). Thrown from the guard your guard breaks, it's displaced: the attack ends, its thrower is opened 0.6 s, and
  your master cut goes on and lands, its stamina given back. Thrown from any other guard, it binds: both attacks end,
  the attacker recoils 0.45 s and you 0.3 s (your move next), 8 stamina each. At 0 stamina a right click does nothing.
- A master cut at someone standing in the guard it breaks can't be countered at all: only a dodge, or leaving that
  guard before it lands (then it meets the new guard by the rules above).
- Fehler (the feint): a guard change in a windup with more than 0.15 s left turns the attack into the new guard's
  (the same button), its windup left at least 0.2 s; 6 stamina, once per attack.
- Ringen: `GUARD_BREAK` and its counter as built, against any guard.

**The Kobold.** Holds a guard 1.5-3 s (`ENEMY_GUARD`), reacts after 0.35 s, and half the time answers your guard by
moving to the one that breaks it. In reach: if you stand in the guard its guard breaks, it throws the master cut
(60%); otherwise strings of 2-3 strikes, 20% of them changed mid-windup (Fehler). When you attack from the guard its
guard breaks, it displaces 45% (pressing 0.2 s before it lands); from another guard it binds 30%. It wrestles an idle
player 20% and counters wrestling 30% (as now). The boar and Warlock attacks come from no guard: any timed right click
binds them, none displaces them.

**PvP.** Symmetric. Standing still in a guard invites its master cut; changing guard opens you for 0.25 s; the timed
counter needs the right guard to win, so players pre-position and Fehler punishes it.

**Drawn and heard.** Four guard poses with very different blade angles (the 3D blade makes them read from any
side); four strikes; four master cuts (the Scheitelhau long and vertical, the Krumphau crossing onto the hands, the
Schielhau a short cut from the shoulder, the Zwerchhau flat with the hilt high); the bind (blades crossed, held 0.3
s); the Fehler (the blade turning mid-windup). Sounds: the bind grinds, a displacement rings bright. HUD: a small guard
diamond under the fight (Vom Tag top, Ochs left, Pflug right, Alber bottom): yours filled gold, the locked foe's
outlined red. It shows guards, never attacks.

**Reuses.** Most of For Honor's machinery: the held guard input (four values), the flicks (plus down), `turnGuard`
and the guard hold for the Kobold, `parries()` for the counter's window, `blocked()` and `stagger()`, the feint
check (`feintable`), `guard-break.ts` whole, the guard widget turned into the diamond. New: the break cycle, the
eight attacks' table, displacing and binding, the Fehler.

**Tests first.** Each guard's strike and master cut (timing, damage, shape); displacing from the breaking guard and
binding from the others, the window's edges, at 0 stamina; an uncounterable master cut on a guard it breaks, and
dodged; leaving the guard in time; Fehler's cutoff and cost; the Kobold's seeded pressure, displacements and binds;
a duel both ways.

## Build order

1. **Posture**: the most different from For Honor and the Hybrid (no directions at all), the simplest controls,
   strong against every enemy we have, and mostly built on the parry window, poise and the grab.
2. **One Strike**: the most novel feel (lethal, footsies, disarms) and the best PvP read; more new parts (the line
   clock, disarms, the loose blade, zones, the lame).
3. **Master Cuts**: the cheapest on top of For Honor's code, but the closest to it in feel, so last.

## Not now

- Absolver's decks (stances chained by your own attack list): needs a deck editor.
- Physics swordplay (Exanima, Half Sword): the mouse-driven inertia swings were replaced for being "too much
  unpredectable, especially pvp"; deterministic blade physics is a project of its own.
- Blade Symphony's stance priority (heavy beats balanced beats fast in a clash) and charge tiers: a fit for a later
  style or the Hybrid. Ghost of Tsushima's stance per enemy type: once there are more enemy kinds.
- One Strike later: throwing the blade (Nidhogg), arm wounds (Bushido Blade), a lethal-only duel option.

## Assumptions

- The Combat style setting and its switch land first, with one style per fight as above. If styles may mix in one
  fight, each style's attacks still say a side (`top`) so the For Honor guard keeps working against them.
- Mouse buttons stay fixed; each style reuses the existing battle actions as slots, adding only `guardDown`.
- Posture's deathblow and One Strike's zones are big on purpose. Death stays hardcore (the F1 panel's
  invulnerability helps testing); duels stay spars.
- Posture spends no stamina on swings or guarding; dodges, perilous attacks and skills still do.
- Enemy numbers per style sit with each enemy (`server/src/core/enemies/`); the boar and Warlock keep their attacks.
- All numbers are first guesses for the user to tune by feel; none was played.
- Until the 3D blade is merged, the sprite's painted sword shows the poses.
