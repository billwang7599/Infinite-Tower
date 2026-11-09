# Sword combat (spec v2)

Status: **partly built**. The user's spec (Nov 2026) and every combat decision since; the user's decisions override
the spec where they differ. The one-line summary is AGENTS.md's "Combat"; the formulas are in FORMULAS.md and the
numbers in `shared/src/weapons/hybrid.ts`, `weapons.ts` and `shared/src/battle/player.ts`.

## Goal

One modular melee system, played in first person, the sword driven by the mouse: a light, a heavy and a stab, a held
block with a perfect block, a swing parry and a dodge. Stamina is the only resource. A weapon is a few numbers (weight,
reach, damage type), and a loadout is what sits in each hand; identity comes from those, not per-weapon rules.

## Pillars

1. **Readable above all.** A player who loses an exchange knows why ("parried too early", "he feinted me", "I
   overextended"). The blade can be fast; intent must be slow. This one overrules the others.
2. **Self-balancing through stats.** Weight is the master dial: heavier is slower and costlier but hits harder, so
   weapons differ in tempo, not power.
3. **Identity emerges.** Dual-wield, sword and shield, a lone blade and a greatsword play differently from the hand
   rules alone, with no special cases.
4. **No stunlock.** Fights are decided by reads and stamina, never a loop you can't escape.

The feel: a committed, weighty guessing game, not a flurry of clicks. Impact must land physically (hit-stop, sound,
weight on contact); feel is found by hand and matters more than any number. After a fight, the player wants another.

## Decided by the user (built)

Swinging:

- One sword system, the Hybrid, kept from five tried, then made simpler (Souls and Sekiro: simple to learn, deep to
  master). Guard stances, the combat style setting and the Posture, One Strike and Master Cuts styles are gone.
- Left click a light, right click (on release, if it didn't drag) a heavy, the mouse's back side button or K a stab.
- A quick mouse flick aims one of seven ways (across both ways, down from the top, four diagonals); no upward swing,
  no aim keys. Locked on, attacks go where you face. Every swing reaches as far (arm reach plus the blade), the stab
  further.
- Every wind-up has a hard floor, the reactability guarantee, for players and enemies alike; base times keep their
  spread above it rather than flattening to it. Lights wind up readably, a heavy longer; a heavy has no hyperarmor.
- Momentum pays in damage only, built most by varying the line; a stab cashes it in. A gap, a block, a dodge or a hit
  taken breaks the chain. Each hand keeps its own chain, momentum and recovery; a hand can't swing while recovering,
  and a hand switch never cuts a recovery short.
- The body commits: you walk slowly while attacking, a live blade carries you forward, a whiff overextends you
  (carried further, a longer recovery), and a live blade's turn is capped (a drag for timing, never a spin).
- Weapons belong to classes (the user: "we have dagger, shortsword, longsword... all weapons so far will have their
  own name, but tagged with what kind of weapon they are"; "label + base table. each weapon can adjust them, but all
  weapons stemming from classes build from that class"): shortsword, longsword, greatsword (the user: "greatsword is
  the greatsword class") and bow, each a base table; a weapon is its class's table with the fields that set it apart
  changed, and its tooltip names its class beside its rarity. The dagger waits until there's one. The shortsword is
  the reference; the longsword reaches and stabs best at about its damage a second; the greatsword hits about twice
  as hard a swing and more a second, slow and dear (the user: "greatsword seems to be weak right now... each weapon
  should have a distinction of playstyle and stats").
- Each weapon is a table of its own stats, read as they are (the user: "do we need heft anymore? im thinking every
  weapon has just now a table of stats to read from"): per strike (light, heavy, stab) its wind-up, live time,
  recovery, stamina cost, typed damage and poise damage; then its whiff and feint recovery, guard raise time, parry
  weight, length and minimum strength. A shield's table is its length and raise time; a bow's its draw times, draw
  cost, arrow damage and power. The chain kinds stay shared, as multipliers on a swing's opening wind-up (reverse
  quickest, perpendicular slowest); a stab's wind-up is its own in any chain. The floor comes last. Carry weight is
  separate. A weapon's reach is the wielder's arm reach plus its length.
- Strength over a weapon's minimum quickens every one of its times a little, up to a cap (the user: "and maybe
  strength (over minimum required) slightly increases speed, but only up to 5-10%"), never past the wind-up floor;
  the reason timing stays mostly fixed (the user: "if things get too quick, they lose uniqueness and its
  unbalanced"). A shield has no minimum and is never quickened. Otherwise strength adds damage; a two-handed grip
  adds strength, so a little speed only through that.
- Each weapon has a minimum strength (the user: "lets just have a simple they cant wield it if they dont have
  sufficient strenght"). Under it at your grip strength the server won't put it in a hand; the two-handed grip's
  1.5× counts. If your strength later falls under it, it moves to the bag (a pile at your feet if there's no room),
  and nothing goes into the other hand that would leave a lone blade under its minimum.
- Stamina per strike is the weapon's table cost, made cheaper by strength over the weapon's minimum (the user:
  "like maybe any strength over the minimum is 1-2% cheaper? capped at 50%?"), never dearer than the base.
- Better weapons keep their weight (the user: "higher tier weapons would be around the same weight wise, it would just
  have increase like sharpness or whatever"): a tier raises only quality, so damage, never its table.
- A lone melee weapon is held in both hands, putting 1.5× the strength in, through the same math; anything in the
  other hand makes it one-handed. The Kobolds stay one-handed. No toggle.
- Weapon damage is typed: slash, stab and blunt, each strike's its table's own. A swing deals slash and blunt, a stab
  only stab. Sword stabs stay weak; rapiers and spears will be the stab weapons. The Wooden sword, Bram's, only
  bludgeons, and barely (the user: "wooden sword has abysmal damage").
- Enemies swing by the player's rule, from their weapon's table and their strength. A swordsman's def keeps only
  pacing (cooldowns, chain lengths, chances); balance goes through its weapon and stats. Beasts keep their own attack timings.

Defending:

- Defence is one button (Sekiro's): holding block stops any hit from the front, letting a chip through. Pressed just
  before a hit, a perfect block: nothing taken, the attacker loses stamina and recoils. Mashing opens no window. No
  tap parry.
- Blocking is the safe defence and the swing parry the risky one. Your swing meeting theirs parries it (the exact
  reverse a full parry, near it a partial one), in a window wider than the perfect block's. Parries deflect, they
  don't stun; stabs neither parry nor are parried. Blades live at the same moment clash and both stagger. A heavier
  swing gets the better of a parry by weight.
- Both scale with the blade: the perfect and parry windows grow with blade length, and each guard raises in its own
  table's time, a heavy blade's slowest. No close-range penalty for big weapons.
- A shield blocks best (wider, less chip, less stamina), then one blade, then two. A shield is never swung. With a
  blade in each hand, Q switches which hand attacks.
- Stamina is a player's only bar (no player poise). A blocked hit costs its damage in stamina; one that takes the last
  breaks the guard (a stagger earned by the attacker). Holding block drains it slowly.
- The dodge is a read, not a panic button: i-frames only in its middle, a real cost and a short cooldown.
- No kick. Only a heavy can be feinted: block pressed in its wind-up pulls it back into the guard for stamina, not too
  late, with a recovery after. The Kobold feints now and then, told only by sound and its blade snapping back.
- A stun or stagger resets an enemy's attack: its chain and counter are dropped and it waits its whole cooldown.
- A swordsman's counter after a parry or perfect block winds up as a player's opening swing and can be met.

Hits and pushback:

- Hits do damage only: no knockback, no stun, a short invulnerability after, and the victim's momentum lost. Enemies
  stagger only when their poise breaks; a hit no longer breaks a chant, a cast or the bag (eating still stops).
- Only blocks push back, players and enemies alike, by the guard and the blocker's strength and a hidden steadiness.
  Pinned against a wall the chip costs more. The push is movement only and never locks controls.
- Hit-stop is local and drawing only: the attacker's blade and a touch of camera hold on contact. Nothing ever pauses
  the fight.
- A dodge never cancels an attack: a dodge or attack pressed during one waits and starts when it lets go.
- Fighters are moved by code, not forces: an enemy shoves a player, a player can't push an enemy, and a dodging,
  staggered or dead player passes through enemies.

Reading the other side:

- Attack tells come from sound and animation only: big wind-ups, the blade drawn back on the side the swing comes from
  (further for a heavy), a glint before it goes live, its trail and whoosh. No warning marker; the lock-on diamond
  stays.
- Your own aim shows as a ring of seven wedges at the bottom centre, as HUD, the same in every view; only you see it.
- Being stunned shows: a Stunned status tile, stars circling the view, darkened edges and a camera sway.
- The guard looks real: aimed, the edge faces the foe and the blade lies in the plane its cut sweeps through. One blade
  blocks across the body, the other hand under it; two cross in an X (SAO-style); a shield is raised in front. Every
  change of guard or hand eases, never teleports, and enemies hold the same stances.

Camera and aim:

- Fights are first person only (the user will A/B test third person: `?cam=<preset>` on a dev server). Your arms and
  what they hold are always in view; a blade never swings back through your head. A dodge eases out over the left
  shoulder and back.
- Always locked on: a fight starts on the closest enemy, Right Shift switches to the closest, nothing lets go. A right
  or middle drag (or the arrows) pans by hand; while panned you walk by the camera and attack where it looks; let go,
  it eases to the enemy in view nearest the middle. A dead target passes the lock the same way.
- Up and down are capped, the floor pulling the camera in rather than through.
- Bows and skills share one aim: drawing a bow or chanting frees the camera, a crosshair shows, and the shot goes for
  the spot under it (locked on, at the target). A panned camera shows a centre dot.
- The game holds the mouse in a fight (Auto mouse lock, a setting, on by default); menus and dialogs free it.

Bows (placeholders, every number the agent's): hold the light attack to draw, let go to loose; a draw meter replaces
the aim ring; two-handed; a quiver at the hip stacks arrows and nocks quicker; the flight comes from the bow's power,
the aim and the draw, with Minecraft-like drop.

## Open

- How damage types meet guards and armour (the spec: pierce finds gaps in shields and armour, blunt drains guards and
  ignores armour). Armour itself.
- More weapons as points in the stat space: dagger, mace, rapier, spear.
- Latency budgets for parry and perfect-block windows in PvP (plan/server-fights.md).
- Swing steering (plan/ideas.md); how wide each line's arc should be (the agent's pick).

## What to avoid

- **Unreadable chaos**: losses that feel random. Fix this before anything else.
- **Stacking every incentive on one option**, so everyone metronomes it. Keep the fastest swing low in momentum.
- **Numbers before feel**: don't tune the stat table before one sword feels good to swing and land.
- **Flat offence**: with no stun, a clean hit must still read as an advantage (their chain breaks, yours survives).
- **Scope creep**: prove the core duel before building more on top.
- **PvE that doesn't earn the system**: enemies have to feint, mix up and bait parries, or fights become "block, wait,
  repeat".
