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
- **Overworld:** Floor 1's Grass Field, a dusky tile map of paths, tree lines, rocks, a stream and pond, ruins and a
  patch of tall grass; trees, rocks, water and ruin walls block walking. A boar and, each in a corner of its own, a
  Kobold Swordsman (a Kobold Greatsword beside it) and a Goblin Warlock wander
  and chase you on sight. Touching one, or walking through tall grass (boars only), starts a fight. Wider screens
  than 16:9 get side bars. It's drawn HD-2D: pixel-art billboards on 3D ground, with cliffs round the field and a
  tilt-shift blur, lit by the same 24-minute day as the fights (the sun and moon cast the shadows, the campfire
  flickers and lights what's near it). The arrow keys turn the camera a quarter turn; walking follows it. Everyone
  on a level shares it: you see other players (their chibi and name, crossed swords while they fight), and an enemy
  someone touches is gone for everyone until it respawns. T challenges a player next to you to a duel: a spar in
  stone ruins of your own, everything working player against player, that costs and wins nothing. Next to a player's
  crossed swords, E (or "Join the fight") joins their battle, up to 4 to a fight, each with their own result and
  drops.
- **Fights:** a 2D sprite against a 3D boar, Kobold Swordsman or Goblin Warlock in a small round arena, each with
  its own look (a forest clearing, stone ruins, a mire), lit by a 24-minute day: the sun and moon rise and set, the
  shadows follow them, and glowing mushrooms light the mire.
  A sword with eight swings (one per way across
  the screen) and a stab, a held block, a dodge roll with i-frames, jump, stamina. Horizontal swings hit wide and
  short, vertical ones narrow and long, the stab a long thin line. Swings follow the blade's inertia: they start slow
  and carry on by momentum, so a swing on the way the blade already goes comes round quicker and hits harder (the HUD
  shows the combo), and stamina goes by the effort (reversing costs most); weapons have mass and
  balance (a longsword and a greatsword swing slower and hit harder), and strength sets how fast you swing. A block
  stops what hits it from in front for stamina, and breaks,
  staggering you, when the stamina runs out. A blocked or parried blade stops dead in sparks, and a
  landed hit holds the picture for a beat (longer the heavier the blade) and jolts its target the way the blade went.
  A fight starts locked onto the
  closest enemy: you face it, circle it with A / D, and the camera follows it. The boar lunges up close and does a
  telegraphed charge from further away (it's stunned if it hits the wall), and staggers after a few quick hits. The
  Kobold Swordsman swings in chains of two or three (any way, or a stab), each with a wind-up to read: the reverse swing
  just before one lands parries it (the Kobold is stunned and takes more damage; a swing 45° off the reverse parries
  for half the stun), and a stab just before its stab lands parries that.
  On guard it parries your swings and blocks your stabs, so hit it while it recovers from a chain or is stunned. The
  Kobold Greatsword fights the same with a much heavier blade. The
  Goblin Warlock keeps its distance and casts Bolt Fire at you (sometimes homing, sometimes split), quick up close and
  chanted from afar, its words shown in front of it; run it down and stagger its chant, but mind its staff. Your
  sprite winds up, strikes and follows through on every swing and the stab, holds the sword out where a swing left it,
  raises its guard to block, and reels when staggered. Another player facing your camera (in a duel, say) shows their
  front, face and all.
- **Controls:** keyboard + mouse or trackpad, which is required (a fight captures the mouse as it starts, or on a
  click with Auto mouse lock off). Every key can be rebound in Settings. In a fight: WASD move, Q toggles the
  lock, Right Shift locks the closest enemy, the arrows switch target (unlocked, they or a right-button drag turn
  the camera), Space jumps, F dodges, Left Shift blocks; a quick flick of the mouse swings the way it moves (one of
  eight), and a left click stabs. R opens the chant, and 1-4 quick-cast the skillbook's pages.
- **Chat:** one chat for the whole server, in the overworld and in fights. / opens it (you stand still while you
  type), Enter sends, Esc closes; a click on the game gives it the keys back with the chat still open, and / goes
  back to typing. Lines show in a log at the bottom left and, in the overworld, in a bubble over the
  speaker's head. The server keeps the last 1000 lines in memory, sends the last 50 to whoever joins, and takes up to
  500 characters a line and 10 lines in 5 seconds from each player.
- **Stats:** strength, agility, stamina and skillpower on every fighter (skillpower scales skill damage).
- **Vitals carry over:** HP and stamina stay between fights and visits. Resting at the campfire, eating boar meat
  or dying refills them.
- **Inventory:** a 6 x 4 bag that items fit into by size, and a weight limit that grows with strength. Over the
  limit a dodge costs more stamina; 20% over it, you can't dodge and walk at half speed. Boars sometimes drop meat
  (heals), a hide or a tusk. Dying empties the bag but for your weapons and skillbook. The bag screen (B) shows what
  you wear, a cloth to sort things on (lost when the screen closes) and the bag, worked with the mouse (you stand
  still while it's open): hover for an item's tooltip, click to select, drag to move, R or a right click to turn,
  Enter or a double click to eat.
- **Drops:** a won fight's loot lands as a pile where the fight began, seen by everyone nearby. E opens the nearest
  pile next to the bag (E also rests at a campfire or joins a fight, whichever is nearest), and what you drag into
  the bag is yours: first come, first served. A pile vanishes once it's empty, or after 10 minutes.
- **Skills:** words chained into skills (five Forms: Bolt, Beam, Nova, Imbue and Self; seven elements with their
  statuses and four reactions; eight modifiers), paid in stamina. In a fight, R opens the chant: a skill built word by
  word in a carousel of squares (click a word, search for one, or pick by number; Backspace undoes), cast with Enter; it
  needs no book, and anyone chanting shows their words in front of them. The skillbook has four pages, written from the
  bag screen (Open on the book in hand) or in a fight (2 s, standing still), and quick-cast with 1-4 (hold the key to
  keep a Beam going). For now everyone knows every word. Dying keeps the pages and the words.
- **Equipment:** you start with a sword in your right hand and a skillbook in your left, and for now a longsword and
  a greatsword in the bag; dying keeps them all where they were. Without a sword in hand you can't swing, stab or
  block; without the skillbook you can't quick-cast. Worn things count toward the weight.
- **HUD:** HP and stamina bars, foes beaten, the level's name, the ping, and buttons for the character panel, the
  inventory and Settings. Small notices (loot, a full bag, dying, resting, eating) stack in the bottom-right corner
  and fade; only a fight starting gets the big banner in the middle.
- **Settings** (Esc): camera and swing sensitivity, auto mouse lock and show ping (both on by default), key
  bindings (general: Esc, WASD, the panels; the overworld's; the arena's), return to title.
- **Saving:** your character, vitals, wins, bag, equipment and settings are kept with your account in Postgres.
- **Server:** runs the overworld and the fights, and decides both: hits, damage, stamina, deaths and who won. In a
  fight the browser runs its own copy of the whole fight, so you and the boar answer at once, and sends only its
  inputs, each for a numbered step; the server runs them on those steps (up to 200 ms late), checks the browser's
  copy 4 times a second and corrects it when they differ. The result shows only once the server says so. Leaving
  mid-fight loses it (the bag empties, as on a death); a fight ends as a loss after 10 minutes.

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
npm run db:seed    # add the dev accounts if they're missing: test1, test2, test3 (password = username)
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
invulnerability, a heal, a fight with any enemy, and any item into the bag. Production has no panel and its server
ignores cheats.

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
| [AGENTS.md](AGENTS.md) | how to work in this repo: ask before game mechanics, decisions so far, checks, git and PRs |
| [plan/](plan/README.md) | where it's headed |
