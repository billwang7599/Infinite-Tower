# Combat styles

Three more ways to fight with a sword, picked with the per-player Combat style setting next to For Honor and the
Hybrid. The user: "come up with some other combat styles that feel fun and realistic. im thinking we have to both
read the opponent and also reward good weapon play. search online for existing games and their mechanics. we can also
add in/mix in stuff", and "make any assumptions you want". Everything below is the agent's design, built overnight
one PR per style in the order given, for the user to play and retune. Posture and One Strike are built (their rules
are in AGENTS.md's "The Posture style" and "The One Strike style", and FORMULAS.md); Master Cuts isn't yet.

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
- **Keys are slots, each style says what they do.** Mouse buttons stay fixed; keys stay rebindable. One new action,
  `guardDown` (K, and a downward flick, which the flick reader now drops), shared by One Strike and Master Cuts.
  Posture took a simpler road than slots: its group has actions of its own (`guard` on right click, `perilousThrust`,
  `perilousSweep`), and a style's group is read before the arena's, so its mouse button wins. One Strike did the same
  (`raiseLine` on I and a flick up, `lowerLine` on K and a flick down, `thrust` and `beat` on the clicks), so no
  `guardDown` was added; Master Cuts can do the same, each action named for what it does in that style.

  | Slot (action) | Default | Posture | One Strike | Master Cuts |
  |---|---|---|---|---|
  | `lightAttack` | left click | swing | thrust (unarmed: punch) | the guard's strike |
  | `heavyAttack` | right click | guard (held) and deflect (the press) | beat | master cut (also the counter) |
  | `guardBreak` | left Shift | perilous thrust | (none) | Ringen (the guard break as built) |
  | the Hybrid's kick | G | perilous sweep | (none) | (none) |
  | `guardLeft` / `guardTop` / `guardRight` | U I O, flicks | (none) | `guardTop` raises the blade | Ochs / Vom Tag / Pflug |
  | `guardDown` (new) | K, flick down | (none) | lowers the blade | Alber |

  Dodge (F), jump (Space), lock-on, skills, the chant, the bag and eating work as now in every style.
- **Code.** As Posture and the hybrid: a numbers table (`shared/src/weapons/<style>.ts`), a `STYLES` entry with its
  player side, `defend` and Kobold brain (`shared/src/battle/fight/styles/<style>/`), the Kobolds' per-style numbers
  in their files under `server/src/core/enemies/`. New fight state goes in `save()` / `load()` and the hash. Inputs
  gain at most one held field per style, Zod-checked.
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

## 1. Posture (Sekiro, with Nioh's Ki Pulse): built

One defensive button and no directions: a posture bar that guards, deflects and hits fill, full it breaks and the next
hit is a deathblow; deflecting a string breaks the attacker, each perilous attack has one answer (Mikiri the thrust,
jump the sweep, dodge the grab). What it does now is in AGENTS.md ("The Posture style") and FORMULAS.md. Still open:

- **Art.** No new drawings yet: the sprite's top guard and stagger frames stand in. Wanted: guard (blade across the
  body, angled), deflect (a snap forward), the four swings, the thrust (blade drawn back level at the hip, side-on),
  the sweep (crouched, blade low behind), the grab (free hand open, leaning in), broken (down on one knee), the
  deathblow (a thrust through), Zanshin's flick. Then ART.md's "What to draw".
- **The foe's bar over its head**, as the plan had it; it's under the boss bar for now.
- **Feel.** Every number is a first guess and none was hand-played; the Kobold beats a bot that only guards and loses
  to one that reads it (`server/test/core/enemies/kobold-swordsman-posture.test.ts`), with about half its HP left.

## 2. One Strike (Bushido Blade, Nidhogg, Hellish Quart): built

Blades kill: three lines (high, middle, low) the opponent can see, a thrust stopped by a blade holding its line and
landing anywhere else for its zone (the head kills, the body nearly does, the legs lame), moving into a thrust's line
as it lands disarms its thrower, a beat knocks a matched blade aside, disarmed you punch and walk to your blade, and a
boar charging onto a set low blade impales itself. What it does now is in AGENTS.md ("The One Strike style") and
FORMULAS.md. Still open:

- **Art.** No new drawings: the sprite's overhead swing frames stand in for the thrust, its stand frame for the beat,
  a squash for crouching to the blade; no limp when lamed, no punching frame. Wanted: the three line stances, the
  thrust (arm out, a lunge step), the beat, punching, crouching for the blade, a limp. Then ART.md's "What to draw".
- **Seeing the foe's low line.** Locked on, your own sprite can hide the lower half of a foe straight ahead, its low
  line with it; the camera, or a cue on the foe, may need a look.
- **Feel.** Every number is a first guess and none was hand-played; the Kobold loses to a bot that follows its line,
  moves into its thrusts and punishes its beats, and beats one that stands at one line
  (`server/test/core/enemies/kobold-swordsman-one-strike.test.ts`). The disarm's window is the line's move time,
  0.1 s with a sword: tight.
- **The Kobold Greatsword** keeps its longer measure by the same rules; nothing of its own.

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

1. **Posture** (built): the most different from For Honor and the Hybrid (no directions at all), the simplest
   controls, strong against every enemy we have.
2. **One Strike** (built): the most novel feel (lethal, footsies, disarms) and the best PvP read; more new parts
   (the line clock, disarms, the loose blade, zones, the lame).
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
