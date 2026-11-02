# AGENTS.md

Infinite Tower is a browser game, single-player for now. You walk an HD-2D overworld (pixel sprites on 3D ground),
and fights happen in a small 2.5D arena (3D enemy, 2D sprite player). It's a TypeScript monorepo with three
workspaces:

- `shared/`: code both sides run (simulation, message types)
- `server/`: Node, authoritative; hexagonal (`core/` is the game, `ws/`, `api/`, `db/` plug into it)
- `client/`: Vite, Babylon.js, React UI

The user's rules for every project (subagents, comments and code style, test-first, PRs and stacks) are in
`~/.pi/agent/AGENTS.md`. This file has only what's specific to this repo.

## The docs, and keeping them current

- [ARCHITECTURE.md](ARCHITECTURE.md): how the pieces fit and talk, the rules, every folder and file, recipes for
  adding things, where to tune. Update it when you add, move or rename a file, or change how things talk.
- [README.md](README.md): a short description, the finished features, how to run it, the top-level folders. Update
  it when a feature is finished, or commands or top-level folders change.
- [FORMULAS.md](FORMULAS.md): every calculation that decides how the game plays (damage, stamina, stuns, speeds,
  skills, drops), where its numbers live, and a worked example. Update it when a calculation or its numbers change.
- [plan/](plan/): future plans and parked ideas, one file each, with what's decided and what's open. Update it when
  the user mentions a future plan or asks to note an idea, or a plan gets built (move what's true into the other
  docs, then delete or trim the plan).
- AGENTS.md: this file. Update it when the user decides something about this repo or game. How they want work
  done in general goes in `~/.pi/agent/AGENTS.md`.

[SOUNDS.md](SOUNDS.md) lists every sound and music file's pack, author and licence: sounds and music are CC0 only,
and each file added or removed changes its row there.

[ART.md](ART.md)'s "What to draw" counts the drawings each piece of art needs: update it whenever a look option,
body type, view, chibi facing or battle pose is added or removed.

Read ARCHITECTURE.md before changing code you haven't worked in. Keep each doc to its job: the README lists features
in a line or two each and only the top-level folders (the full tree and the numbers live in ARCHITECTURE.md and the
code), and plans stay out of ARCHITECTURE.md.

## Ask before deciding any game mechanic

Don't pick a game mechanic yourself. If a task needs a decision about how the game plays, stop and ask, with the
options, before you build it. That includes:

- player and enemy stats: HP, stamina, damage, costs, cooldowns, regeneration
- what heals or refills, and when
- what's kept or lost: on death, between fights, on disconnect / reconnect, when returning to the title
- encounters (where, how often, what appears), rewards and progression
- how controls feel (speeds, timings, camera)

This applies to defaults that seem obvious, too. If you notice that something already built implies a mechanic
nobody approved, say so and ask. When the user decides something, add it to the list below.

The world as it stands is a test world (the user: "the starter stuff is just to test things. dont assume the world we
have right now is permanent. its just a testing world + testing items."): the levels, items and their numbers
are there to try things with. Their numbers may be tweaked freely for testing; don't build on them as if they
were the real game.

Decided by the user:

- Never lock a player out (the user: "core game is like a semi-sandbox in terms of rpg. we never want to lock a
  player to a class, or whatever they want. they may need some effort to change so that its not free, but never
  locked or soft locked out"): every choice (a god to back, a build, a path) can be changed later. A change may
  cost effort, but no choice is permanent and none can leave a player stuck. It covers gameplay choices; the
  character's name and look stay fixed after creation for now (items or mechanics to change them may come later).
- One rule set for the overworld and the arena (the user: "we dont want special behaviour as much as possible.
  things that work in overworld should work similar/same as battlefield. and vice versa"): what both places have
  (the bag, eating, piles, Interact, resting...) works the same in both, through the same code. A difference needs a
  reason the other place can't support it.
- The game is more open world now (the user: "more open world now"): no floors and no realm locks, up or down; the
  tower idea is on hold ([plan/vision.md](plan/vision.md)). The Waking Hollow, the Grass Field, the Mistwood and the
  Old Quarry are test areas, kept reachable.
- New players start "in the main kingdom": every avatar first appears on one extravagant summoning platform, indoors
  for now, the first and largest pad, where the Maker's door first opened; the kingdom grew round it, with a
  humongous castle, to guard and use the stream of avatars, and its rulers see arrivals as theirs by right. "A guide
  greets and explains": the court herald, by the platform, says where you are and what an avatar is, names the
  controls only in what he says (no on-screen hints), and points you into town. Dying, anywhere, wakes you on the
  platform. Campfires are out in the wild only: the town has none. The town has three shops, food, potions and a
  blacksmith, each a keeper you trade with (money and shops, below). No enemies in the kingdom.
- New players start with nothing (the user: "start with nothing"): an empty bag, empty hands, no skill words. The
  herald sends you to an old man who gives you an old stick (the training yard, below). No spells to start.
- Money and shops (the user: coins are "stored in bags as items", "lost like the bag since its stored in bags as
  items"; "gold silver and copper makes sense. less for the player to think about"; "coins dont repack automatically.
  we should be doing this at a store/bank"): money comes from selling loot to shops and from quest rewards; monsters
  drop no coins, and players start with none. Three coins, gold, silver and copper, 100 of one making one of the next,
  carried in the bag as items, so lost on death as the rest is. Coins never repack by themselves: they're changed at
  any shop and at a money changer, both ways. Shops take any coins and give change in the fewest coins; what doesn't
  fit in the bag lands on the cloth, where the player may leave it. The cloth is much bigger (the user: "it's
  technically an infinite area... what if we need to rearrange a big item like a greatsword"). Three shops for now:
  food, potions ("make up some effects") and a blacksmith. Prices go by place (the capital, full of new avatars, is
  pricier), and a player's first purchase at each shop is cheaper; prices by how an NPC likes you come later.
- HP and stamina carry over between fights and are **not** reset on a new connection. They're saved through a
  server-side `PlayerStore` (Postgres now); game code only sees the interface, so the store stays swappable.
- Postgres is the only database (no separate NoSQL store). In dev it runs in Docker (`compose.yaml`).
- The server talks to it through Drizzle ORM: tables in `server/src/db/schema.ts`, typed queries, and migrations
  generated by drizzle-kit.
- Login is username + password for now (email / OAuth maybe later). No guest play: you log in to play. The dev
  database is seeded with the accounts test1, test2, test3 and user (password = username).
- Settings (key bindings, camera, volumes) live on the server with the player's save and come down in `welcome`; the
  client keeps them in memory and sends each change back. Nothing is kept in localStorage.
- Combat is two parts: gear (weapons, physical combat) and skills. Skills are the grammar (a Form, elements,
  modifiers), for making magic, enhancing yourself or anything else; nothing about them is magic-specific (they were
  called spells). The skillbook only stores built skills.
- Weapons are an arsenal: every weapon is an item with a row in `WEAPONS` (its kind of moveset and its stats), and a
  fighter cares only which weapon it holds; its animations play off that (the look by weapon, the motion by kind). A
  weapon's reach is the wielder's own arm reach plus the weapon's length. Weapons built from parts (hilts, blades) are
  planned ([plan/weapons.md](plan/weapons.md)).
- Heft scales everything and strength scales heft down (the user: "heft scales everything which is realistic", "a
  stronger person would use a greatsword well, while a weaker person wouldn't"): a weapon's wind-up, live time,
  recovery and stamina costs go × the heft its wielder feels, 1 + (heft − 1) × (10 / strength), players and enemies
  alike (strength 10 feels the listed heft; a heft-1 sword feels the same to everyone). Each weapon has a minimum
  strength: below it you can't wield it at all (option a): it won't go into a hand, the server refusing it, and the
  bag screen says why. The test numbers: sword 0, longsword 6, greatsword 9. Two-handed grips, halving the heft
  penalty, come later ([plan/weapons.md](plan/weapons.md)).
- One sword system, the Hybrid (the user tried five and kept it: "ok i like the hybrid one the most. get rid of
  everything else"), then made simpler (the user: simple to learn, deep to master, like Souls or Sekiro: a light, a
  heavy, a block with a perfect block, a dodge). For Honor's guard stances, the Combat style setting, and the Posture,
  One Strike and Master Cuts styles are gone (their branches stay on GitHub). Its rules are the user's (the numbers
  are first guesses, to tune):
  - Left click a light attack, right click a heavy, the scroll wheel a stab (K too). The swing's way comes only from
    the mouse, as flavour: a quick flick aims one of 7 ways (across, down from the top, and the four diagonals), a
    horizontal swing wide and a vertical one narrow. There's no straight upward swing (a downward flick does
    nothing) and no key aims. Locked on, attacks go where you face.
  - Every swing reaches as far, 1.15 × (arm reach + blade), about 2.2 m with the sword; the stab 1.75 ×.
  - Lights wind up readably: 0.35 s an opening swing, 0.25 a reverse, 0.45 a perpendicular, 0.3 any other; a heavy
    0.35 s more. Momentum never takes a wind-up under 0.25 s. A heavy has no hyperarmor.
  - Defence is one button (Sekiro's): holding block (Shift) stops any hit from the front, chipping 20% of it. Pressed
    within about 0.2 s before a hit lands it's a perfect block: no stamina, no chip, the blocker recovers sooner, and
    the attacker loses stamina. A press within 0.5 s of the last gets no perfect window (no mashing). No tap parry.
  - Blocking is the safe option, the swing parry the risky one (the user: "so our system is a blocking system and a
    parry system. the timing for parrys also scale with/against size"): your swing parries a swing meeting it, the
    exact reverse a full parry, within 45° of it a partial one. Whichever blade goes live first meets the other, if
    the other's goes live within the first's window (by its blade length, as the perfect block's: sword 0.2 s); the
    parried attack does no damage and recoils (0.8 s full, 0.5 s partial), and the parrier's swing ends with no
    recovery. Parries deflect, they don't stun. Blades live within about 0.05 s of each other clash: both recoil the
    base time. Stabs neither parry nor are parried. A swing's weight is its heft × √(strength / 10), × 2 a heavy, and
    the recoil goes × the parrier's weight over the parried one's (0.5 to 2, never under 0.2 s) ("parry heavy with
    heavy is the same effect. but parrying light with heavy should give heavy some advantage"). No stamina for being
    parried. The Kobold parries too, by a seeded share of the swings a player starts at it, with a real swing the
    parrying way.
  - Blocking goes by the blade (the user: small fast blades and big slow ones play differently): the perfect window
    grows with the blocker's blade length (0.2 s × length / 1.1: sword 0.2, longsword ~0.25, greatsword ~0.35), and
    raising the guard takes time that grows with the heft its wielder feels (sword 0.05 s, greatsword ~0.15 s at
    strength 10); a hit landing while it comes up isn't blocked. Enemies raise theirs the same way. No close-range
    penalty for big weapons.
  - Stamina is a player's only bar (no player poise): 150 to start (15 a stamina point); a light costs 10, a heavy
    16, a stab 12, a dodge 22. Holding block drains it slowly and it doesn't refill while blocking. A blocked hit
    costs stamina, a heavy twice its damage, and doesn't break the block by itself; at 0 stamina the guard breaks,
    a stagger of about 0.8 s. Enemies keep their poise as a hidden stagger meter.
  - No kick. Only a heavy can be feinted (the user: "yea sure heavy only feints ... we swing heavy but can press
    shift to cancel early to mess with their timing"): block pressed in a heavy's wind-up pulls it back into the
    guard, for 10 stamina, but not in the last 0.15 s before the blade goes live. It opens no perfect block and ends
    the chain. A light or a stab can't be feinted. The Kobold feints about 1 in 5 of its heavies ("sure add kobald
    feint"), told only by sound and its blade snapping back to its guard.
  - The old momentum, with the old numbers: the reverse swing chains quickest, a perpendicular one slowest; a chain
    builds damage and speed until a gap, a block, a dodge or a hit taken; a stab spends it.
  - The Kobold Swordsman fights by the same rules: chains of swings, holding a block and now and then perfect-blocking,
    by its own chances. The boar and the Goblin Warlock just keep working. The 3D player blade follows the ways.
  - A ring round you shows your aim all the time, For Honor style (the user: "it should bring back the ring (with the
    bottom ring missing) to consistently show what stance we're using. not just the indication on attack. similar to
    for honor style"): 7 wedges, none at the bottom, the aimed way's lit as soon as you flick. Only you see yours;
    enemies and other players get no ring, and their swings no marker.
  - Another's swing is read off its weapon (the user picked the weapon cue: "we need to make sure our models and
    animations clearly show the sword swing"): its blade drawn back on the side the swing comes from (each of the 7
    ways, and a stab's hand drawn back with the blade level), further for a heavy; a glint at the blade's tip just
    before it goes live; the swing's crescent trail (the one your own swing leaves) while live; and its whoosh from
    the side the blade sets off from. The Kobolds and other players alike. Sizes and timings are the agent's picks:
    `glintOf` in `client/src/visuals/battle/weapons.ts`, `GLINT_SIZE_M` in `blade.ts`, `SWING_SIDE_M` in
    `client/src/audio/battle.ts`.
  - Swing steering isn't built ([plan/ideas.md](plan/ideas.md)).
  Every smaller rule and the agent's numbers: "The Hybrid sword" under "Decided by the agent".
- The skill words a player knows are saved with the player in Postgres. A new player knows none (they start with
  nothing, above); how words are learned isn't decided yet.
- Skills are cast in fights only, paid in stamina from the same bar as dodging (no mana, no cooldowns), and run in
  the shared fight like the sword: the client sends the whole skill as an input, the server checks its words
  against what the player knows. Seven elements, each its own damage type with a status (Burning, Wet, Rooted,
  Pushed, Shocked, Marked, Cursed), and four reactions (Conduct, Doused, Fanned, Eclipse) on whoever a skill hits,
  players in duels too, each with a cooldown per target. Skill damage scales with skillpower (was Intellect); Summon
  is out for now. The tables and what's still to build: [plan/skills.md](plan/skills.md).
- Modifiers go in order: each changes the shot built from the Form, the elements and the modifiers before it (Amplify
  then Split: both Bolts amplified; Follow then Split: every Bolt homes; Split then Split splits each Bolt again). A
  repeat is a full step, with no diminishing returns ("we will penalize in the future by higher stamina costs"; for
  now every modifier costs 1).
- No caps on modifiers or segments ("no caps to augments", then none on chaining either): not in the rules, the
  builder or the wire. The only limits are stamina, the socket's message size and a server guard, the most skill
  objects one fight holds (`MAX_LIVE_SHOTS`, 256, the agent's pick; past it new ones don't spawn).
- Split splits a Bolt, and each further Split splits the split ones again: n Splits make 2^n Bolts, each smaller and
  dealing 10% less per Split (×0.9^n). They start at random spots (the fight's seed) in an upright circle round the
  player, facing the aim, its bottom clear of the ground, spaced apart unless there are too many to fit, and fly in to
  meet a point ahead, each off it by a little randomness. The size, the circle's and the point's numbers are the
  agent's picks.
- Skills are chanted in a fight: a key opens a big popup in the middle, a carousel of squares filled one word at a
  time (a Form, then an element, then elements, modifiers or a Form; after a modifier only modifiers or a Form; a
  Form starts the next segment, and the filled squares slide left with a mark where each segment starts). Words are
  clicked, searched for (Tab; across every kind that can come next, the matches numbered), or picked in two steps
  (the user: "categorized by the type of word (so we can choose 1, 2, 3) then choose the word"): 1 Form, 2 Element,
  3 Modifier, always those numbers (a kind that can't come next is greyed and its key does nothing, and there's no
  skipping to the only one), then that kind's known words, numbered 1-9 (one that doesn't fit is greyed with why, and
  its key does nothing); a word picked goes back to the kinds. Backspace in a kind goes back to the kinds, and among
  the kinds takes off the last word. Its keys are a layer of their own, so 1-4 don't cast there. The fight goes on
  and you can't move; a hit cancels it only if it staggers you; a dodge closes it and keeps the squares. A chanted
  skill costs the same as a saved one and is for that one cast. Chanting
  needs no book. Anyone may chant and quick-cast (enemies too, later other players), and the words being chanted are
  the shared fight's, shown in a small popup in front of every other chanter, always there while they chant; a stun
  breaks off anyone's chant alike. One cast at a time per fighter for now (maybe ~2 later). The
  skillbook (in hand) has 4 pages of saved skills, quick-cast with 1-4 (rebindable), written outside fights or in one
  (like chanting: standing still, a stagger cancels it, it takes time). The pages are saved with the player and the
  server checks every page and cast against the words they know. Death keeps the pages and the words.
- The sword and the skillbook are items you equip (slots: left hand, right hand, head, body, legs, boots); a new
  character starts with neither, swinging needs a weapon and quick-casting a skillbook. Dying drops them with the rest
  of what you carry. Equipped things count toward the carry weight but take
  no bag space. The bag screen shows the equipment on its left, a cloth in the middle (a grid to sort things on for a
  while; what's left on it when the screen closes is lost), then the bag.
- The server is hexagonal: `core/` is the game mechanics, and `ws/` (the game socket), `api/` (HTTP) and `db/`
  (Postgres) are outlets plugged into it.
- `api/` uses Fastify and its official plugins (cookie, static, websocket, rate-limit), with request bodies checked
  by the shared Zod schemas through fastify-type-provider-zod. Game messages stay on plain `ws` (`ws/`); Fastify
  only does the `/ws` handshake.
- Fights lock on: a fight starts locked onto the closest enemy, Q toggles the lock, Right Shift locks the closest,
  and the lock ends when its target dies. Locked, you face the target (A / D circle it, W / S close in and back
  off), the camera keeps it in view on its own, and the arrows retarget by screen side (a tie: the closest).
  Unlocked, the arrows or a middle-button drag turn the camera, and attacks go where it faces; the mouse alone
  doesn't turn it. Skills may home (the Follow modifier). The locked camera's numbers (top of
  `client/src/modes/battle/camera.ts`) are the agent's pick, to tune.
- Lock-on stays, and skills are balanced on the defender's side. A Bolt flies where it's aimed, at where the target is,
  never where it's going, so stepping aside makes it miss. Follow turns slowly enough that a dodge late in its flight
  shakes it. The Kobold reads a Bolt winding up at it and sometimes steps out of its line just before it leaves (a
  chance per cast from the fight's seed; not while attacking or stunned, and not from a cast quicker than its
  reaction); the boar doesn't. The wind-up, slower walking while winding up and the stamina cost keep skills from being
  spammed. The numbers (`followTurnRadPerSec` in `SKILL_EFFECTS`, the Kobold's `sidestep` in
  `server/src/core/enemies/kobold-swordsman.ts`) are the agent's picks, to tune.
- The inventory is a bag with a grid, like an extraction shooter's: every item is a rectangle of cells that can be
  turned 90° (other shapes maybe later, per item), and small items stack in one cell (boar meat 5 to a cell). One
  fixed bag per character for now (6 x 4); bag slots come later. No stash for now.
- What you carry also has a weight, against a carry limit that grows with strength. Like Dark Souls' equip load:
  up to the limit, nothing; over it, a dodge costs more stamina; over 120% of it, no dodging and you walk at half
  speed (overworld and arena). Stamina recovery isn't affected. Equipped things will count toward it without taking
  bag space.
- Drops are piles of items, not packed into the bag ([plan/drops.md](plan/drops.md)). A pile is opened and what you
  want dragged into the bag; anyone may take from it, first come first served. The overworld's E is Interact: it
  rests at a campfire, joins a fight or opens a pile, the nearest in reach winning ("e can be our interact button").
  An unpicked pile vanishes 10 minutes after it lands on the overworld ("we can do like a 10 minutes timer"), monster
  and death drops alike; time in the arena doesn't count. A won fight's drops land in the arena ("whoever is in the
  arena can get dibs first, then when you leave it goes to the overworld (if there's any left)"): after the win the
  players stay there and walk to them, everyone equal, first come first served, E opening the pile; the arena closes
  by itself after 5 minutes, and Enter leaves earlier, asking "are you sure" only while loot is still lying there
  ("auto leave arena after 5 minutes. you can still press enter, but if theres loot there's a are you sure popup").
  When the last player leaves, the leftovers become an overworld pile where the fight began, its 10 minutes starting
  then. The loot is shared ("lets have shared loot"): each fallen enemy's drops are rolled once for the fight, not
  once per winner, into the one pile, first come first served. E opens a pile only when you're next to it and
  looking at it ("make it so we can pickup if we're next to the item and looking at it"), the same way on the
  overworld as in the arena ("overworld piles open the same way as arena piles"): within reach and in front of the
  way you face, the one nearest that line winning if several are. In the arena you face where the camera does; on
  the overworld, the way your chibi faces (from its last step). A dead enemy's body disintegrates and is gone
  ("dead enemy body should disappear/disintegrate"), and stops blocking players from the moment it dies; its drops
  stay where they lie. A player who leaves the arena
  early fades out for the others ("the player who leaves early should fade"). Confirmed as built: disconnecting after
  a win isn't a loss, nobody joins a fight that's already won, and the win banner fades after 4 s. Death drops
  ("we can do death drops now"): dying drops all you carry, the bag and every slot, as a pile where you fell; a
  disconnect mid-fight is a death here too. In the arena the others still there get first pick, by the same rules as
  the enemy's drops; what's left goes to the overworld pile where the fight began when the arena empties, and a solo
  loss sends it all there at once.
- Dying is hardcore: all you carry drops where you fell (above), for anyone to take. The skillbook's pages are kept
  (the user: the saved spells survive death). The core loses the fill inside its step, or with none, a whole step
  (the core, below); the words and the story are kept. The starter kit (every word and weapon, kept on death) is gone:
  players saved with it keep what they carry until they lose it.
- Items so far: boar meat (heals), boar hide (2 x 2, light for its size), boar tusk (1 x 2, heavy for its size), the
  swords and the skillbook, each monster's essence, bread, a health potion, a stamina tonic, and the three coins.
- Eating takes time, the same everywhere (the user: "change it to delay everywhere. whatever we have in the
  overworld should mimic battle. and vice versa", "we should be able to interact with anything in our bag even during
  battle"): boar meat eaten from the bag screen takes about 1 s (its `useTime` in `ITEMS`) on the overworld, in a
  fight and in the arena after a win, and heals at the end; not at full HP. A hit or a stun during it stops it and
  the meat isn't used up. Mid-fight it's the shared fight's `use` input, so the server decides it.
- An item is its components (the user: "each item is an entity, and the entity has things attached like consumable.
  if its consumable, it holds the data of how long. and what the effect is"): `consumable { verb, useTime, effects }`
  and `wearable { on, verb? }` in `ITEMS`, as data (the bag stays counts per cell). Anything consumable is used
  through one shared rule (`shared/src/items/using.ts`) on the overworld and in a fight. Healing and refilling
  stamina (the tonic) are the only effects so far; new effects (damage, strength, a duration...) are game mechanics
  to ask about first.
- The bag screen is worked with the mouse, with no keyboard movement. An item is hovered (a light highlight; at
  rest about 600 ms, a tooltip with its name, size, weight and what it does), selected (a click; the same item or
  empty space deselects) or dragged (past a few pixels: a ghost under the pointer, green where it fits and red
  where it doesn't; dropped on a bad spot or outside the bag it goes back; dragging selects it), between the bag, the
  cloth and the equipment slots alike. R or a right click
  turns the dragged item; with nothing dragged, R turns the selected item and a right click the one under the
  pointer, in place, only if it fits turned. Enter, a double click or the Use button use the selected item. The
  bag's bindings are only turn (R) and use (Enter); mouse buttons aren't bindable. B and Esc close it, and you
  stand still while it's open (the world doesn't pause).
- Messages: small notices (drops and loot, a full bag, what's lost on death, resting, eating, quest news) go in
  the bottom-right corner; the big centre banner is kept for bigger events, which so far is only a fight starting
  (the arena's "YOU DIED" / "PREY SLAUGHTERED" banner is the fight's end, smaller and near the top). Messages
  wrap rather than run off screen, and item lists are never cut short. Each notice has a × to dismiss it early; the centre banner has none
  and fades away on its own. All of it lives in `client/src/ui/notifications/`, and game code only calls
  `say(ui.notifications, event)`: one table there (`EVENT_MESSAGES`) gives every kind of event its place and words.
- The arena's physics is Rapier (its deterministic build), and the fight is shared code: one `Fight` per battle,
  with its own physics world and fixed steps, for any number of players and enemies, so the server and the browser
  run the same fight on the same inputs. Fighters are moved by code, not pushed by forces, so the
  controls stay tight. An enemy shoves a player; a player can't push an enemy; dodging, knocked back or dead, a
  player passes through enemies. Projectiles, when they come, are ray or shape casts, not physics bodies.
- The server runs the arena fight and decides it: hits, damage, stamina, deaths and the result. The browser runs
  the whole fight itself too (you and the enemies) and shows it at once, so the boar reacts without lag; it sends
  only its inputs, each tagged with the fight step it's for. The server runs them on those steps: an input up to
  200 ms late still runs on its own step (the server waits for it), a later one on the server's next step; one up
  to 0.5 s early (a client briefly ahead of the server's clock) waits for its own step, and one further ahead is
  dropped, so a client can't run ahead of real time. Four times a second the server sends a hash of its fight's
  state; a client whose copy differs asks for the whole state, loads it and replays its inputs since. The result
  banner, loot, the bag and saving wait for the server's result (the client may keep animating). Tunable:
  `MAX_INPUT_DELAY`, `MAX_INPUT_LEAD_TIME` (the agent's pick) and `HASH_EVERY_STEPS` in
  `shared/src/battle/netcode.ts`. Another player, later, may lag on your screen; your own character is always instant.
- A dodge's i-frames start on the step the dodge does, so a dodge on the step a hit lands beats it, on the client
  and the server alike (`PLAYER.dodge.iframeStart` is 0).
- Skills ignore dodge i-frames, hurt invulnerability and blocks: a Bolt hits a dodging or blocking player (for now).
- A dodge (or the next attack) pressed during an attack isn't lost, however early in it: it waits, without cutting
  the attack short, and starts on the first step the attack lets another action start, as soon as its blade is done
  (the swing's `liveUntil`; after a chain's last attack, the next attack waits for its recovery too). If the player
  can't dodge then (no stamina, overloaded, in the air), the press runs out like any early press
  (`PLAYER.inputBuffer`). With an attack buffered too, the dodge goes first.
- Hit-stop, the hit's jolt and the sparks are drawing only, to tune: `hitStopMs` in `WEAPON_LOOKS` and the top of
  `client/src/visuals/battle/impact.ts`.
- The Kobold Swordsman (hand-tested and approved before guard stances) has its own corner of the Grass Field. It
  fights by the sword's rules above, perfect-blocking now and then. Its landed sword hits only hurt, with no
  stun or knockback (the boar's still stun). It drops only its essence. It holds its own Kobold blade (the sword's
  length, 14 damage), which never drops.
  Attack warnings come only from sound and the sprite's animation (the user: "we will have attack warnings from
  sound and sprite animation"; "we should have attack tells. ie large windups and stuff"): it draws its blade far
  back and turns its body, with a wind-up sound (its blade drawn), both bigger and lower before a heavy. There's no
  attack-warning marker (the Hybrid's ring of 8 wedges is gone with the direction keys); the lock-on diamond stays,
  since it shows which enemy you're locked onto.
  Numbers: `server/src/core/enemies/kobold-swordsman.ts`.
- Heavier swords (the user: "give me heavier and bigger swords to play with. make a second kobald with a greatsword
  too"; not hand-played yet): a Longsword and a Greatsword, sold at Garrick's forge. The Kobold
  Greatsword is the Kobold Swordsman with its own never-dropped greatsword, near the Kobold (16, 0 on the Grass
  Field), dropping only its essence.
- The Goblin Warlock (not hand-played yet) has its own corner of the Grass Field and drops only its essence; about
  40 HP. It keeps its distance (walks in to about 7 m, backs away inside about 4 m) and pokes with its staff only when you're
  right on it (about 1.5 m, 5 damage). It casts Bolt Fire, adding Follow about 1 in 3 and Split about 1 in 4 (the
  fight's seed picks, as for the Kobold's swings): quick-cast within about 6 m, chanted from farther through the same
  `startCast` / `chant` / `releaseChant` as yours, its words always shown in front of it. Its interrupts are yours (a
  stun or a stagger breaks the chant off), one cast at a time until it resolves. Its skillpower is 10 like
  yours, and it pays the same stamina from the same size of bar, refilled the same way. The other numbers (the chant's
  pace, the poke's timing, the cooldown) are the agent's picks: `server/src/core/enemies/goblin-warlock.ts`.
- The Goblin Warlock walks backwards while it chants, facing you, if you're inside its keep-away distance; the chant
  goes on. How fast is the agent's pick: its walking speed, as when it backs away otherwise.
- Arenas have looks of their own, looks only: the same round wall and radius, nothing inside it, nothing that changes
  how a fight plays. Dusky and muted with warm light (toward the title's dark fantasy, not black). The server picks
  the arena: a spawn may name its own, else the level's (tall grass uses the level's). On the Grass Field the boar
  fights in a forest clearing, both Kobolds in stone ruins and the Goblin Warlock in a mire; every fight in the Old
  Quarry, duels too, is in a quarry (the looks and which enemy gets which are the agent's picks).
- A player who disconnects mid-fight has lost it: what they carry drops as on a death. A fight
  still undecided after a time limit ends as a loss, a guard on the server's resources. Both are named constants in
  `shared/src/battle/fight/outcome.ts` (`LEAVING_LOSES`; `MAX_FIGHT_TIME`, 10 minutes, the agent's pick of a
  generous value), for the user to change.
- Sound effects (the user: "yea just go with what you think is right"; which files and how loud are the agent's picks,
  not listened to yet): swings (lower and heavier the heavier the blade, and a heavy attack's than a light's), hits,
  blocks, footsteps, dodges and jumps, the enemies' grunts when hit and on death (boar, Kobold, Warlock), skills (the
  cast, a loop while a Bolt or Beam flies, the impact), eating, picking up and moving items, UI clicks, resting, and
  the Kobold's wind-up as part of its tell (the boar's charge and lunge got a growl the same way, the agent's pick).
  With blocks (the agent's picks): a perfect block's clash, a heavy crash as a guard breaks, and a heavy's wind-up told
  by a low blade-draw (a player's as it starts; the Kobold's tell lower before a heavy).
  Ambient loops: flowing
  water near running water only (a lake or pond is silent), the mire's bubbling near the Mistwood's still water,
  louder the nearer the water (from the shared water map), and crackling near each campfire; the mire arena bubbles.
  Sounds come from where they happen: quieter further off, panned left or right, and
  each play a little off in pitch and volume so repeats differ. Master, Effects and Ambient volumes in Settings
  (80%, 100%, 100% to start), saved with the other settings. Sound starts only after a click (the browser's rule).
  Every file is CC0, listed in [SOUNDS.md](SOUNDS.md).
- Music (the user: "we can find some royalty free looping music? match the vibe of the scenery/battle", then "yea just
  go with what you think is right"; the tracks, how loud and the rest below are the agent's picks, not listened to yet):
  CC0 seamless loops, one per scene, crossfading over 1.5 s when the scene changes. The title plays Junkala's
  "Innocence" (also while making a character), the Grass Field Kauffman's "Forest Whisper", the Mistwood cynicmusic's
  "Dark Forest Theme", the Old Quarry Junkala's "Tha'el Mines", fights in the forest clearing, the stone ruins and the
  quarry (the duels too) Junkala's "Army Approaching", and fights in the mire Junkala's "Encounter With The Witches". A
  fight's music fades out as it's decided, so the victory or defeat sound rings out, and the arena stays quiet until you
  leave. A fourth volume, Music (100% to start), saved with the others. The volumes come with the save, so before Play
  the title's music is at the default volume.
- Dev servers have an admin panel of cheats (the user: "an admin panel in dev for cheats like fast forward time
  ..., fast forward day/night, spawn enemy, invulnerability, give items, etc"; the details are the agent's picks): F1
  opens it, and the server ignores cheats in production. Time controls move only the day clock (drawing), not the
  game's tick. Invulnerability lasts the connection (not saved) and is part of the fight's state; give packs into
  the bag by its rules (overworld only); heal refills HP and stamina, in a fight too.
- Dev servers simulate a network ping on the game socket, half each way and in order, so the netcode can be felt
  locally: `DEV_PING_MS` in `.env` (any whole number of ms, 50 if left out), or `?ping=N` on the page for one tab.
  Production never delays.
- The Grass Field is a tile map (the user: "go" on these picks): trees, rocks, water and ruin walls block walking for
  the player and overworld enemies alike (you slide along them; a walker is a 0.6-tile square), the start, campfire
  and spawns stayed where they were, and the map grew to 44 x 30 tiles with a ring of trees round it. Still one level,
  no exits. It's a dusky, muted grassland with warm campfire light, and the HUD shows "Floor 1" before its name (the
  floor comes with the level). Its paths, stream, ruins and tree lines are the agent's layout.
- The overworld is drawn in 3D, HD-2D style (the user: "i think 3d view is much cooler actually. can we make that
  default? and archive 2d view for now"). The flat 2D view is archived at the git tag `archive/overworld-2d`
  ([plan/overworld-2d.md](plan/overworld-2d.md)).
- The overworld camera turns: Left / Right (`turnCameraLeft` / `turnCameraRight`, rebindable) turn it a quarter turn
  with a short ease (`CAMERA_TURN_TIME`, 0.25 s). Walking is relative to the camera (W away from it, A / D to its left
  and right), and sprites and the chibi's pictures follow it. The way it looks is saved with the settings (north for a
  new player).
- The overworld camera tilts (the user: it "stays where it is", not saved): held, Up / Down (`lookUp` / `lookDown`,
  rebindable) tilt it toward the horizon or toward straight down, stopping short of both, and it stays where it's
  left until the page reloads. The numbers are the agent's picks: 50° to start, 25° to 65°, 1 rad a second
  (`CAMERA_PITCH` in `client/src/modes/overworld/facing.ts`); past about 65° the upright sprites look squashed.
- A duel challenge's reach gets the same lag slack as resting and joining a fight: the server accepts a player up to
  `CHALLENGE_RANGE_TILES` + `LAG_SLACK_TILES` (2 + 0.6 tiles) away.
- Chat is the whole server's: everyone online hears every line, on any level and in fights. A line shows in the
  chat log and, in the overworld, as a bubble over the speaker's head (in a fight, the log only). / opens it (a
  binding, in the overworld and the arena), and while its box has focus it's its own input layer, `chat`, owning
  only Enter (send) and Esc (close): nothing else fires (no walking, challenges or attacks; you stand still), and
  the text is typed by the browser into a plain `<input>`. The layer follows the box's focus, as in WoW or FF14: a
  click elsewhere (the game) takes it, and the keys go back to the game with the chat still open, its box dimmed
  with "Press / to chat" (the key read from the bindings); / or a click on the box focuses it again. The client
  sends only the text (trimmed, not empty); the server
  stamps the character's name. It keeps the last 1000 lines in memory only (lost on a restart) and sends a player
  who joins the last 50. A line is at most 500 characters, and a player at most 10 lines in 5 s; past either, the
  line is dropped and the sender told with a small notice (`MAX_CHAT_CHARS` in `shared/src/net/server-messages.ts`;
  the rest in `server/src/core/game/chat.ts`).

- Quests: NPCs give them, and the story runs through chains of them. An NPC offers one at the end of what it says,
  and you pick Accept or Not now; there are no other dialogue choices. A step asks you to gather (have N of an item),
  deliver (hand N over, taken from the bag), go somewhere (a level, or an area of it), talk to someone, or kill N of
  an enemy kind (counted from won fights). Rewards are items, story progress (flags) and lore entries only (no
  essence or friendship yet). Each player's story is their own (no party sharing), kept on death like the words, and
  saved with the player as one `jsonb` (`story`). The server decides all progress; the client only asks (accept,
  deliver: Zod-checked) and draws.
- The story is data run by one engine (the user: "a dialogue api, so what they say is just from the character data,
  and also a quest thing, where it helps build the lore and quest"; "it might be simpler and more reasonable for the
  npc to display dialogue based off of where they are + quest"). Quests are one table on the server
  (`server/src/core/content/quests.ts`): named steps (saved by name) and what each gives (items, flags, lore ids), no
  lines. Lore entries are one table by id (`server/src/core/content/lore.ts`). An NPC's own file
  (`server/src/core/npcs/<id>.ts`) holds where it stands and what it says: its stops (a level and a spot, with a
  condition on the story), each with its lines by the story (a quest's step, a quest that can start or is done, a
  flag) and what they offer. The server places each NPC per player at its first stop that holds (two players may see
  it in different places), and it says the first lines there that hold. One engine (`server/src/core/game/story.ts`)
  checks the conditions and applies the effects for quests and NPCs alike.
- The questbook is always yours (not a bag item, never lost), its own screen on H (a general key, so it opens in
  the arena too; the agent's pick: it was J, journal, until the sword's aim grid took J). It has two halves:
  the main quest
  (the main lore: the soul, the tower, the gods, the Maker) and side quests (side lore). Each quest shows its next
  step and a hint (where to go, only as the NPC told you), and the lore it revealed is listed under it. It holds only
  what your character has found out, revealed slowly, AQW-style. No map markers and no minimap.
- The core: progression without levels, like the Murim manhwas and The Beginning After the End
  ([plan/core.md](plan/core.md) has what's still open). 5 realms of 3 steps, named (the user's pick, fiery to ethereal)
  Yan, Sol, Lux, Ling and Tian, and Early, Middle and Peak ("Middle Yan"). A step has a fill; full, it breaks through
  to the next on its own (maybe a minigame later). It's filled with monster essence: beaten monsters drop it, each its
  own worth (a Kobold's more than a boar's), and it's absorbed from the bag anywhere, mid-fight too, as a 2 s use, the
  same on the overworld and in a fight. No mana: one stamina pool for physical and magical, growing with the core.
  Stats: strength, agility, stamina, skillpower, vitality (HP), defense (cuts physical damage) and special defense
  (cuts skill damage), and three hidden ones, toughness (stun recovery), stamina recovery and health regen (HP coming
  back on its own), +1 every step in every realm, no free points into them. A step raises every stat by a flat amount
  that doubles each realm (1 in the first) and gives free points (2 in the first, doubling), placed in any stat and
  never locked in (taking them back costs some effort). HP comes only from vitality. On death the step's fill is lost,
  or with none, a whole step. Floors don't need a realm. Enemies' realms aren't shown (and come later, with floors).
  The F1 admin panel adds and removes steps. Nothing about it should read like XP. The HUD has your portrait in the
  bottom-left corner, and a click flips it over to your core: the avatar's soul as a sphere with light growing from its
  centre, not a filling orb. Each step the light grows bigger and brighter, its colour changing with each realm from
  fiery (Yan) to ethereal (Tian); inside a step there's no number or bar, only the light breathing (a slow pulse) and
  sparks when a breakthrough is near, and a breakthrough gets a moment. The character panel shows the stats as a
  polygon chart (like Pokémon's) with a small number under each stat, for any number of stats (more can be added),
  with + and − for free points; the hidden stats stay hidden.

Decided by the agent while the user was away (the user asked for these to be decided and listed, and will review
them; treat them as changeable, and still ask before deciding new ones):

- The count of fights won is saved with the player and kept between connections; dying doesn't reset it.
- Key bindings: a new default key that a player's saved keys already use stays theirs, and the new action is left
  unbound (Unbound in Settings) until they bind it or free the key. Only saved keys that clash with each other send
  a group back to its defaults.
- Stats and the core's numbers (the user let the agent set them, in plan/core.md's table; all in FORMULAS.md's
  "Stats" and "The core"): every stat starts at 10, where each is ×1. HP 10 × vitality, the stamina bar 15 × stamina,
  physical and skill damage × √(stat / 10), damage taken × 50 / (40 + defense or special defense), stuns × 10 /
  toughness, stamina refill × stamina recovery / 10, HP regen vitality × health regen / 200 a second, walking and
  dodging × (agility / 10)^¼, carry limit 60 × (strength / 10)^¼. Fill to finish step n: 100 × 2^((n − 1) / 3).
  Essence: boar 20, Kobold Swordsman 40, Kobold Greatsword 50, Goblin Warlock 30. Boar meat heals 35% of the most HP.
  Enemies: every stat 10 but skillpower (0, the warlock's 10) and health regen (0); their HP stays their own.
- The core, built (PR 1 of it; the user: "go make more content… make any assumptions you want"; none hand-played
  beyond a headless check):
  - Finishing a step gives its gains; finishing the 15th (Peak Tian) leaves the core whole: no more essence, still
    named Peak Tian. Essence past a step's fill carries into the next, through as many steps as it fills.
  - Essence is one item per monster (1 x 1, stacks of 10, weight 0.1), always dropped (one each, into the fight's pile
    like the rest of its drops), absorbed by the shared use rule like eating ("Absorb", 2 s): standing still, a hit or
    a dodge stops it with the essence kept, refused only by a whole core (so at full HP too).
  - A breakthrough counts at once, mid-fight too: the fight's stats grow by the step's gains and the HP and stamina
    bars by theirs, what's in them by as much. When stats shrink (a point taken back), a bar only cuts what's in it to
    fit. A breakthrough is a corner notice.
  - Free points are placed one at a time, free, outside fights (on the overworld); the effort to take one back is
    being by a campfire (Rest's reach and slack). No other cost.
  - Death: the fill, or with none a step (back across a realm too: realms aren't floors you keep); Early Yan with
    nothing has nothing to lose. The lost step's points come off the stats with the most first. A disconnect
    mid-fight is a death here too (`LEAVING_LOSES`). A duel costs the core nothing, and what was absorbed in it stays.
  - Toughness shortens a body blow's stun, an enemy's stagger and Lightning's stun, not the openings a perfect block
    or a broken guard leaves (the counterplay's sure punish windows).
  - Defense counts against weapon and body hits, special defense against skill hits and burns, before Warded and the
    Light shield.
  - HP regen runs for players only, on the overworld, in fights and in the arena after a win; in a fight it waits 5 s
    after any damage (a burn's tick too). The server sends HP in `state` while it comes back.
  - Agility speeds overworld walking too (one rule set).
  - The character panel shows the realm and step, the free points and the seven shown stats with + and − (− only by
    a fire). The admin panel's step up / down is overworld only and
    empties the fill.
  - Saved in three columns (`core_steps`, `core_fill`, `stat_points`); players from before start at Early Yan, empty.
- The stats chart (core PR 3; the user: "just make it. assume whatever you want"; tried headless, not hand-played):
  - Its rim is the most any shown stat could be at your step (its value with no points placed, plus every free point
    earned), and its centre 0: the rim stays put while points are placed, all of them in one stat reach it, and a
    new core's stats all sit on it. Four rings, at quarters. Numbers: `client/src/ui/hud/character/chart.ts`.
  - The stats go clockwise from the top in their usual order (strength at the top); special defense is "Sp. defense"
    on the chart. Under each name, its number between − and +.
  - A point is still placed or taken back at once, with no confirm step. Hovering + or − shows the polygon after it
    (dashed) and the stat's effect now and after; hovering a stat shows what it does under the chart (the list's
    lines are gone otherwise).
  - The character panel is wider for it: 336 px (was 288).
- The sphere HUD (the user: "just make it. assume whatever you want"; only checked in a headless browser):
  - It follows the mockups the user saw: a smoky pixel-art glass sphere, 64 pixels shown at 2x, dithered to 8 shades,
    lit from the top left, its glass clearing realm by realm. Each realm's light has its own shape and colour: Yan a
    flickering flame (its sparks rise like embers), Sol a sun with rays, Lux a white star with cross spikes, Ling a
    teal and violet spirit swirl, Tian a pale light with a halo ring round the glass that brightens each step.
  - Brighter every step. Bigger every step of a realm; a new realm starts condensed, smaller than the Peak before it
    but bigger than the last realm's Early (as in the mockups). A whole core looks like Peak Tian. Numbers: `LIGHT` in
    `client/src/gfx/core/light.ts`.
  - The light breathes over 4.2 s (size and brightness). Sparks start at 70% of the step's fill (`SPARKS_FROM`) and
    thicken toward the breakthrough; a Peak's are now and then the next realm's colour.
  - A breakthrough (only one the game tells, with `say`): the light gathers for 0.9 s (shrinking and brightening, sparks
    drawn in, the sphere trembling), flashes at 1 s (the new step showing from then), a ring spreads and it settles by
    2.8 s (`BREAKTHROUGH` in `sphere.ts`). With the portrait up, the card turns to the core for it and back 4.3 s after
    it began; a click turns it back sooner. Several steps at once are one breakthrough. The admin's step buttons and a
    step lost on death change the sphere with no moment.
  - The card is 128 px wide, bottom left in both modes: the portrait (the creation one, at 2x) and your name in a band
    on its front, the sphere and the step's name ("Middle Yan 炎"; the glyph for Yan, Ling and Tian) on its back; it
    turns in 0.6 s. It stays turned between the overworld and fights (not after returning to the title), and in a fight
    it shows the fight's core, so a breakthrough there shows at once. No key turns it.
  - The realm line under the bars is gone: the card's back and the character panel name the step.
  - The chat and the arena's hotbar moved up above the card, and the notices keep clear of its right edge.
  - It's painted at most 30 times a second and only while the core side shows (under 1 ms a paint).
- A flick is a mouse move of 40 px within 150 ms (the flick sensitivity, 0.5 to 2, default 1, divides the 40);
  slower or smaller movement is dropped. Once a move flicks, more movement the same way is the same flick until the
  mouse rests 100 ms; turning away flicks again at once. The numbers are `FLICK` in `client/src/core/actions.ts`, to
  tune by feel. The setting was Swing sensitivity; a saved value of it is dropped.
- The Hybrid sword (the user's design, above; every detail below the agent's, tried only in a headless browser, none
  hand-played; numbers in `shared/src/weapons/hybrid.ts`, the Kobold's in its `weapon` attack in
  `server/src/core/enemies/kobold-swordsman.ts`):
  - Keys, in the arena's group: K and the scroll wheel stab (one stab per turn of the wheel: a scroll that rests
    150 ms), left Shift blocks (a tap shorter than a step counts). A flick of the mouse aims (`FLICK`, below): right
    swings from the right, up from the top, down-left from below on the left, and so on; straight down aims nothing.
    The aim stays between attacks; a fight starts aimed from the top; unlocked, attacks still go the aimed way. The
    old aim keys and the kick are dropped from saved keys; the questbook stays on H.
  - Attacks: a light winds up as the user set (above), is live 0.1 s and recovers 0.08 s, poise 12. A heavy: 0.35 s
    more wind-up, live 0.12 s, recovering 0.2 s, twice the damage, poise 24. The stab: 0.3 s (the agent's pick, so it
    isn't the quickest attack while reaching furthest), 1.25 times the damage, poise 18, a 16° arc. A heavier weapon's
    heft, as its wielder's strength feels it, stretches every part. Arcs by line: 160° across, 110° on a diagonal, 60°
    down from the top.
  - Momentum, the old numbers: +1 a reverse, +0.5 any other, +0.25 a perpendicular, at most 4; each point 25% more
    damage (×2 at most) and 10% sooner (never under 0.25 s); a stab adds 50% per point and spends it. A swing down from
    the top has no reverse. An attack chains if it starts during the last one or within 0.25 s of its end; a dodge, a
    block, a cast, the chant, the bag, a hit taken or a perfect block against it breaks it.
  - The held block covers 140° in front and walks at 40%; held, it drains 5 stamina a second. A blocked hit costs a
    player its damage in stamina (a heavy twice), chips 20% (a stab too), and stops the blade with no recoil: the
    attacker may chain on. A body blow (the boar's) chips nothing but pushes back 60%. A blocked hit that takes the
    last of the stamina (or more) breaks the guard: staggered 0.8 s. The drain alone never breaks it; it leaves
    nothing for the next hit. An enemy's held block costs it the hit's poise instead, and out of poise it staggers as
    when hit.
  - The guard comes up in 0.05 s + 0.17 s for each point of felt heft over 1 (`raiseTime`, `raiseTimePerHeft`):
    longsword 0.08, greatsword 0.15 at strength 10. The perfect window opens once it's up, so a heavier blade has to
    be pressed earlier. An enemy's comes up after its `blockReactTime`, a feint's too.
  - The perfect block: a block press opens a window (0.2 s with the sword, by blade length), even let go again, as long
    as nothing else starts; a weapon from in front lands in it blocked perfectly: no stamina, no chip; the attacker
    loses 10 stamina (if it has a bar) and recoils 0.4 s (a stagger, its chain lost), so the blocker gets in first. A
    press within 0.5 s of the last opens no window. Body blows can't be blocked perfectly.
  - Openings (a perfect block's recoil, a broken guard, a parry's recoil) aren't shortened by toughness.
  - Swing parries (numbers in `HYBRID.parry`, `fight/weapons/parry.ts`): checked when a blade would land, before hurt
    invulnerability, on a defender whose swing is aimed at the attacker (within the block's 140°). The window counts
    from the parrier's blade going live. In reach, its blade lands first and the parry is settled then, against the
    other's blade still to come; out of its reach, the window holds only while its swing lasts (a sword light's
    ~0.17 s). The swing that parries does no damage
    either, and a parrying player's chain goes on. A clash is any two blades live within 3 steps (0.05 s) of each
    other. Felt by angle: facing each other the other's way is mirrored, so the same named way (lr against lr) meets
    head on; the straight-down swing has no exact reverse (no upward swing) and is only ever partly parried, by a
    rising diagonal. The Kobold (the Greatsword too) reads 15% of the swings a player starts at it while walking up and
    not perfect-blocking (`parryChance`), and swings the meeting way (light) so its blade goes live 5 steps before the
    player's; after any parry it answers at once with a quick swing, as after a perfect block. Sounds and shows as a
    perfect block does (the clang, the hold, sparks); a clash bounces both with sparks.
  - The Kobold (the Greatsword too): a swing winds up 1.1 s, chained ones 0.45 s (its old, approved numbers), a heavy
    0.35 s more; any of the 7 swings or the stab, never the same twice running, 30% heavies, chains of 2 or 3; 0.5 s
    of recovery after a chain, then its cooldown. Walking up it holds a block (from 0.3 s in). It perfect-blocks 30% of
    the swings a player starts at it in reach while it's walking up (a read, so its block needn't be up yet), and
    answers at once with a quick swing. Its poise is 80 (was 40), so a player spamming lights doesn't stagger it every
    few hits and loses (the bot test). The seeded rolls are the fight's, as for its other choices.
  - Feints (numbers in `HYBRID.feint`; the Kobold's share is `heavyFeintShare`, 0.2): a feint's press counts as a
    block press, so a press within 0.5 s after it gets no perfect window either; a player needs some stamina left
    to feint, as for any attack. The Kobold pulls a feinted heavy back at the latest it may (0.15 s before it would go
    live), straight into its held block; its chain ends there, it pays no stamina (its swings cost none), and it waits
    its cooldown (1.2 s, with no recovery) before its next chain. A feint sounds as a quick, high blade-draw.
  - Drawn: the sprite takes the drawn swing nearest each way (the diagonals from below the side ones, the stab the
    overhead one) while its 3D blade sweeps the real way; a stab points ahead and leaves no trail. Aimed, the blade is
    held on that side (the guard-left / top / right poses); blocking, up top. A perfect block shows and sounds as the
    old parry (a clash, a longer hold, a shower of sparks); a broken guard crashes.
  - The aim ring: 7 faint wedges 0.8 m round the chest, the aimed one gold, over everything, and a gold diamond on the
    chest while a stab winds up; hidden with no sword in hand, once you're down and once the fight is decided
    (`client/src/visuals/battle/aimRing.ts`).
- Skills' numbers (D = 10, the Bolt's speed and range, the Nova's radius, ...), what Self does per element, how the
  Beam is held and paid, what Imbue does to sword hits, how strong each modifier is, lingering clouds of 8 s, and the
  smaller rules the user's design left open are in [plan/skills.md](plan/skills.md) under "Decided by the agent".
- Chanting and the skillbook: R opens and closes the chant (E was kept free; it's now Interact in the arena too).
  Writing a page in a fight takes 2 s (`SAVE_IN_FIGHT_TIME` in `shared/src/skills/skill.ts`); a Write button per
  page, while Enter casts. Outside fights the book opens from the bag screen (Open, a double click or Enter on the
  book in hand: it has to be equipped) and a page is written at once, anywhere (no campfire needed). Tab focuses
  the word search, whose Enter takes the first word that fits; numbers pick the first nine that fit. The chant and
  writing a page are the shared fight's, so the server decides them too: the chant is a held fight input, during
  which the fight holds you still (stamina still recovers); a skill on none of your pages is cast only from an open
  chant (pages are matched by their words); a page written in a fight is the fight's at once and saved with its
  result (a `saveSkill` message mid-battle is refused). The chant's dodge goes where the walk keys point. The hotbar
  shows the pages on the left of the battle HUD.
- Equipment: the sword is 1 x 3 and weighs 3, the skillbook 2 x 2 and 1.5 (with both in hand a full bag is just over the
  carry limit). Either hand takes either; the sword starts in the right and the book in the left; dragging one hand onto
  the other swaps them; from a grid, only into an empty slot that takes it. No sword in hand means no attacks and no
  block (you block with the blade); no skillbook, no quick-casting or writing pages. Head, body, legs and boots stay
  empty (no armour yet). Saves from before equipment get the starting sword and skillbook in hand.
- The cloth is 8 x 6 (it was 4 x 4; `CLOTH` in `shared/src/items/gear.ts`), overworld only, and laid on the ground, so
  what's on it weighs nothing. It lives on the server, which drops what's on it when the bag closes, when you walk (the
  bag must be shut), when a fight starts and on disconnect; it's never saved. Things on it can be eaten from there.
- The bag in a fight: B opens the bag screen in the arena too, without the cloth; the fight goes on, it holds you
  still while the bag is open (stamina still recovers), and B or Esc close it. Things move between the bag and the
  equipment slots, and within the bag, at once, as the shared fight's inputs (`bag` held, `gear` pressed), so the
  server runs and checks them with the same gear rules; what the fight's bag and slots end up as is its result. A
  stun closes it, as it ends the chant, and a dodge pressed in it closes it and dodges. Meat is eaten from it as on
  the overworld (the pressed input `use`).
  The skillbook opens from it (book in hand) and writes a page in the fight's 2 s; with the book open over the bag,
  no dodge gets through.
- A character is a name (2-16 letters, digits, spaces, ' or -), boy or girl (only how the game refers to you; every
  look is open to both), and a look (shared LOOK_OPTIONS, drawn in client/src/gfx/look/, ART.md). One per account,
  made on the first visit before the server sends a level, then locked: the server ignores a second one. It's
  cosmetic only: classless, everyone starts the same.
- Resting: each level out in the wild has campfires (the Grass Field has one, 3-4 tiles from the start). Standing within
  1.6 tiles of one, the Interact key (E) or the HUD's "Rest by the fire" button refills HP and stamina, as often as you
  like. The server checks you're there (with 0.6 tiles of slack for lag) and saves. Resting doesn't move your respawn
  point or bring back defeated boars; dying still wakes you on the kingdom's platform.
- Items: boar meat heals 35% of the most HP (eaten from the bag screen, not at full HP) and weighs 0.5; a hide
  weighs 2 and a tusk 5. A beaten boar drops meat 60% of the time, a hide 35% and a tusk 25%, each rolled on its
  own. The carry limit is 60 × (strength / 10)^¼ (60 at the start). Over it, a dodge costs 30% more stamina. A new
  bag is empty. The server checks every move with the shared bag rules (mid-fight, the fight does).
- Eating, as the open bag already behaves in each place: you stand still while eating; one thing at a time, and
  nothing in the bag moves meanwhile (as while a page is written); closing the bag, a fight starting or a dodge
  stops it, nothing eaten. Of damage, only a hit stops it: a burn's damage over time doesn't.
- Heavier swords: the Longsword is 1 x 3, 1.4 m, weight 4.5, heft 1.2, 11 damage; the Greatsword 1 x 4, 1.9 m, weight
  8, heft 1.6, 16 damage (about the sword's damage per second); the Kobold Greatsword's blade is the greatsword with
  the Kobold blade's 14 damage. Numbers: `WEAPONS` in `shared/src/weapons/weapons.ts`.
- The Grey Wolf (the user: "continue to add content... based off of your best judgement"; the design, quick and frail,
  circling, a telegraphed lunge-bite and a hop back, was OptChat's brief; every number is the agent's, tried by bots
  and a headless browser, not hand-played): 70 HP, walks 4.6 m/s, poise 30 (12 a second, 0.7 s stagger). In a fight
  it circles 4.5 m off (3.2 m/s round, its walk in or out), then after 1.2 s plus up to 1.6 s (seeded; 1 s plus the
  same at the start) crouches 0.6 s with a growl, tracking you until 0.2 s before it leaps (13 m/s for 0.35 s, from
  within 6.5 m), biting 14 within 1 m (a body blow: blocked, never perfectly; knockback 6). It then stands open
  0.45 s if the bite met you (taken or blocked) or 1.1 s if it met nobody, and hops back 2.4 m. It can't be staggered
  from the crouch to the landing, so swinging at it while it commits only trades. Its tells are the crouch, the
  growl and its eyes lighting, no marker. Numbers: `server/src/core/enemies/grey-wolf.ts`, the behaviour in
  `shared/src/battle/fight/behaviors/pounce.ts`. Drops: its essence (worth 25) always, a wolf pelt 35% (2 x 2, weight
  1.5, worth 30c) and a wolf fang 60% (1 x 1, stacks of 10, weight 0.1, worth 15c); the forge buys both. One on the
  Grass Field's far north-east corner and one in the Mistwood's south-west woods, back 10 s after their fight; on the
  overworld it wanders at 1.8, notices you within 5 tiles in 0.4 s and chases at 4.2 (you walk 5). Not in tall
  grass. Its sounds are CC0 creature sounds pitched up (`wolf-*` in SOUNDS.md), unheard.
- The Bog Lurker (the user: "continue to add content... based off of your best judgement"; the design, slow and
  tanky where the wolf is quick and frail, lying low and rising to a slam or a tail sweep you should dodge rather
  than block, was OptChat's brief; every number is the agent's, tried by bots and a headless browser, not
  hand-played): 200 HP, walks 1.5 m/s and turns 1.4 rad/s, poise 100 (10 a second, 1.2 s stagger). It creeps up low
  in the bog; within 3 m and facing you it rises over 1.3 s with a groan, turning toward you until 0.35 s before it
  slams (38, 2.6 m ahead, 60° either side, knockback 12, the screen shaking), then stands open 1.5 s. If you're
  within 2.8 m and over about 73° off its facing (beside or behind it, where its slow turn lets you get), it coils
  0.75 s and sweeps its tail all round (20, knockback 10), then stands 1 s. 0.8 s after either before the next; the
  first after 1.5 s. It can't be staggered from the rise or coil to the blow. Both are body blows, so blockable, but a
  blocked slam costs 38 stamina (a dodge 22) and its push puts you out of reach of the opening: in the bot fights a
  dodger wins in about 39 s, a blocker in about 66 s, and one who only swings loses. No new rules: the slam reuses
  the charge's `slam` event for its thud and shake. Its tells are the rise, the eyes lighting and its groan, no
  marker. Numbers: `server/src/core/enemies/bog-lurker.ts`, the behaviour in
  `shared/src/battle/fight/behaviors/slam.ts`. Drops: its essence (worth 45) always and 2 lurker scales 70% (1 x 1,
  stacks of 10, weight 0.4, worth 20c, the forge buys them). Two in the Mistwood's reeds by the lake, north (0.5,
  10.5) and south (0.5, -7.5), back 15 s after their fight, fought in the level's mire arena; on the overworld it
  wanders at 0.7 within 3 tiles, notices you within 3.5 tiles in 0.8 s and chases at 2.2. Its sounds are the boar's
  files pitched down (`lurker-*` stems in `client/src/audio/sounds.ts`; no new files), unheard.
- Overworld piles (drops, PR 1): a pile is laid out 4 cells wide (`PILE_COLS`), with as many rows as it needs, and
  is opened by looking at it, as in the arena (below). It only gives: nothing goes onto it, nothing is moved about on
  it or eaten straight off it; taken things go into the bag, a hand or the cloth. It shows in the bag screen above
  the cloth while open, and closes with the bag (B, Esc), on walking, when a fight starts and when it empties or
  vanishes. On the overworld it's a tied sack with a bone sticking out.
  Numbers: `server/src/core/overworld/piles.ts`.
- The arena after a win (drops, PR 2): an enemy's drops lie in one pile 0.5 m beside where it fell, on the arena's
  inner side (`DROP_GAP_M`), drawn as the overworld's sack. It's opened within 2 m (`INTERACT_RANGE_M`) and 35°
  either side of where the camera faces (`INTERACT_LOOK_RAD`), the server checking where its own copy of the fight
  has you and the aim of the last input it ran, with 1 m and 15° of slack for lag (`INTERACT_LAG_SLACK_M`,
  `INTERACT_LOOK_SLACK_RAD`). The fight runs on after the win (you walk, the server and client stay in step), and the
  bag screen works there on your real bag (taking from the pile, moving things, the slots, eating), without the cloth,
  and a page can be written as outside a fight. Leaving then, by Enter, the timer or a
  disconnect, is no loss: what you took is yours and saved. A fight already won can't be joined. The 5 minutes are
  `AFTER_FIGHT_MS` (`server/src/core/game/battle.ts`), shown at the top as "The arena closes in m:ss"; the result's
  banner fades after 4 s there so the drops can be seen (`AFTER_FIGHT_BANNER_TIME`). Interact in the arena is a
  battle binding of its own (E), and the popup takes the leave key again to leave and Esc to stay. A win's notice no
  longer lists the drops (you saw them in the arena). A dead enemy lies still 0.5 s, then crumbles over 1 s: it
  fades, sinks 0.3 m and gives off pale grey ash (`DISSOLVE_*` in `client/src/visuals/battle/battle.ts`). A player who
  leaves the arena fades out over 1 s (`LEAVE_FADE_TIME`), the others' fight getting it at once; one who disconnects
  mid-fight falls (as before) and fades the same way.
- Overworld piles by looking: the overworld takes the arena's numbers as they are (2 tiles, 35°, and 1 tile and 15° of
  slack; the reach was 1.6 tiles and its slack 0.6). The way you face there is the chibi's heading, one of four, so a
  pile 45° off isn't in view until you turn toward it. The server turns its copy of you by the same rule
  (`faceToward`) from the same inputs, both starting south on entering a level (`START_HEADING`).
- Death drops (drops, PR 3): the pile lies exactly where the server's copy of the fight has you when you fall (or
  leave), and, as the enemy's drops, is seen and opened in the arena only once the fight is won; the arena's piles
  land on the overworld as one pile (the death's leftovers and the enemy's together). The death's notice lists what
  dropped and says what's left of it lands where the fight began. A duel still drops nothing (a spar).
- Levels: the kingdom, then the test areas, the Waking Hollow, the Grass Field and the Mistwood, joined by roads off
  the edge of each (walk into one to cross). The level you're on is saved: you come back to it, at its start, when you
  log in. Dying wakes you on the kingdom's platform: falling there, at once; elsewhere, the save says the kingdom at
  once (a disconnect mid-fight too) and you cross to it as you leave the arena. Mistwood reuses the floor's enemies
  (boars, the Kobold, the Warlock) and the mire arena.
- The Old Quarry (the user: "continue to add content for the game… just do it based off of your best judgement";
  everything here is the agent's, tried only in a headless browser): a 48 x 36 floor-1 level north of the Grass Field,
  through a 3-tile gap in its north tree line (`old-quarry` in `server/src/core/world/floors/1/old-quarry.ts`). Pale
  cut-stone terraces (a new solid tile, `Q`) stepping up toward the map's edge (1.2 m a step, 4 on the map, then 4 more
  rings beyond it), a dry pit ringed by low cut stone with three ways in and a still pool at its bottom (silent, as
  still water is), two cranes on the pit's north rim and three ore carts on the rails (both new solid tiles, `Y` and
  `K`; the rails are its paths), rubble, a ruined plank hut for the overseer, patches of dry scrub (its tall grass), a 2
  x 2 pad and one campfire by the way in. No boars: three Kobold Swordsmen, a Kobold Greatsword and two Goblin Warlocks
  stand about (respawning 15 s after their fight), and its scrub rolls 0.12 a tile (the Grass Field's rate) for a Kobold
  Swordsman, a Goblin Warlock or a Kobold Greatsword, 3 : 2 : 1. Every fight there is in its own quarry arena, duels too
  (looks only: pale cut slabs, stacked blocks, terraced faces, a crane, a cart, lanterns and drifting dust;
  `client/src/visuals/arenas/quarry/`), and it has its own music (Music, above). No readable signs: the game has no way
  to read one without an NPC (a trace is an NPC's), so there are none.
- The kingdom (the user's decisions above; the names, layout and lines are the agent's): Highmere, a 40 x 44 map with
  no floor (the HUD shows only its name). North to south: the Hall of Arrival (marble, pillars, the platform, a red
  carpet), the castle courtyard (lawns, two pools, flower beds), the castle gate, the market streets between houses
  (Bette's food stall, Mirela's potion stall, Garrick's forge), and the town gate south to the Grass Field, which got
  a road in at its north-west corner. The herald is Aldric. It has no encounter table (a level's `grass` is now
  optional). Dialogue lines name keys as `{group.action}`, written out as the player's own key
  (`client/src/ui/dialogue/keys.ts`). The castle's bulk, the keep and the town's rooftops round the map are drawn
  only, and on any level a ledge (a wall, a house, a cliff) standing between the camera and you turns see-through, so
  the hall reads with the camera turned. Music: the title's track for now.
- Money and shops (kingdom PR 2; the user: "use your best discretion"; tried in a headless browser, not hand-played).
  Numbers in `server/src/core/content/shops.ts` and `shared/src/items/coins.ts`, the formulas in FORMULAS.md:
  - Coins are 1 x 1, stacks of 100, weight 0.01 each (gold 0.02).
  - What things are worth, in copper: the old stick 5, boar meat 6, hide 25, tusk 40, bread 4, health potion 60,
    stamina tonic 40, sword 300, longsword 900, greatsword 1500. A shop sells at worth × the level's price factor
    (Highmere 1.5, else 1), and buys at 40% of worth, rounded down, whatever the place. The first purchase at each shop
    is 25% off, that one item, once per player per shop, saved with the player (`shops_bought`).
  - Bette's food stall sells bread and boar meat and buys both; Mirela's potion stall sells the two potions and buys
    nothing; Garrick's forge sells the three swords and buys hides, tusks, the old stick and swords.
  - New items: bread (heals 20% of the most HP, 20 at the start; stacks of 5, weight 0.3), the health potion (50%) and
    the stamina tonic (stamina to full, at full HP too), drunk in 1 s, stacks of 5, weight 0.4.
  - A money changer, Osric, with a stall on the market's west side across from the forge, changes coins and sells
    nothing. Changing is one tier at a time: 1 coin for 100 of the next smaller or 100 for 1 of the next bigger, no
    fee, a click each.
  - Paying takes the smallest coins first, as many as go into the price whole, then the smallest coin that covers
    the rest; coins on the cloth go before the bag's. A purchase or a sale whose items and change can't all fit in the
    bag and on the cloth doesn't happen, and says so.
  - The shop opens from the keeper's talk (Trade, or going on past the last line), in the bag screen where the
    equipment shows otherwise; selecting something in the bag or on the cloth that the shop buys shows Sell (one) and,
    for a stack, Sell all. It closes with the bag, on walking, when a fight starts and on leaving the level. A trade is
    saved within a second, like a move in the bag.
- The training yard (kingdom PR 3; the user decided only "start with nothing", the herald sending you to an old man
  and an old stick; the rest is the agent's, tried in a headless browser, not hand-played):
  - Bram (a placeholder name) keeps a 7 x 5 dirt yard through a 2-tile gap in the courtyard's north-west wall, two
    straw dummies drawn in it.
  - The quest "The Old Man's Yard" (main), offered by Aldric (a last line sends you there) and by Bram if not taken:
    find Bram (the old stick, into the bag, once, as the step's reward), knock down the training dummy, best Bram in
    a spar (lore "Soft as dough"). A quest taken from the NPC its first step asks you to talk to does that step at
    once, so taking it from Bram gives the stick there and then.
  - The old stick: 1 x 2, weight 1, held in a hand, the sword's moveset: 1 m long, 5 damage, heft 1, no strength
    needed; worth 5 copper (the forge buys it for 2). It goes into the bag, not a hand: Bram says to hold it, and the
    bag works in a fight too.
  - Both fights start from Bram's talk (Begin), in the level's arena, as a spar (`TRAINING_YIELD_SHARE`, 0.1, in
    `server/src/core/game/training.ts`): no fighter's HP goes under 10% of its most, and one at it has yielded, so
    the fight is decided. Nothing is lost or gained but the quest: HP and stamina come back as they went in, no drops,
    no death, no win counted, the core as it was; gear moved and pages written are kept. Nobody can join one (a
    notice: "A spar can't be joined."). The banner says VICTORY / DEFEATED, a loss's notice "You yield to Bram.", and
    leaving mid-fight costs nothing.
  - The dummy takes no damage from anything and never attacks; it falls once a light, a heavy and a stab have each
    landed (a mark on it lights for each).
  - Bram spars by the Kobold's rules, kinder (`server/src/core/enemies/bram.ts`): 60 HP, the old stick, wind-ups of
    1.3 s (0.6 chained), chains of 1 or 2, 20% heavies, no feints, 10% perfect blocks, no parries, poise 60. Only a
    won spar does the step; a lost one can be tried again at once, and after the quest he spars whenever asked. In
    the arena he's drawn as a person (his NPC look on the player's sprite), sounding as a body hit and a fall.
  - The dummy and Bram aren't monsters: no essence, no overworld actor.
  - A dev account `user` (password `user`) is seeded too, to try the start on.
- The starting area (the user: "go make more content… you can also add more quests and create a proper starting
  area… make any assumptions you want"): the Waking Hollow, a small floor-1 level in the Grass Field's look and music.
  A summoning pad where new characters wake, ringed by four standing stones; a camp by an old waystation with a
  campfire; a brook with a footbridge, and across it the hunting ground: two wandering boars (8 s respawn) and tall
  grass rolling boars at 0.06 a tile, half the other levels' 0.12. Its road east leads to a new exit at the Grass
  Field's west edge, and back. New characters started there until the kingdom; players already saved keep their level
  (a migration puts saves from before levels were saved on the Grass Field).
- Every level's start is a summoning pad (plan/lore.md): a new walkable tile (`@`, carved stone with a pale rune ring)
  laid under the Hollow's, the Grass Field's and the Mistwood's starts; the kingdom's platform is 4 x 4 of it.
- The Hollow's natives: Maren, who keeps its pad (standing between it and the fire; she thinks your kind was sent for a
  reason), and Tobin, a hunter by the footbridge, wary of avatars ("a thing that can't stay dead has no business
  hunting"). Their lines, looks and spots are the agent's.
- The Hollow's chain, the start of the main quest: "Woken" (Maren: slay a wild boar, then back to her; lore "The
  seed"), "Meat for the Rack" (Tobin: gather 2 boar meat and hand them over; 1 boar hide, lore "The Hollow's
  keepers") and "The Road East" (Maren: find Hollis in the Grass Field; 2 boar meat, lore "Natives"). Hollis then
  offers his first quest in the same talk. His chain doesn't wait on the Hollow's, so nobody who skipped it is locked
  out. Side quests: Tobin's "How a Kobold Fights" (after his meat: slay a Kobold Swordsman, tell him; 3 boar meat,
  lore "Kobolds") and Maren's "The Old Tongue" (after the Road East: reach the Mistwood, slay a Goblin Warlock, tell
  her; 3 boar meat, lore "The old tongue"). Hollis's pad lines now fit the new start: the stone you woke on is a
  summoning pad, the Grass Field's is south-west of his fire, and you wake again on the first, in Highmere's hall.
- More natives (the user: "more content… add more quests", "make any assumptions you want"): Corwin, who keeps the
  Grass Field's east road for Valdris (the Oath), south of it near the Mistwood gap; and Ilse, Nyra's weaver, by the
  Mistwood's path east of the lake's bridge. Each has a side chain of two that waits on nothing else (no lock-outs):
  Corwin's "A Blind on the East Road" (gather and hand over 2 boar hides; 2 boar meat, lore "The Oath") then "The
  Count" (slay 2 Kobold Swordsmen, back to him; 3 boar meat, lore "Where beasts come from"); Ilse's "Weights for the
  Loom" (gather and hand over 2 boar tusks; 2 boar meat, lore "Nyra's loom" and "The five realms") then "The Snapped
  Thread" (reach the Mistwood's north-east ruins, slay a Kobold Swordsman, tell her; 3 boar meat, lore "The snapped
  tether"). Their names, looks, spots, lines, rewards and lore are the agent's.
- Hollis moves on (the user: a recurring NPC moves on with the story, leaving a trace; Hollis to the Mistwood once his
  first chain is done; "make any assumptions you want"). With `hollis-to-mistwood` set he stands by the Mistwood's
  pad (1.5 tiles east of it, between it and the campfire, facing it), per player. Where each player sees an NPC is
  fixed as they enter a level: done by the fire, he stays there for the rest of that visit saying goodbye ("meet me in
  the Mistwood ... I'll be by its pad"), and is gone the next time they come (another level, a reconnect). His trace
  is a bedroll, rolled and tied, where he stood by the fire, drawn as a small sprite; Interact ("Look") reads it,
  titled "Hollis's bedroll" with no portrait: it was left for whoever needs the fire, with a note saying he's gone on
  to the Mistwood's pad through the gap at the field's east edge. It lies there for good, does no quest step, and
  every trace is drawn as a bedroll until a second kind is needed. In the Mistwood he has new lines (the pad is the
  same stone as the field's, nobody remembers it laid) and one small main quest, "The Pad and the Loom": ask Ilse what
  her loom makes of the pad (she says no thread runs to it or out of it), then back to him; 3 boar meat and the lore
  entry "The threadless pads" (whoever laid the pads isn't on Nyra's loom, any more than what sends avatars; Hollis
  wagers the same hands), then lines for after it. Ilse's line for that step comes first in her talk, so it wins over
  her own quests' for that one talk. No routines, sleep or friendship yet; Maren's and Corwin's lines don't mention his
  move.
- Highmere's townsfolk (the user: "continue to add content for the game… based off of your best judgement"; names,
  looks, spots, lines, rewards and lore are the agent's, not hand-played): Captain Edda at the town gate, "Thin the
  Herd" (after Bram's yard: slay 3 wild boars, report back; 1 silver, lore "Highmere's claim"); Wenna, the castle's
  cook, by its kitchen door in the courtyard's east, "For the Castle Pot" (gather and hand over 3 boar meat; 60
  copper, lore "Haldis's fires"); Tamsin in the market's south-west, "A Son in the Mistwood" (ask Ilse whether Rook's
  thread runs, then back; 1 silver, lore "A thread that runs on"; Ilse's line for it comes after Hollis's); Odo, keeper
  of the roll of arrivals, in the Hall of Arrival west of the platform, "Beyond the Walls" (reach the Waking Hollow,
  then the Mistwood, then back; 1 silver 50 copper, lore "The roll of arrivals"); and Ottilie, Aurel's priest, in the
  courtyard's west, with no quest, her lines following the story. All four quests are side quests; only the captain's
  waits on another.
- The Old Quarry's folk (the user: "continue to add content for the game… based off of your best judgement"; names,
  looks, spots, lines, rewards and lore are the agent's, not hand-played): Harl, the old foreman, 3 tiles west of the
  campfire facing it, "Down the Pit" (reach the pool at the pit's bottom, slay the Kobold Greatsword, back to him;
  2 silver, lore "The pool in the pit": the cutters broke into a hollow of loose soul under the pit, Kobolds climbed
  out, the crown took its cutters home); and Nim, a scavenger in the overseer's ruined hut, "A Roof of Pelts" (gather
  and hand over 2 wolf pelts; 1 silver, lore "The overseer's ledger": the hall's platform was there before the first
  block was cut) then "The Chanters at the Rim" (slay 2 Goblin Warlocks, back to her; 1 silver 50 copper, lore "The
  chanters at the rim"). All side quests; only Nim's second waits, on her first.
- The Mistwood's folk (the user: "continue to add content for the game… based off of your best judgement"; names,
  looks, spots, lines, rewards and lore are the agent's, not hand-played): Sorrel, Calyx's herbalist, by the reeds on
  the lake's south-west shore (-11.5, -8.5), "Fangs for the Mortar" (gather and hand over 3 wolf fangs; 80 copper, lore
  "The thinning wood": every year the wood grows a little less, a hint at the starving) then "What Rises off the Mire"
  (stand on the lake's island north of the bridge, slay a Goblin Warlock, back to her; 1 silver, lore "Mist off the
  mire": the mist is loose soul rising off the still water, and the goblins breathe it before they chant); and Bryn, a
  charcoal burner in the south below the lake (-1.5, -12.5), who had Tamsin's son Rook by her fire: "Rook's Last Hunt"
  (once Tamsin's "A Son in the Mistwood" is done: slay a grey wolf, back to Bryn for 1 silver, then tell Tamsin, lore
  "Past the trees": Rook went south through a gap in the trees past the goblin's ruins, where no road runs). Tamsin
  has lines for its last step and after it. All side quests; Sorrel's second waits on her first.
- The view is 16:9 at most. Wider windows get bars on the sides; taller ones see a little less width. The server sends
  only the actors within `VIEW_RADIUS_TILES` (20) of the player, a circle that holds what the camera shows at 16:9
  whichever way it looks (a guess at the screen would be cheatable).
- Multiplayer (the user: "overhaul net/ ... a nice simple API", "for now just 1 server should work? but client can see
  a list of servers to join", then "do whatever you think is right"): built as the stack in
  [plan/multiplayer.md](plan/multiplayer.md), whose picks are all the agent's. The client has one `Net` for the game
  socket and every HTTP call in `client/src/net/api.ts`; the wire didn't change.
- The server list: `GET /api/servers` lists only this server for now, its name `SERVER_NAME` ("Local" if left out)
  and a cap of `MAX_PLAYERS` (50) players online, both in `.env`. Each entry carries its socket, so a second server
  (same database, same login cookie) is just a second entry. A full server closes a new player's socket (4002, "That
  server is full"); a player already on it may still take over from another tab. The list is public (no login
  needed), and anyone may pick a full server and try (the server decides). Logging in no longer goes straight in:
  it shows the list with the first server picked, and Play joins the picked one. The list is fetched again on the
  title (after logging in, a failed join, and Return to title), not live.
- The shared overworld: one per level, made when its first player arrives, for everyone on it. Other players show as
  their own chibi with their name above (a character is sent each time they come into view), gliding toward the
  server's positions as enemies do, and pass through each other. An enemy a player touches leaves the overworld for
  everyone at once; it comes back `respawnTime` after that fight is over for everyone in it (even while its fighters
  are still on the result screen), whether they won or lost (a loss used to leave it standing). Two players touching
  one on the same tick: the first in the server's order gets it. A player in a battle stays where they were, with
  crossed swords over their name, and enemies pass them over: they don't notice, chase or touch them, and the safe time
  after a fight starts only once they're back.
  Enemies go for the nearest player they may. Tall grass rolls per player. Other players are sent within the same
  `VIEW_RADIUS_TILES` as actors.
- Duels (the user: "request pvp with another player to send them both into an isolated arena"; the rest are the
  agent's picks from plan/multiplayer.md): T challenges the nearest player within 2 tiles who isn't fighting
  (`CHALLENGE_RANGE_TILES`, plus lag slack); they get a notice with Accept / Decline (Y / N, rebindable, in the
  overworld's keys), and the challenger hears of a decline. A challenge expires after 15 s (`CHALLENGE_TIME`), and is called off if either
  leaves or starts another fight. One open challenge per player, either side: challenging while yours is open, or
  someone in one, is refused with a notice. Range is checked when challenging, not when accepting. Accepted, both go
  into one fight in the level's duel arena (the Grass Field's stone ruins), 12 m apart facing each other
  (`DUEL_STARTS`), each locked on the other. Everything works both ways: attacks, blocks, perfect blocks and skills,
  each way named as its swinger sees it (a duelist's swing from the left comes from the other's right). Weapon hits
  only hurt, as the Kobold's do. Duelists pass through each other's bodies. It's a spar: over when one is down (a draw, lost by
  both, at the time limit), no death, nothing lost or gained, no wins, and both come back where they stood with the
  HP and stamina they went in with; pages written and gear moved in it are kept. Leaving or disconnecting forfeits:
  the other wins, the leaver loses nothing. The arena banner says VICTORY / DEFEATED.
- Joining a battle (the user: "another user can join a users' arena if theyre mid battle"; the rest are the agent's
  picks from plan/multiplayer.md): within 1.6 tiles (`JOIN_RANGE_TILES`) of a player's crossed swords, the Interact
  key (E; it joins when no campfire or pile is closer) or the HUD's "Join the fight"
  button joins their battle (until it's won); the server checks the reach with the same lag slack as resting
  (`LAG_SLACK_TILES`). Up to 4 players in a battle at once (`MAX_BATTLE_PLAYERS`); duels can't be joined; a refusal is a
  notice. A joiner comes in at the arena's edge (`joinStart`), at once, with what they carry. No friendly fire; enemies
  go for the
  nearest player standing; enemy HP doesn't scale. A player who goes down has lost, there and then, as on any death
  (dropping all they carry where they fell, waking on the kingdom's platform), and the fight goes on for the
  rest; won, everyone still in it counts a win and they share the drops (one down on the very step it's won still
  wins, standing
  at 1 HP). Anyone who
  disconnects, the host too, has lost as `LEAVING_LOSES` says, and the rest fight on. With the host gone
  (disconnected, or down and back on the overworld), the enemy stays off the overworld until the fight is decided for
  everyone in it, and the fight can still be joined: every player in it has the crossed swords, not just the host.
  The joiner hears "You join <host>'s fight!" in the centre banner, the others "<name> joins the fight." in a corner.
- The first NPC (the user: "make an npc ... use all your own judgement"): Hollis, a native of the tower who keeps the
  Grass Field's campfire, standing about 3 tiles east of it, facing the fire. Interact (E) or the HUD's
  "Talk", next to Hollis and looking at Hollis, by the same reach and look as a pile (`INTERACT_RANGE_M`,
  `INTERACT_LOOK_RAD`; the server checks it with the same slack), a line at a time: Enter, E or a click go on, Esc
  closes, and you stand still while it's open (the world doesn't pause). What he says follows your story (the quests,
  above). No shop. The lines live on the server and come only when you talk. NPCs are kept like enemies (the user:
  "their sprites and interaction and stuff should be saved like monsters"): one server file per NPC for where it
  stands and what it says (`server/src/core/npcs/<id>.ts`) and one client folder for its name and look
  (`client/src/visuals/npcs/<id>/`); levels don't place NPCs.
- Still and running water (the user: "water should not be flowing if it has nowhere to flow to ... lakes and stuff
  shouldnt flow. they can ripple if they have things in it"): only water that runs off the map flows. A body touching
  the map's edge (or the woods, rocks and walls joined to it) in two separate places runs from one to the other (the
  two farthest apart), north to south, else west to east, so every river runs one way; bridges and boardwalks count as
  water, so a river cut by one is one river. Touching it once (the Grass Field's west pond) or not at all, it lies
  still: no current and no drift (the wind drift is gone; the waves rise and fall in place). Now and then a small ring
  spreads and fades at a random spot on still water, the mire's pools too, never on running water (the user: "ripples
  in the water should be random (spot) and sporatic (timing). make them more sparse in both timing and spot"). Looks
  only: water stays solid. Numbers: `client/src/modes/overworld/water.ts`, `RINGS` in
  `client/src/visuals/water/water.ts`.
- Quests (the user: "just go with your recommendations"): Hollis's first chain, main quest, is "Hides for the Fire"
  (gather 2 boar hides, then hand them to him: 2 boar meat and the lore entry "Avatars") and then "Where You Woke"
  (slay 3 wild boars, then go back to him: he tells you about the summoning pads, gives 3 boar meat and the lore entry
  "The summoning pads", sets the flag `hollis-to-mistwood`, and says "meet me in the Mistwood"; then he moves on,
  below). Numbers and words are in `server/src/core/content/quests.ts`, `content/lore.ts` and
  `npcs/hollis.ts`, for the user to edit. A won fight counts every enemy in it, for each winner; a kill step counts
  only kills after it began, and a talk, a fight or a handover does one step at most. A reward that doesn't fit in the
  bag is left in a pile at your feet. An NPC offers one thing at most, the offer of the lines it says (the order in
  its file decides). Going on past the last line (Enter, E or a click) takes the offer, as Accept does; Esc or Not now
  leaves it. Quests can't be abandoned. The questbook opens over the world like Settings: you stand still while it's
  open (the world, a fight too, goes on), and J, Esc or its × close it; a change of mode closes it.
- The admin panel's Complete current quest (the user: "a complete current quest button so i can speedrun"; overworld
  only): it finishes every step left of the first main quest in progress, else the first side quest in progress, as
  if done (rewards and flags given; a handover takes the items if you have them, else nothing). With none in
  progress it takes the first quest that can start (main first) and finishes it, so each click is one quest and
  clicks walk the main story; with none left, a notice says so.
- The admin panel's Reset my save (the user: replay the start as a test user without wiping the database; overworld
  only): the save becomes `newPlayer()`'s, keeping only the character and the settings (so the skillbook's pages, the
  words and the core go too), and the server closes the socket (`CLOSE_CODES.saveReset`); the client goes back
  through the title and joins again on its own, so it starts as a login does. No confirm step.

## Commands

```sh
npm install
npm run dev        # db:up + db:seed, then server :8787 (tsx watch, reloads on save) + client :5173 (Vite, proxies /ws and /api)
npm run typecheck  # run it from the root (the workspaces have none of their own); also checks the server's layering
npm test           # unit tests of shared, server and client (Node's test runner through tsx; no database needed)
npm run build      # client bundle
npm start          # production: builds the client, then the server serves it + /ws + /api on :8787
npm run db:up      # Postgres 17 in Docker on 127.0.0.1:5433 (db:down stops it, db:reset wipes + reseeds it, db:psql)
npm run db:seed    # dev accounts test1, test2, test3, user, password = username (dev runs it; safe to repeat)
npm run db:generate -- --name <what-changed>  # after editing server/src/db/schema.ts
docker compose -f compose.prod.yaml up -d --build  # hosting: the server + Postgres, on 127.0.0.1:8787 (README "Hosting")
```

In the game on a dev server, F1 opens the admin panel: the time of day and its speed, invulnerability, heal, a core
step up or down, completing the current quest, resetting your save, a fight with any enemy, items into the bag.

Ports, the database's user and password, and `DATABASE_URL` come from `.env` (git-ignored; `npm run db:up` copies
it from `.env.example` when it's missing). A new setting goes in `.env.example` with a working dev value and a
comment, and is read in `server/src/env.ts` (the server) or with `loadEnv` in `client/vite.config.ts` (the dev
proxy). Never commit `.env`, and don't put a default database address in code.

If the server won't start, see "Troubleshooting" in the README.

### Database changes (Drizzle)

- Tables are defined in `server/src/db/schema.ts`. Query them with Drizzle's builder (`db.select()`,
  `db.insert()`, ...). Use `` sql`...` `` only for the parts the builder can't express.
- **After changing schema.ts, always run `npm run db:generate -- --name <what-changed>`**, read the SQL it wrote,
  and commit it together with `server/src/db/migrations/meta/`. Typecheck passes without this step, but the
  database never gets the change and the first query that uses it fails at runtime.
- Never edit or delete a merged migration, and never hand-edit `meta/`. For a data change drizzle-kit can't work
  out, `npm run db:generate -- --custom --name <what>` writes an empty migration to fill in.
- Drizzle skips a migration whose timestamp is older than the newest one the database has applied. So if you
  rebase onto a branch that added a migration, remove yours (`npx drizzle-kit drop` in `server/`) and generate it
  again on top.
- The server applies new migrations when it starts. If it exits with "a migration failed (relation ... already
  exists)", the dev database was made by another branch: `npm run db:reset`.

## Test first

Test-first as in the global rules; if it involves a game mechanic, settle it with the user first (above), so the
tests say what was agreed. Where tests go and how they're written:

- In each workspace's `test/` folder, mirroring `src/`: `server/test/core/game/session.test.ts` tests
  `server/src/core/game/session.ts`. Node's runner (`node:test`, `node:assert/strict`), run through tsx; no test
  framework. `npm run typecheck` checks the tests too (each `test/` has its own tsconfig with Node's types).
- Server core is tested through its ports with the fakes in `server/test/fixtures/` (`FakeLink`,
  `MemoryPlayerStore`, `MemoryAccountStore`, `TEST_LEVEL`), so no database or socket is needed. The HTTP API is
  tested with `buildServer()` and `app.inject()` / `app.injectWS()`, without a port.
- Time and chance are faked with node:test's mocks: `t.mock.timers` for `setTimeout` and `Date`, and
  `t.mock.method(Math, "random", ...)` before an `Overworld` is made (it keeps `Math.random` as its `rng`). A fight
  needs no clock: tests step it (`session.tick`, `room.tick`), and test files that make one await `initPhysics()`.
- Tuning numbers come from the code (`PLAYER.maxHp`, `ITEMS[id].stackSize`, the level's campfires).
- What has no unit tests (Babylon rendering, React screens, how the arena fight feels, the Postgres stores) is
  still tried in a browser before calling it done.

## Before calling something done

- `npm test`, `npm run typecheck` and `npm run build` pass. CI (`.github/workflows/ci.yml`) runs the same three on
  every PR into `main`; don't merge a PR until its check is green (`gh pr checks <n>`).
- Try it in a browser. Playwright works: log in first with `page.request.post("<base>/api/login", { data: {
  username: "test3", password: "test3" } })` (it shares the page's cookies), open `/?debug` and click Play
  (`#title-screen nav button`), or fill `#login-form`. Then the debug handles are available: `window.mode()`,
  `window.battle`, `window.overworld`, `window.ui`, `window.settings`, `window.encounter()` (dev server only;
  `window.encounter("kobold-swordsman")` for the Kobold, `"kobold-greatsword"` for its greatsword twin,
  `"goblin-warlock"` for the warlock; the admin panel's fight buttons do the same) and, in a fight,
  `window.cast({ segments: [{ form: "bolt", elements: ["fire"], modifiers: [] }] })` (a skill on none of the pages
  goes off only with the chant open: R); `window.audio()` says whether sound runs, what's loaded and looping, the
  last sounds played and the music track playing (nobody can hear a headless browser). F1 opens the admin panel
  (`#admin-panel`; `#admin-invulnerable`, `#admin-heal`, `#admin-step-up`, `#admin-step-down`,
  `#admin-complete-quest`, `#admin-reset-save`). The HUD's card is `#core-card` (a click turns it; `data-face` is
  `portrait` or `core`), its sphere the canvas `#core-sphere`. A new account has no character: make one first. Skip
  this when the user says it isn't needed.
- The docs above match what you changed.
- Never log in as test1 on the dev server (:8787): it's the user's account, and a second login kicks them out
  (close 4000). Use test3 or test2.

## Subagents in this repo

The global rules apply; here is how to set one up in this repo.

- **Subagents don't decide game mechanics either.** One that needs a decision only the user can make stops and
  reports the options; the main chat asks the user.
- **Worktree:** `git worktree add /tmp/it-<branch> -b <branch> <base>`, then `npm ci` there. Don't symlink
  `node_modules` from another checkout: `@infinite-tower/shared` would resolve to that checkout's code.
- **The user's dev servers are :8787 and :5173** in the main checkout. Saving a server file there restarts the
  server under the user.
- **Every PR touches the docs**; whichever merges second rebases and fixes the conflicts.
- **Its own database and servers, when it runs the game.** Make a database in the same Postgres container
  (`docker compose exec -T db createdb -U infinite_tower it_<name>`), then in the worktree `npm run env:init`
  and set its `.env`: `DATABASE_URL=postgres://infinite_tower:infinite_tower@127.0.0.1:5433/it_<name>` and its
  own `PORT` (8790, 8791, ...). `npm run db:seed` applies the migrations and adds test1 to test3. Start the server
  with `npm run dev -w @infinite-tower/server` and the client with `npm run dev -w @infinite-tower/client --
  --port 5180` (5181, ...), not `npm run dev`. A branch's new migration or a test that rewrites a player then
  can't break anyone else's game, and any test account is fine there.
- **Clean up:** drop its database with `docker compose exec -T db dropdb -U infinite_tower it_<name>`.

## Architecture rules (the reasons and details are in ARCHITECTURE.md)

- **The server decides; the client asks and draws.** Anything a player shouldn't be able to change lives on the
  server: levels, encounters, enemy stats, fight results, wins, HP / stamina. Client messages are checked with Zod
  (`shared/src/net/client-messages.ts`).
- **The server is core plus outlets (hexagonal).** Game rules go in `server/src/core/`, which imports only core/,
  `shared` and `node:crypto`: no sockets, HTTP, SQL or env. Anything that talks to the outside world goes in an
  outlet (`ws/`, `api/`, `db/`), behind an interface core owns in `core/ports.ts`. Outlets import core, never each
  other; `server/src/main.ts` is the only file that wires them. `npm run typecheck` fails on an import that breaks
  this (`server/scripts/check-layers.ts`); fix the import rather than loosening the check, and ask before adding a
  package to the ones core may use.
- **`shared/` is only for code both sides run.** Data only the server needs (encounter rates, spawns, enemy
  stats, drops) stays in `server/`.
- **The arena fight is shared code** (`shared/src/battle/fight/`, imported from `@infinite-tower/shared/fight`), and
  the server runs it and decides it. The client runs its own copy and sends only inputs tagged with their steps
  (checked with Zod); no client message may claim a result, a hit or HP.
- **ECS for game data** (`shared/src/core/ecs.ts`). Plain classes for services (connection, keyboard, mouse,
  prediction, the fight's sync).
- **Keys come from `client/src/settings/bindings.ts`.** Never hardcode a key or add a key listener:
  `client/src/core/keyboard.ts` is the only one. Keys become actions only in `client/src/core/actions.ts`: game code
  reads them there, the UI listens with `useAction`, and on-screen keys come from `keyName`. Groups: general,
  overworld, arena (rebindable), MENUS (fixed). Esc and ⌘ can't be rebound.
- **Drawing has one owner, `client/src/visuals/`**: the only code that imports Babylon. It reads the modes' state
  each frame (`VISUALS` by entity kind, `EFFECTS` by fight event); game code never draws or pushes state to drawing
  code. `npm run typecheck` checks the imports.
- **UI is React over the canvas** (`client/src/ui/`). Game code writes plain values into the stores in
  `ui/state.ts` and never touches the DOM. No `innerHTML` or `dangerouslySetInnerHTML`. What the player is told
  goes through `say` (`ui/notifications/say.ts`), never straight to the notices or the banner.

## Code style

- Strict TypeScript, ESM with `.js` in import paths, and `import type` for types (`verbatimModuleSyntax`).
- Typecheck fails on unused imports, variables and parameters. A parameter that has to stay (a callback's
  signature) starts with `_`, like `(_x, y) => ...`.
- Follow the naming of the folder you're in. React components are PascalCase `.tsx` files that export components
  only (so Fast Refresh works); constants they need go in a `.ts` file next to them.
- Words: the map you walk is the **overworld**, a fight is a **battle**, and the place it happens is the **arena**.
- Combat words (code, UI and docs use them):
  - **Gear**: anything equipped (weapons, armour, the skillbook). Physical combat comes from gear.
  - **Skill**: an ability built from words. Anyone can use skills, with or without a book. The skillbook only saves
    sequences for quick-cast.
  - **Stamina**: what both gear and skills spend. **Skillpower** scales skill damage.
  - **Skill grammar**: the rules. A form, then elements, then modifiers, each applied in order to everything before it.
  - **Word**: one of a form, an element or a modifier.
  - **Skill sequence**: one specific string of words (e.g. Bolt Fire Split). A skillbook page holds one.
  - **Building**: putting a sequence together, by chanting it or quick-casting it from a page.
  - **Validating**: checking a sequence against the grammar. Internal only, never shown to players.
  - **Release**: the moment a built skill fires.
  - **Effect**: what it leaves in the world (bolts in flight, a cloud, an Imbue).
  - **Cast**: the whole lifecycle (build, then release, then effect). It's resolved when its last effect ends. One open
    cast per entity for now. Avoid the word "channel".
- Game time is seconds (like `dt`), so a name ending in Time, Delay or Duration is seconds; milliseconds always say
  `Ms`. A name that doesn't say what kind of number it holds gets that word: `lungeSpeed`, `poiseDamage`,
  `staminaRegenPerSec`.
- Keep files small and single-purpose (roughly under 200 lines). Make a folder per mode, enemy or screen
  (`client/src/ui/screens/<name>/`); UI used by more than one screen goes in `ui/components/`. Small math goes in
  `shared/src/core/math.ts`.
- Styling is Tailwind v4 classes, with theme tokens in `client/src/ui/styles.css`. Write class names out in full.
- No on-screen control hints or fps counters. Exceptions: the HUD's ping (Show ping in Settings hides it), and the
  leave key after a fight (on the result banner and under the arena timer), read from the bindings.

## Git and PRs

- PRs are squash-merged.
- Never commit `.bookmarks`.
- Read inline review comments with `gh api repos/billwang7599/Infinite-Tower/pulls/<n>/comments`, and resolve
  each thread after fixing it.
