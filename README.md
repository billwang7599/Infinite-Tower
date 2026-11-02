# Infinite Tower

A browser game in progress: an SAO-style souls-like where you explore an HD-2D overworld and fight monsters in small
2.5D arenas. Single-player for now.

Babylon.js in the browser, Rapier for the arena's physics, React + Tailwind for the UI, a Node server (Fastify + ws),
Postgres (Drizzle).

## Features

What's built so far:

- **Accounts:** sign up or log in with a username and password, and stay logged in for 30 days. Logins are limited
  to 20 tries a minute per IP. Playing from a second tab takes over from the first.
- **Title screen:** the login form, then the server list (each server's name and players online; one for now) and
  Play, beside a low-poly tower of glowing white glass and gold in a dark world (lit like a shader would, on a 2D
  canvas, no WebGL). The game loads while you're on it. Play becomes Retry if the server is down or full. Play
  glides into the tower, looks straight up it and speeds up it while the server loads you, then flashes white into
  the world; Return to title plays it backwards.
- **Character creation:** a new player's way in holds on white, where a faceless System greets them; then they
  pick a name, boy or girl, and a look (build, face, skin, hair and its color, eyes and their color, mouth,
  clothes and trim colors) beside a pixel-art anime portrait and the chibi they'll be in the world. Confirmed, it's
  kept for good. The character panel shows the portrait and your stats.
- **Overworld:** new characters wake in Highmere, the kingdom, on the great summoning platform of its castle's hall,
  where the court herald greets them and explains; dying anywhere wakes you there again. Off the courtyard, Bram keeps
  the training yard (below). Through the courtyard and the castle gate are the market streets (a food stall, a potion
  stall, a forge and a money changer, each with its keeper) and the town gate out to the Grass Field. The test areas lie
  beyond: the Waking Hollow (a small camp by an old waystation, a brook with a footbridge and two boars in the tall
  grass across it) west of the Grass Field and, through a gap in the trees east of it, the Mistwood (dark pines, a marsh
  crossed by boardwalks, its own campfire), and through a gap in the trees on the Grass Field's north edge, the Old
  Quarry (pale cut-stone terraces round a dry pit with a still pool, cranes, carts on rails, a ruined overseer's hut and
  a campfire by the way in), held by Kobolds and Goblin Warlocks. Every level's start is a summoning pad. The Grass
  Field is a dusky tile map of paths, tree lines, rocks, a stream and pond, ruins and a patch of tall grass; trees,
  rocks, water and ruin walls block walking. A boar and, each in a corner of its own, a Kobold Swordsman (a Kobold
  Greatsword beside it), a Goblin Warlock and a grey wolf (another prowls the Mistwood) wander and chase you on sight.
  Touching one, or walking through tall grass (boars only), starts a fight. Wider screens than 16:9 get side bars. It's
  drawn HD-2D: pixel-art billboards on 3D ground, with cliffs round the field and a tilt-shift blur, lit by the same
  24-minute day as the fights (the sun and moon cast the shadows, the campfire flickers and lights what's near it). The
  stream runs off the map; ponds and the marsh lie still, with a ring now and then at a random spot. Left and right turn
  the camera a quarter turn (walking follows it), up and down tilt it. Everyone on a level shares it: you see other
  players (their chibi and name, crossed swords while they fight), and an enemy someone touches is gone for everyone
  until it respawns. T challenges a player next to you to a duel: a spar in an arena of your own, everything working
  player against player, that costs and wins nothing. Next to a player's crossed swords, E (or "Join the fight") joins
  their battle, up to 4 to a fight, each with their own result and drops. Natives live along the way: the herald, Bram,
  the three keepers and five townsfolk in Highmere, Maren (who keeps the Hollow's pad) and Tobin (a hunter) in the
  Waking Hollow, Hollis by the Grass Field's campfire and Corwin on its east road, and Ilse, Nyra's weaver, by the
  Mistwood's lake. Face one and press E (or "Talk") to hear them, a line at a time (Enter, E or a click; Esc closes).
  What they say follows your story, and so does where they stand: once his first chain is done, Hollis moves on to the
  Mistwood's pad, leaving his bedroll by the fire with a note saying where he went (each player sees him where their own
  story puts him).
- **The training yard:** you start with nothing. The herald sends you to Bram, who gives you an old stick, then has
  you knock down a straw dummy (a light swing, a heavy and a stab) and spar with him. His fights are spars: whoever
  is down to a tenth of their HP yields, nobody can join, and nothing is lost or gained but the quest.
- **Quests:** NPCs offer quests at the end of what they say (Accept or Not now), and hand over what a step asks
  for the same way. Steps ask you to gather items, hand them over, go somewhere, talk to someone or win fights against
  an enemy, and give items, lore and story progress. The Hollow's short first chain (a first boar, meat for Tobin's
  rack, then on to Hollis) leads into Hollis's: two boar hides, three boars, and what he knows about the pads you
  wake on; then, in the Mistwood, what Ilse's loom makes of its pad. Maren and Tobin each have a side quest further
  out (a Goblin Warlock in the Mistwood, a Kobold in the Grass Field), and Corwin and Ilse two each (hides for a
  blind and a count of Kobolds; tusks for a loom and the Kobold in the Mistwood's ruins). Highmere's townsfolk pay in
  coin: the gate's captain for three boars, the castle's cook for boar meat, a mother for word of her son from Ilse's
  loom, and the keeper of the roll of arrivals for a look at the Hollow and the Mistwood. In the Old Quarry, its old
  foreman sends you down the pit to the Kobold Greatsword by its pool, and a scavenger wants wolf pelts for her roof,
  then the Goblin Warlocks chanting at the rim gone: what they tell is why the quarry was left. The questbook (H, or the
  HUD's book; in fights too) has the main quest and side quests, each with its next step and a hint as the NPC gave
  it, and the lore found so far under the quest that revealed it. Your story is yours alone and kept on death.
- **Fights:** a 2D sprite against a 3D boar, grey wolf, Kobold Swordsman or Goblin Warlock in a small round arena,
  each with its own look (a forest clearing, stone ruins, a mire, a quarry), lit by a 24-minute day: the sun and moon
  rise and set, the shadows follow them, and glowing mushrooms light the mire.
  Sword fights are simple to learn (Souls-like): left and right click swing light and heavy, the wheel or K stabs,
  and a flick of the mouse picks which way the next swing goes; chained swings hit harder (the reverse swing
  quickest) until a gap, block, dodge or hit taken, and a stab spends it. A held block (left Shift) stops anything in
  front for stamina and a chip, and breaks when the stamina runs out; pressed just before a hit it's a perfect block,
  free, costing the attacker stamina and opening them; pressed in your own heavy's wind-up it feints it. Stamina is
  the one bar for attacks, dodges and blocks. A landed hit holds the picture for a beat (longer the heavier the
  blade) and jolts its target the way the blade went.
  A dodge roll with i-frames, jump.
  A fight starts locked onto the
  closest enemy: you face it, circle it with A / D, and the camera follows it. The boar lunges up close and does a
  telegraphed charge from further away (it's stunned if it hits the wall), and staggers after a few quick hits; its
  blows can only be blocked. The grey wolf is quick and frail: it circles out of reach, then crouches with a growl
  and leaps in to bite (sidestep it as it locks on, dodge or block it), standing open a moment (longer if it missed)
  before it hops back out; swinging at it while it circles only tires you. The Kobold Swordsman swings the same ways
  in long-told chains, blocks as it walks up, and now and then perfect-blocks you. The Kobold Greatsword fights the same
  with a much heavier blade. The
  Goblin Warlock keeps its distance and casts Bolt Fire at you (sometimes homing, sometimes split), quick up close and
  chanted from afar, its words shown in front of it; run it down and stagger its chant, but mind its staff. Your
  sprite holds its blade on the side you aim from, winds up, strikes and follows through on every attack, and reels
  when staggered. Another player facing your camera (in a duel, say) shows their
  front, face and all.
- **Controls:** keyboard + mouse or trackpad, which is required (a fight captures the mouse as it starts, or on a
  click with Auto mouse lock off). Every key can be rebound in Settings. In a fight: WASD move, Q toggles the
  lock, Right Shift locks the closest enemy, the arrows switch target (unlocked, they or a middle-button drag turn
  the camera), Space jumps, F dodges; a quick flick of the mouse aims, a left click is a light attack and a right
  click a heavy one, the wheel or K stabs, and Left Shift blocks.
  R opens the chant, and 1-4 quick-cast the skillbook's pages. H opens the questbook.
- **Chat:** one chat for the whole server, in the overworld and in fights. / opens it (you stand still while you
  type), Enter sends, Esc closes; a click on the game gives it the keys back with the chat still open, and / goes
  back to typing. Lines show in a log at the bottom left and, in the overworld, in a bubble over the
  speaker's head. The server keeps the last 1000 lines in memory, sends the last 50 to whoever joins, and takes up to
  500 characters a line and 10 lines in 5 seconds from each player.
- **The core:** progression without levels, five realms (Yan, Sol, Lux, Ling, Tian) of three steps (Early, Middle,
  Peak). Every beaten monster drops its essence (a Kobold's worth more than a boar's); absorbing it from the bag takes
  2 s, anywhere, mid-fight too (a hit stops it, the essence kept), and a full step breaks through: every stat goes up
  and you get free points to place (taken back by a campfire). Stats are strength, agility, stamina, skillpower,
  vitality (HP), defense and special defense, plus hidden toughness, stamina recovery and health regen. Dying loses
  the step's essence, or with none, a whole step. Click your portrait (bottom left) to turn it over to your core: a
  glass sphere whose light grows brighter every step and changes colour every realm, fiery Yan to ethereal Tian, with
  no bar or number; sparks show as a breakthrough nears, and a breakthrough flashes. The character panel shows your
  stats as a polygon chart, where free points are placed (hovering + or − previews the change).
- **Vitals carry over:** HP and stamina stay between fights and visits. Resting at the campfire, eating boar meat
  or dying refills them, and HP slowly comes back on its own.
- **Inventory:** a 6 x 4 bag that items fit into by size, and a weight limit that grows with strength. Over the
  limit a dodge costs more stamina; 20% over it, you can't dodge and walk at half speed. Every monster drops its
  essence, boars sometimes meat (heals), a hide or a tusk, and wolves a pelt or a fang (the forge buys both). Dying
  drops all you carry. The
  bag screen (B) shows what you wear, a cloth to sort things on (lost when the screen closes) and the bag, worked
  with the mouse (you stand still while it's open): hover for an item's tooltip, click to select, drag to move, R
  or a right click to turn, Enter or a double click to eat or absorb. Eating takes a second, on the overworld or
  mid-fight, and a hit stops it.
- **Money and shops:** gold, silver and copper coins (100 of one make one of the next) are items in the bag, lost on
  death like the rest; nobody starts with any. Talk to a keeper in Highmere and Trade: their stock shows beside the
  bag, with what they'll buy from it, priced in "1g 20s 5c". Prices are steeper in the capital and the first
  purchase at each shop is cheaper. Coins never change by themselves: any shop, or the money changer, swaps one for
  100 of the next and back. Change that doesn't fit in the bag lands on the cloth (now 8 x 6).
- **Drops:** a won fight's loot lies in the arena where the enemy crumbled away, shared by the winners. Walk up to it,
  look at it and press E to open it next to the bag; what you drag into the bag is yours, first come, first served.
  The arena closes after 5 minutes (Enter leaves earlier, asking first if loot is left), and what's left becomes a
  pile on the overworld where the fight began, for anyone nearby, opened there the same way: walk up, face it, E.
  A pile vanishes once it's empty, or 10 minutes after it lands. What a player drops on dying lies where they fell,
  for the others in the arena to take once the fight is won, and goes the same way.
- **Skills:** words chained into skills (five Forms: Bolt, Beam, Nova, Imbue and Self; seven elements with their
  statuses and four reactions; eight modifiers), paid in stamina. In a fight, R opens the chant: a skill built word by
  word in a carousel of squares (click a word, search for one, or pick by number; Backspace undoes), cast with Enter; it
  needs no book, and anyone chanting shows their words in front of them. The skillbook has four pages, written from the
  bag screen (Open on the book in hand) or in a fight (2 s, standing still), and quick-cast with 1-4 (hold the key to
  keep a Beam going). A new character knows no words yet. Dying keeps the pages and the words.
- **Equipment:** hands, head, body, legs and boots; you start empty-handed (Bram's stick is the first weapon), and dying
  drops what you wear with the rest. Without a weapon in hand you can't attack or block; without the skillbook you can't
  quick-cast. Worn things count toward the weight. A heavier weapon swings slower and costs more stamina, less so the
  stronger you are, and too heavy for your strength it can't be wielded.
- **HUD:** HP and stamina bars, your portrait (turned over, your core), foes beaten, the level's name, the ping, and
  buttons for the character panel, the inventory, the questbook and Settings. Small notices (loot, a full bag, dying,
  resting, eating, a breakthrough, quests) stack in the bottom-right corner and fade; only a fight starting gets the
  big banner in the middle.
- **Sound:** sound effects for swings (lower and heavier with a heavier blade or a heavy attack), hits, blocks,
  footsteps, dodges and jumps, the enemies' grunts, deaths and wind-ups, skills (cast, flight, impact), eating, items, resting
  and clicks; flowing rivers and crackling campfires nearby. Sounds come from where they happen: quieter further
  away, and to the left or right. Looping music on the title, in each level and in fights (the mire has its own),
  crossfading from one to the next. Every file is CC0 ([SOUNDS.md](SOUNDS.md)).
- **Settings** (Esc): camera and swing sensitivity, auto mouse lock and show ping (both on by default), master,
  effects, ambient and music volume, key bindings (general: Esc, WASD, the panels; the overworld's; the arena's),
  return to title.
- **Saving:** your character, vitals, core, wins, bag, equipment, story, settings and first purchases are kept with your
  account in Postgres.
- **Server:** runs the overworld and the fights, and decides both: hits, damage, stamina, deaths and who won. In a
  fight the browser runs its own copy of the whole fight, so you and the boar answer at once, and sends only its
  inputs, each for a numbered step; the server runs them on those steps (up to 200 ms late), checks the browser's
  copy 4 times a second and corrects it when they differ. The result shows only once the server says so. Leaving
  mid-fight loses it (what you carry drops, as on a death); a fight ends as a loss after 10 minutes.

## Running it

Needs Node and Docker (Docker Desktop running): the dev database is Postgres in a container.

```sh
npm install
npm run dev
```

Open http://localhost:5173 and log in as **test1 / test1** (or test2 / test2, test3 / test3), or create an
account. `npm run dev` starts the database, adds those accounts if they're missing, then runs the server (:8787)
and the client (Vite on :5173, which forwards `/ws` and `/api` to the server).

```sh
npm start          # production: build the client; the server serves it + /ws + /api on http://localhost:8787
npm test           # unit tests (shared, server, client); no database needed. CI runs typecheck, test, build
npm run typecheck  # shared, server, client and their tests, then the server's layering (server/scripts/check-layers.ts)
npm run build      # the client bundle
npm run db:up      # start the database (and wait until it's ready); db:down stops it, data is kept
npm run db:reset   # delete all its data, then seed it again
npm run db:seed    # add the dev accounts if they're missing: test1, test2, test3, user (password = username)
npm run db:psql    # SQL shell
npm run db:generate -- --name <what-changed>  # after editing server/src/db/schema.ts: writes the migration
```

Local settings (database user, password and port, `DATABASE_URL`, the server's `PORT`, `DEV_PING_MS`, the server's
name in the server list `SERVER_NAME` and its player cap `MAX_PLAYERS`) live in `.env`, which is git-ignored.
`npm run dev` copies it from `.env.example` the first time. Changing `POSTGRES_USER`, `_PASSWORD` or `_DB` after the
database exists needs `npm run db:reset`.

**A simulated ping (dev only).** The dev server delays the game's messages by half of `DEV_PING_MS` each way (50 ms
if it's left out; any whole number of ms, 0 for none), so the netcode can be felt on localhost. For one tab, add
`?ping=N` to the page's address (http://localhost:5173/?ping=200; the HUD's ping then reads about 200); no restart
needed. Production never delays.

**The admin panel (dev only).** F1 in the game opens a panel of cheats: the time of day and how fast it runs,
invulnerability, a heal, completing the current quest, resetting your save, a fight with any enemy, and any item into
the bag. Production has no panel and its server ignores cheats.

**Troubleshooting.**

- `EADDRINUSE` on :8787: an older `npm run dev` is still running.
- "can't reach Postgres": Docker Desktop isn't running, the database isn't up (`npm run db:up`), or `.env`'s
  `DATABASE_URL` doesn't match its `POSTGRES_*` lines.
- "a migration failed (relation ... already exists)": the dev database was made by another branch.
  `npm run db:reset`.

## Hosting

On a Linux machine with Docker and its compose plugin, reached only through a Cloudflare Tunnel (no open ports).
`compose.prod.yaml` runs the game server and Postgres, with the server on the machine's own 127.0.0.1:8787 only.

1. Clone the repo, `cp .env.example .env`, and in `.env` set `POSTGRES_PASSWORD` (`openssl rand -hex 32`),
   `SERVER_NAME` and `MAX_PLAYERS`.
2. `docker compose -f compose.prod.yaml up -d --build`. The server applies migrations as it starts; there are no
   test accounts.
3. In Cloudflare Zero Trust (Networks > Tunnels), create a tunnel and give it a public hostname for the game, with
   the service `http://localhost:8787`. On the machine, install `cloudflared` from Cloudflare's apt repo
   (pkg.cloudflare.com) and run `sudo cloudflared service install <token>` with the tunnel's token.

The server counts login tries by Cloudflare's `CF-Connecting-IP` header (`BEHIND_CLOUDFLARE`, which
`compose.prod.yaml` turns on), so it must be reachable only through the tunnel, as the loopback port keeps it.

```sh
git pull && docker compose -f compose.prod.yaml up -d --build      # update (fights under way are lost)
docker compose -f compose.prod.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > tower.dump  # back up
docker compose -f compose.prod.yaml stop app                       # restore: stop the game, then
docker compose -f compose.prod.yaml exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < tower.dump
docker compose -f compose.prod.yaml start app
```

## Files

```
shared/            code the server and the browser both run: ECS, math, the arena fight (Rapier), the Zod messages
server/            the authoritative game server: core/ is the game, api/ ws/ db/ plug into it
client/            the browser game: its modes, their drawing (Babylon.js), React UI, character art in code (ART.md)
*/test/            unit tests for each workspace, mirroring its src/ (npm test)
.github/workflows/ CI: typecheck, test and build on every PR
plan/              future plans and parked ideas
compose.yaml       the dev database (Postgres in Docker)
compose.prod.yaml  hosting: the server (Dockerfile) and Postgres
.env.example       local settings; copied to .env
```

The character art can be previewed at http://localhost:5173/art.html while `npm run dev` runs.

| Doc | What's in it |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | how the code fits together, every file, how to add things, where to tune |
| [FORMULAS.md](FORMULAS.md) | every calculation that decides how the game plays, with worked examples |
| [SOUNDS.md](SOUNDS.md) | every sound and music file: where it's from, who made it, its licence (all CC0) |
| [AGENTS.md](AGENTS.md) | how to work in this repo: ask before game mechanics, decisions so far, checks, git and PRs |
| [plan/](plan/README.md) | where it's headed |
