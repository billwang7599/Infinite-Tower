# The agents' picks, for the user to review

Status: **to review**. Where the user said "make any assumptions" or "use your best judgement", the agents decided and
listed it here. Every pick is changeable; the details and numbers are in the code named. Still ask before deciding a
new mechanic. Most were tried by tests and a headless browser only, not hand-played.

## Character, core and stats

- Every stat starts at the average, 10; the stat formulas and the core's fill curve, essence per monster
  (`shared/src/battle/stats.ts`, `CORE`, each enemy's essence item).
- The core: a whole core takes no more essence and fill carries over; essence is an item (a 2 s Absorb, refused only
  by a whole core); a breakthrough counts at once, mid-fight too; points are placed free, outside fights, and taken
  back only by a campfire; death can cost a step across a realm; toughness doesn't shorten the counterplay's openings;
  HP regen for players only, paused after damage; agility speeds overworld walking too.
- The stats chart: its rim is the most a stat could reach at your step; hover shows the polygon and effect after.
- Advanced stats: the fight's own numbers for your gear and stats, worked out by the fight's functions.
- The sphere: a smoky pixel-art glass sphere, each realm's light its own shape and colour, breathing, sparks from 70%
  fill, a breakthrough animation; a 128 px card bottom left that flips between portrait and sphere (`gfx/core/`).
- A character's name is 2-16 letters, digits, spaces, ' or -; boy or girl only changes how the game refers to you.
- The count of fights won is saved and kept through death (no longer shown).
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
- The HUD's custom pointer and the "Inscribed" look's details (the user picked the style).
