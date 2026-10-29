# Multiplayer

Status: **being built**, as a stack of PRs.

The user asked (their words): "overhaul net/. it should be consolidated to a nice simple API", "running servers. for
now just 1 server should work? but client can see a list of servers to join", "support multiplayer joining", "if
time, another user can join a users' arena if they're mid battle", and "ability to pvp (request pvp with another
player to send them both into an isolated arena)". They said "do whatever you think is right"; every pick below is
the agent's and gets listed in AGENTS.md under "Decided by the agent while the user was away".

One stacked PR each, in this order (each on the one below, joined with `gh stack link`):

1. `net-api` (built): one simple net API, no behaviour change.
   - shared: all message types in one place per direction (client messages with their Zod schemas, server messages
     as types), HTTP request/response types (accounts, and the server list from PR 2) beside them; drop leftovers.
   - client `net/`: one `Net` (the socket owner): `Net.connect(server)`, `net.send(msg)`, `net.on(t, fn)` returning
     an unsubscribe, `net.onLost(fn)`, `net.close()`, ping built in. Modes subscribe to what they need instead of one
     big `listen({...})` in game.ts. HTTP calls (login, register, me, servers) in one `net/api.ts`.
   - server `ws/`: keep the Connection (`PlayerLink`) and the handler table; tidy names only.
   - Same messages on the wire; the replay/fight hashes don't change. Tests move with the code.
2. `server-list` (built): `GET /api/servers` lists the game servers: for now only this one (name from `SERVER_NAME` in
   `.env`, default "Local"), with players online and a cap (`MAX_PLAYERS` 50; the socket is refused with a close
   code when full). After login the title screen shows the list; choosing one and Play connects to it. Shaped so a
   second server is a second entry later (same database, same login cookie).
3. `shared-overworld` (built): one Overworld per level, shared by every player on it. Players see each other (chibi in
   their look, name above), walking predicted for yourself, others interpolated. Enemies are shared: the one who
   touches an enemy fights it and it's gone for everyone until it respawns (`respawnTime` after the fight is
   decided). Tall-grass encounters stay per player. Players pass through each other. A player in a battle stays on
   the overworld where they were, shown with a crossed-swords marker, and enemies pass them over. Server view rules
   (view radius) apply to players too.
4. `duels` (built; not yet played by hand) (PvP): stand within 2 tiles of another player and press Challenge (`T`,
   overworld group, rebindable). They get a notice with Accept / Decline (buttons, and `Y` / `N`, rebindable); it
   expires after 15 s; one open challenge per player. On accept both go to their own isolated arena (stone ruins look),
   facing each other. Everything that hits enemies hits players: swings, stabs, blocks, parries (the same `PARRY` rules,
   both ways), skills. A duel is a spar: it ends when one reaches 0 HP (no death), nothing is lost or gained, no wins
   counted, and both come back with the HP and stamina they had before it. Leaving or disconnecting forfeits, with no
   loss. Netcode: the server relays each player's confirmed inputs to the others; a client predicts another player as
   repeating their last input and rolls back and replays when the real one arrives (another player may lag on your
   screen, your own character never does). The hash/resync check stays as the safety net.
   Not done: the other player is drawn with the battle sprite from behind (there's no front view yet), and in a
   duel's first seconds each client loads the server's fight a few times while the two clocks settle (no hash ever
   differed in the headless check; none after that).
5. `join-battle` (if time): near (1.6 tiles) a player's crossed-swords marker, press the interact key (E, the Rest
   key, which joins when there's no campfire closer; also a HUD "Join the fight" button) to join their battle. Up
   to 4 players a battle; a joiner appears at the arena's edge; duels can't be joined. No friendly fire in a shared
   battle; enemies go for the nearest player; enemy HP doesn't scale. A player who dies loses their bag as now and
   wakes at the level's start, and the fight goes on for the rest; when it's won, everyone still in it counts a win
   and rolls their own drops.

## Where things stand

- The server is already authoritative for the overworld, and every player has an account and a save. Each level has
  one shared `Overworld`; each player's `GameSession` has a walker in it. A fought enemy comes back `respawnTime`
  after its fight is decided (AGENTS.md lists the rest of the picks).
- A second tab on the same account takes over the first (close code 4000).
- Fights run on the server, built for any number of players, but every battle has one for now
  ([server-fights.md](server-fights.md) lists what more players would need).

## Still open

- More than one overworld per level (channels), and parties bigger than a shared battle's 4.

## Parked: geckos.io

[geckos.io](https://github.com/geckosio/geckos.io) sends game messages over WebRTC data channels (UDP-like: no
waiting for a lost packet to be resent). The user asked to note it down. Worth a look only if multiplayer latency
turns out to matter; until then game messages stay on plain `ws` (`server/src/ws/`).
