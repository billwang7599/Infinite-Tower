# The agents' picks, for the user to review

Status: **to review**. Where the user said "make any assumptions" or "use your best judgement", the agents decided and
listed it here. Every pick is changeable; the details and numbers are in the code named. Still ask before deciding a
new mechanic. Most were tried by tests and a headless browser only, not hand-played.

## Character, core and stats

- Every stat starts at the average, 10; the stat formulas and the core's fill curve, essence per monster
  (`shared/src/battle/stats.ts`, `CORE`, each enemy's essence item).
- Scaling (the user: "just make sure things scale properly"; numbers in `CORE`, `STAT_POWERS`, `MOD_CAPS`,
  `STRENGTH_DISCOUNT`; tested by formula, not hand-played):
  - The step curve in kills: step n takes `killGrowth` (1.3) ^ (n − 1) times the first step's kills of its own
    realm's foes: the first 5 boars or 2.5 Kobolds, Peak Tian's last about 197 boars; about 836 boar-kills in all.
  - A foe grown into a higher realm drops `realmEssenceFactor` (2) ^ realm of its essence, so the fill grows × 2
    more at each realm and farming a realm lower takes twice the kills.
  - Stat effects as powers of stat / 10: damage 1 (was √), HP and the stamina bar 0.5 (were linear), defense 0.5 (was
    50 / (40 + defense)), toughness and stamina recovery 0.5 (were linear), walking and carry ¼ (as before), a block's
    stamina 0.5 (was 10 / strength). Equal stats take the same hits at every step (about 10 shortsword lights on a
    Kobold Swordsman, 6 on another player); against the same foe each step is at least 15% more damage × HP held.
  - HP regen is a share of the most HP (0.5% a second at health regen 10), so it keeps pace with √ HP.
  - Enemies are grown by core steps per area (`enemySteps`, a spawn may set its own): the Waking Hollow, the Grass
    Field and Highmere 0, the Mistwood 1, the Old Quarry 2 (all still Yan, so one essence each). Spars never grow.
  - Buffs stop at `MOD_CAPS`: damage dealt × 2, damage taken × 0.5, stamina refill × 2, attack and dodge costs
    × 0.5. All damage buffs at once made 2.37×.
  - Blocks of an equal foe's light per bar stay level at every step.

Decided by the user since (the agent's picks within them):

- Minimum strength gates wielding (the user's). The agent's picks within it:
  - Minimums (grip strength): Wooden sword 0, Iron shortsword and Kobold blade 8, longsword 12, greatsword 15, Kobold
    greatsword 8 (the Kobolds, at 8, hold theirs one-handed; a new player at 10 lifts the greatsword only alone in
    both hands), training bow 0.
  - The discount: 1.5% a point of grip strength over the minimum (`STRENGTH_DISCOUNT.perPoint`), capped at 50% off.
  - Nothing goes into the other hand that would leave a lone blade's grip under its minimum.
  - Strength falling under a held weapon's minimum (points taken back, an inscription removed, an old save) moves it
    to the bag, or a pile at their feet if there's no room. Not mid-fight: there strength only drops by dying.
- Heft replaced by a table of stats per weapon; strength over the minimum quickens (the user's). The agent's picks
  within it (the numbers live in `shared/src/weapons/tables.ts`):
  - Quickening: 0.5% a point of grip strength over the minimum (`STRENGTH_QUICKENING`), capped at 8% (16 points).
  - Chain shares equal to the old table's ratios (reverse 0.40/0.56, other 0.48/0.56, perpendicular 0.60/0.56),
    applied to each strike's own opening wind-up, the heavy's too (so a chained heavy is a share of the heavy's, where
    it was the light's plus a fixed extra).
  - Each heavy deals twice its light's damage, as the old rule did.
  - Shortsword (was the Basic Sword): the measure, set so a new player (grip 10, 1% quickened) swung it on the same
    steps as before tables (before the slower wind-ups below).
  - Longsword: a little slower and dearer than the sword, the better stabber, longer reach.
  - Greatsword: slowest to start and recover, longest reach, the most poise damage; the Kobold greatsword is the same
    table at the Kobolds' minimum. Buffed with classes (below).
  - Parry weight carries the old heft numbers (sword 3, longsword 3.6, greatsword 4.9); raise times carry the
    old heft-derived ones; the wooden shield raises as the sword does and is never quickened (it has no minimum).
  - Training bow: the old draw (0.25 s least, 1 s full, 8 stamina, 20 stab), now quickened above its minimum of 0.
  - The guard-shift animation is slower for a guard slower to raise than the sword's (`GUARD_SHIFT`).
- Weapon classes, each a label and a base table (the user's). The agent's picks within it:
  - A weapon overrides its class's table by spreading it and replacing fields (`{ ...base, minStrength: 0 }`), the
    strikes whole; no merge helper.
  - The Basic Sword is shown as the Iron shortsword (its id stays `sword`); the Kobold blade is the shortsword base.
  - Wooden sword: the shortsword's times, costs, poise, reach and parry weight; all blunt, light 3, heavy 6, stab 2
    (the old starter weapon's, so the chicken and Bram's yard play as before); minimum 0, weight 1.5, drawn as the
    sword in plain wood. With its minimum 0 a new player swings it a little quicker and cheaper than the shortsword.
    Bram spars with it and holds a small wooden sword in his overworld sprite.
  - Greatsword: light 28 slash + 6 blunt, heavy twice that, so about twice the shortsword's a hit, about 20% more
    damage a second; stab and poise unchanged (its heavy breaks a Kobold Swordsman's poise in two).
  - A saved `old-stick`, in hand or in a grid, loads as a Wooden sword, laid out again in the grids (it's bigger).
  - Bram's yard lines say a wooden sword; the tooltip's class goes before the rarity ("Shortsword · Common").
- Slower wind-ups (the user: "nerf all wind up speed"). The agent's pick, to change after playtesting: every
  strike's table wind-up is 1.2× what the class tables first had (shortsword light 0.566 → 0.679 s), players and
  enemies alike; live, recovery and the bow's draw unchanged.
- The greatsword costs more stamina (the user's). The agent's pick, to change after playtesting: light 28 → 38, heavy
  44 → 60, stab 26 → 35 (about +35%), about 1.4× the shortsword's stamina per damage.
- No two-handed speed bonus: the grip only adds 1.5× strength.
- Stamina matters less as you grow, on purpose: a swing's cost never grows while the bar does.
- The core: a whole core takes no more essence and fill carries over; essence is an item (a 2 s Absorb, refused only
  by a whole core); a breakthrough counts at once, mid-fight too; points are placed free, outside fights, and taken
  back only by a campfire; death can cost a step across a realm; toughness doesn't shorten the counterplay's openings;
  HP regen for players only, paused after damage; agility speeds overworld walking too.
- The stats chart: its rim is the most a stat could reach at your step; hover shows the polygon and effect after.
- Advanced stats: the fight's own numbers for your gear and stats, worked out by the fight's functions.
- The sphere: a smoky pixel-art glass sphere, each realm's light its own shape and colour, breathing, sparks from 70%
  fill, a breakthrough animation; a 128 px card bottom left that flips between portrait and sphere (`gfx/core/`).
- A character's name is 2-16 letters, digits, spaces, ' or -; boy or girl only changes how the game refers to you.
- Inscriptions built: slots grow by step (more on a new realm's first); five sigils (Grit, Embers, the Last Breath, the
  Red Blade, the First Door); carved by Ysolde Thatcher of the Collegium in the Market Ward, priced by rarity in coins
  and essence, removal × 3 coins and × 2 essence; rings drawn round the sphere.
- Blessings built: faith per god only grows, from some quests' rewards; blessed at 100 faith; three gods bless
  (Kaelith's Edge, Brannoc's Anvil, Haldis's Hearth).
- The character panel: 680 px, tabs Stats (Basic, Advanced), Core, Relationships (Gods only); mouse only.

## Combat

- A flick is a quick mouse move past a distance in a short time (`FLICK`, with a flick sensitivity setting).
- The Hybrid's details: keys (K and the back side button stab, left Shift blocks), arcs per line, every timing,
  momentum gains, the whiff's carry and recovery, the live blade's turn cap, the guard's coverage and raise, the
  perfect block's window, the parry's checks, clash timing, the Kobold's chances and poise, feints' recovery, the aim
  ring's and crosshair's sizes (`shared/src/weapons/hybrid.ts`, `client/src/visuals/battle/overlay.ts`).
- Guards: shield, one blade and two blades' chip, stamina, push and coverage (`GUARDS`); two-handed grip poses; the
  sword's guard per way; enemies hold the same guard stance.
- The camera's numbers, turn rates, the dodge's shoulder view, the stun cue's look (`CAMERA_VIEWS`, `TURN`, `STUN_CUE`).
- Hit-stop's length and camera dip; the hit's jolt and sparks (`client/src/visuals/battle/impact.ts`).
- Animation polish (the user: "improve on everything's animation ... use your best judgement"; looks only, no timing
  touched): camera shake is a small smooth turn of the head (two slow waves, `SHAKE_RAD_PER_M`), never a move of the
  eye; first person's sword arms bob in step with the legs, trail a little behind a turning view and breathe at
  rest, faded out during a swing, guard, dodge or jump (`FP_SWAY`); enemies' walks and held legs ease in and out, and
  a hit's flash fades over its length (`client/src/visuals/enemies/shape.ts`).
- A fight that runs past `MAX_FIGHT_TIME` is a loss (a guard on the server); netcode windows (`netcode.ts`).
- Bows, all placeholders: the training bow, arrows and quiver (admin panel only), two-handed rules, the quiver's grid,
  the draw, nocking, Minecraft-like flight, the draw meter, the bow's first-person pose (`shared/src/weapons/bow.ts`).
- Timed buffs: one status system, the fused Self buffs; skills' numbers and smaller rules (plan/skills.md).
- The battle HUD: bars top left, statuses as tiles under them, the foe's name, statuses and bar at the bottom.

## Enemies and arenas

- The Kobold Swordsman, Kobold Greatsword and Kobold Shieldbearer (the user approved it; HP, poise and pacing the
  agent's), the Goblin Warlock (keeps away, chants Bolt Fire, backs off while chanting), the grey wolf (circles,
  crouches, lunges), the bog lurker (slow, slams and sweeps, best dodged), the chickens: every number and drop in
  `server/src/core/enemies/<id>.ts`.
- Arena looks: forest clearing, stone ruins, mire, quarry; which enemy gets which; dusky and warm. Looks only.
- Sky and light: a fill light, golden evenings, a sky dome with a sun halo and stars, rays in the arena, per-region
  moonlight.
- Sounds and music: every file and volume (SOUNDS.md, `client/src/audio/`); sounds from where they happen.

## Items, drops and money

- Item sizes, weights, stacks and effects (`ITEMS`); the boar's drops and chances; essence items.
- The bag: a 3 x 2 base bag and a 4 x 4 canvas backpack worn by every new character; given things go to the bag, then
  the backpack, then the cloth or a pile; taken things come off the cloth first; old saves laid out again.
- The cloth is 8 x 6, overworld only, weighs nothing, never saved.
- The bag in a fight: no cloth, the fight goes on and holds you still; a stun closes it; a dodge closes and dodges.
- Eating: standing still, one thing at a time, stopped by closing the bag, a fight starting, a dodge or a hit.
- Rarity: six tiers and their colours, per kind of item; treasure rolls per kill; the bog pearl; how a unique's holder
  is tracked (`unique_items`).
- Piles: 4 cells wide, opened by looking (2 tiles, 35°, with lag slack), only giving; the arena's piles beside the
  fallen; the arena closes after 5 minutes with its timer shown; death piles where the server's copy has you.
- Shops and prices: Bette's food, Mirela's potions, Garrick's forge, Fennick Cooper's changing stall; every price.
- Heavier swords: the Longsword and Greatsword, sold at Garrick's forge.

## World and people

- The world's layout: the Grass Field in the middle, the Waking Hollow west, the Mistwood east, the Old Quarry north,
  Highmere north-west down a road from its South Gate; filler between regions; names and music change halfway.
- Chunks: sent within a radius and dropped past a larger one; everything the camera sees drawn, built ahead, fogged at
  the edge; monsters far from every player sleep (`shared/src/world/chunks.ts`, `server/src/core/overworld/sleep.ts`).
- Highmere's two wards and how they grew grander (the Hall of Arrival, the throne room, the courtyard, the Market
  Ward's square, avenues and gates); who stands where; Highmere's prices.
- The training yard: Bram (a placeholder name) and his quest, three dummies, a spar; the starting area's quests.
- Summoning pads: a carved-stone tile; binding has no confirm and a corner notice; a missing pad wakes you in Highmere.
- Resting: campfires out in the wild, a reach with lag slack; resting doesn't move your respawn point.
- Every NPC, their lines and quests: the Hollow's Maren and Tobin, Corwin, Ilse, Hollis (who moves on to the
  Mistwood), Highmere's townsfolk, the Old Quarry's and the Mistwood's folk (`server/src/core/npcs/`).
- The Old Quarry's layout, enemies and arena; still and running water and their ripples; the Grass Field's layout.
- The view is 16:9 at most; the overworld camera's zoom range and start tilt.
- Multiplayer: the server list, `MAX_PLAYERS`, the shared overworld (tall grass per player, crossed swords over a
  fighter), duels (T to challenge within a short range, Y / N, a time limit), joining a fight (up to 4, at the edge).
- Chat: / opens it as its own input layer; line and rate limits; the last lines kept in memory only.
- Idle players are disconnected after 15 minutes (`IDLE_KICK_MS`) with no message the player caused, anywhere, a fight
  too (its 10-minute limit ends an idle fight first); a fight's heartbeat and resyncs don't count; close 4004, told on
  the title.
- Key bindings: a new default key a player already uses stays theirs, and the new action is left unbound.
- The admin panel's buttons: Complete current quest (to speedrun) and Reset my save (replay the start without wiping
  the database), and the other cheats.
- The encounter cheat's foe count (`/encounter <enemy> [foes]`, the panel's Foes row, `encounter(enemy, count)`): 1 to
  `MAX_ENCOUNTER_FOES` (8), all of one kind, spread on an arc as far out as a lone foe's start.
- Allies' bodies: two overlapping allies each move half the overlap apart across the floor (no speed passed on; one
  held by the wall leaves the rest to the other), four rounds a step; bodies keep their existing sizes; a dodging,
  staggered or dead player passes through allies too.
- The HUD's custom pointer and the "Inscribed" look's details (the user picked the style).
