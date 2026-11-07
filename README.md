# Infinite Tower

A browser game in progress: an open-world RPG with souls-like fights. You explore an HD-2D overworld shared with
everyone online and fight monsters in small 3D arenas, in first person.

Babylon.js in the browser, Rapier for the arena's physics, React + Tailwind for the UI, a Node server (Fastify + ws),
Postgres (Drizzle).

## Features

- **Accounts and servers:** username and password, a server list on the title, a second tab taking over the first.
- **Character creation:** a name and a pixel-art anime look (build, face, hair, eyes, mouth, colours), kept for good.
- **One open world:** Highmere, the Empire's Door City, where every new player wakes on the summoning platform, and
  test areas beyond it, walked into with no loading. Summoning pads you bind to, campfires to rest at, tall grass that
  starts fights, a day and night cycle, flowing and still water.
- **People and quests:** NPCs with lines that follow your story, quest chains (gather, deliver, go, talk, slay) that
  start with Bram's training yard and the butcher's chicken pen, lore revealed as you go, and a questbook.
- **Fights:** locked on in first person against boars, chickens, wolves, bog lurkers, Kobolds and a Goblin Warlock,
  each with readable tells. Light, heavy and stab swings aimed by mouse flicks, chains that build momentum, a held
  block with a perfect block, swing parries, feints, dodges, shields and dual blades, placeholder bows.
- **Skills:** words chained into skills (Forms, elements, modifiers), chanted word by word or quick-cast from a
  skillbook, with element statuses and reactions, buffs and debuffs.
- **The core:** progression without levels: monster essence grows your soul through five realms, shown as a glowing
  sphere; stats, free points, inscriptions carved into it and blessings from the gods.
- **Items:** a grid bag and backpack with a weight limit, gear slots and cosmetics, rarity and one-of-a-kind items,
  loot as piles in the arena and on the overworld, hardcore death drops, coins and shops.
- **Together:** everyone shares the overworld, duels by challenge, joining a fight under way, server-wide chat.
- **Presentation:** an "Inscribed" HUD, sound effects heard from where they happen, music per region and fight.
- **Server-authoritative:** the server runs the world and every fight; the browser runs its own copy of a fight so it
  answers at once, and takes the server's when they differ.
- **Dev tools:** an admin panel (F1) and chat cheats, a simulated ping, and the art lab's pixel editor.

## Running it

Needs Node and Docker (Docker Desktop running): the dev database is Postgres in a container.

```sh
npm install
npm run dev        # the database, the dev accounts, the server (:8787) and the client (:5173)
```

Open http://localhost:5173 and log in as **test1 / test1** (or test2, test3, user; password = username).

```sh
npm start          # production: build the client; the server serves it + /ws + /api on :8787
npm test           # unit tests (no database needed)
npm run typecheck  # from the root: every workspace, then the server's layering
npm run build      # the client bundle (and the art lab's)
npm run art        # the art lab on http://localhost:5175
npm run db:up      # start the database (db:down stops it, db:reset wipes and reseeds it, db:psql opens SQL)
npm run db:seed    # add the dev accounts if they're missing (npm run dev does it)
npm run db:generate -- --name <what-changed>  # after editing server/src/db/schema.ts
```

Local settings live in `.env` (git-ignored), copied from `.env.example` the first time; changing its `POSTGRES_*`
lines after the database exists needs `npm run db:reset`. With `CHEATS=1` (the dev default) F1 opens the
admin panel, `/help` in the chat lists the cheats, and `?ping=N` on the page simulates a ping.

**Troubleshooting.** `EADDRINUSE` on :8787: an older `npm run dev` is still running. "Can't reach Postgres": Docker
isn't running, the database isn't up (`npm run db:up`), or `.env`'s `DATABASE_URL` doesn't match. "A migration failed
(relation ... already exists)": the database came from another branch; `npm run db:reset`.

## Hosting

On a Linux machine with Docker, reached only through a Cloudflare Tunnel (no open ports). `compose.prod.yaml` runs the
game server and Postgres, the server on the machine's own 127.0.0.1:8787.

1. Clone the repo, `cp .env.example .env`, and set `POSTGRES_PASSWORD`, `SERVER_NAME` and `MAX_PLAYERS`.
2. `docker compose -f compose.prod.yaml up -d --build` (migrations apply as the server starts).
3. Create a Cloudflare tunnel with a public hostname for `http://localhost:8787`, and install `cloudflared` on the
   machine with its token. Login limits trust Cloudflare's address header, so keep the server reachable only that way.

```sh
git pull && docker compose -f compose.prod.yaml up -d --build      # update (fights under way are lost)
docker compose -f compose.prod.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > tower.dump  # back up
docker compose -f compose.prod.yaml stop app                       # restore: stop the game, then
docker compose -f compose.prod.yaml exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < tower.dump
docker compose -f compose.prod.yaml start app
```

## Files

```
shared/      code the server and the browser both run, including the arena fight
server/      the authoritative game server: core/ is the game, api/ ws/ db/ plug into it
client/      the browser game: modes, drawing (Babylon.js), React UI, art drawn in code
art-lab/     a dev tool for drawing the game's art (npm run art)
plan/        future plans
```

| Doc | What's in it |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | how the code fits together and how to add things |
| [FORMULAS.md](FORMULAS.md) | the calculations that decide how the game plays, and where their numbers live |
| [ART.md](ART.md) | the art direction and the art lab |
| [SOUNDS.md](SOUNDS.md) | every sound and music file's source and licence (all CC0) |
| [AGENTS.md](AGENTS.md) | the goals, how to work in this repo, and the standing design decisions |
| [plan/](plan/README.md) | where it's headed |
