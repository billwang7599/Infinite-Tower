# Architecture

How Infinite Tower's code fits together, where every file lives, and how to add things. Keep it in sync when you
add, move or rename files, or change how the pieces talk to each other.

- [The big picture](#the-big-picture)
- [A player's visit, start to end](#a-players-visit-start-to-end)
- [Server: core plus outlets](#server-core-plus-outlets)
- [Client: two modes, one ECS world](#client-two-modes-one-ecs-world)
- [Networking](#networking)
- [Saving](#saving)
- [Tests](#tests)
- [Rules](#rules)
- [Folders and files](#folders-and-files)
- [Adding things](#adding-things)
- [Where to tune things](#where-to-tune-things)

## The big picture

```
              Browser: client/
  ui/ (React)    game/    modes/: overworld/, battle/    visuals/ (Babylon)    audio/ (Web Audio)
       │                                 │
       │ HTTP /api                       │ WebSocket /ws
       ▼                                 ▼
┌─ Node: server/ ──────────────────────────────────────────┐
│   api/  Fastify                   ws/  the game socket   │
│         └───────────────┬────────────────┘               │
│                         ▼                                │
│                  core/  the game                         │
│                         ▲                                │
│                  db/  Drizzle ───────────────────────────┼──► Postgres
└──────────────────────────────────────────────────────────┘
Arrows point at what each piece plugs into or calls.

shared/: code both sides run (ECS, math, message types + Zod schemas, overworld walking, the view size, the arena
         fight with its Rapier physics)
```

Three npm workspaces. The rule: **shared = code both sides run; server = anything a player must not be able to
change; client = drawing, input, feel.** Everything in `shared/` and `client/` ships to the browser, so data only
the server needs (encounter rates, spawns, enemy stats, drop tables) stays in `server/`.

## A player's visit, start to end

1. **Title.** `client/src/main.ts` mounts the React UI (the title screen), asks `GET /api/me` who's logged in, and
   starts `prepareGame()` in the background: `game/start.ts` is its own lazily loaded chunk with Babylon, so the
   title shows first while the engine, the arena's physics (Rapier) and both scenes get built behind it.
2. **Login.** The login form calls `POST /api/login` (or `/api/register`), which sets the httpOnly `it_session`
   cookie (30 days). Logged in, the title lists the game servers (`GET /api/servers`), the first picked.
3. **Join.** Play opens the picked server's socket (`/ws`); the cookie goes with it. Meanwhile the title plays its
   enter sequence (`ui/screens/title/sequence.ts`): the view goes into the tower and speeds up it until the game has
   joined. Only
   once the title has cleared off the world (`inWorld` in `ui/state.ts`) does the HUD show and the game, and the
   screens over it, take keys. The server finds the account, loads the save (a new one carries and knows nothing)
   and sends
   `welcome` (HP / stamina, the core, settings, character, wins, gear, known words, the skillbook's pages, the
   questbook). With no
   character yet, the white the
   title flashes into holds: character creation (`ui/screens/creation/`) plays on it, and the server waits for a
   `character` message (only one: a character is kept for good); then it sends `level`.
4. **Overworld.** While you move, the client sends one `input` per 60 Hz tick and predicts its own walking with the
   shared `stepWalker` (at the pace the gear's weight allows; solid tiles stop it). The server replays the inputs,
   runs the level's actors (walking by the same rule), rolls encounters in tall-grass tiles and sends `state`
   20 times a second with the actors and other players near your screen. Every player on a level walks the same
   overworld: they see each other, and an enemy one of them touches leaves it for everyone. The client glides its
   mirrors toward those positions.
5. **Fight.** The server makes the fight (a `BattleRoom` running the shared `Fight`) and sends `encounter` with its
   setup (arena, enemy, your HP / stamina, core and its stats, burden, the bag and what's worn (so whether a sword and a
   skillbook are in hand), and its pages). The client
   flashes into battle mode, builds the same
   fight and runs it itself, whole and at once, sending only its inputs, each tagged with its step (`battleInput`).
   The server runs the same fight on those inputs at those steps (hits, damage, stamina, deaths), sends a hash of it
   4 times a second (`battleHash`; a client whose copy differs asks for the whole of it, `battleSync`), and the
   moment it's decided, sends the final `battleSync`, rolls drops and lays them as a pile in the arena beside the
   fallen enemy (or, on a loss, drops all in the bag and slots as a pile where they fell), saves
   and sends `battleResult`: only then does the result show. After a win the fight runs on for up to `AFTER_FIGHT_MS` (5
   minutes) while the winners walk to the drops and take what they want; Enter leaves the arena (`leaveBattle`;
   asking first while drops are still there), and the overworld goes on. The last one out leaves what's left as an
   overworld pile where the fight began.
6. **Leave.** Return to title, closing the tab or losing the connection closes the socket, and the server saves.
   Mid-fight, that loses the fight (`LEAVING_LOSES`): what they carry drops as on a death.
   In the arena after a win it's leaving the arena, with what was taken kept.
   A second tab on the same account takes over: the first one is closed and lands on the title.

## Server: core plus outlets

The server is hexagonal. `server/src/core/` is the game: sessions, the overworld, fights, levels, content and the
account rules. It knows nothing about sockets, HTTP, SQL or env; what it needs from outside it asks for through the
interfaces in `core/ports.ts`. The outlets plug into it, and `main.ts` is the only file that sees everything:

```
main.ts
 ├─ await initPhysics()                                   the arena fight's Rapier, loaded once
 ├─ db = await connectDb(DEV)                              db/: connects to DATABASE_URL, applies new migrations
 ├─ accounts = new Accounts(new PgAccountStore(db))        core/ rules, db/ storage
 ├─ online = new OnlinePlayers(new PgPlayerStore(db), DEV, MAX_PLAYERS)  core/: who's playing, one GameSession each
 ├─ startServer({ accounts, socket: gameSockets(online, { dev, pingMs }), servers })
 │     ├─ api/  Fastify: /api routes, /api/servers (this server's name and online.count), the built client, the
 │     │        /ws handshake
 │     └─ ws/   gameSockets(): each socket becomes a Connection (the PlayerLink) bound to a GameSession
 └─ timer -> FixedClock (60 steps a second) -> online.tick(dt): each level's overworld steps, then each session
                                                      sends its state or steps its battle
```

| Port (`core/ports.ts`) | What core uses it for | Implemented by |
|---|---|---|
| `PlayerStore` | load / save a `PlayerSave` | `db/player-store.ts` (`PgPlayerStore`) |
| `AccountStore` | accounts and login sessions | `db/account-store.ts` (`PgAccountStore`) |
| `PlayerLink` | send messages to one player, close their connection | `ws/connection.ts` (`Connection`) |

- Core imports only `core/`, `shared` and `node:crypto`. An outlet imports `core/` and itself, never another
  outlet. When two outlets have to meet, the one that needs something defines an interface and `main.ts` passes in
  the other's implementation (`api/` defines `GameSocket`; `ws/` builds it).
- `npm run typecheck` runs `server/scripts/check-layers.ts`, which fails on an import that breaks these rules. Fix
  the import rather than loosening the check.
- Core sends the `shared` message types as they are (they're already the contract with the client), and it can run
  with fake stores and links, without Postgres or a browser.

## Client: two modes, one ECS world

- **Game data is ECS** (`shared/src/core/ecs.ts`: world, components, queries). Systems are functions run in a fixed
  order. Services (the connection, keyboard, mouse, prediction, the fight's sync) are plain classes.
- **Every key goes through one input system, in two parts.** The devices (`core/keyboard.ts`, the only key listener,
  and `core/mouse.ts`) only know buttons: held, latched presses, in order. `core/actions.ts` alone turns keys into
  actions, for a stack of layers (`whoHasTheKeys` in `ui/state.ts`, e.g. battle with Settings on top); only the top
  one gets keys, and it makes only its own actions (the bag's Esc is `closeBag`, not Settings' `menu`). One-off
  things listen by action name alone (`actions.on`, `useAction` in the UI), so an action name means one thing
  everywhere; the overworld's tick and the fight's steps call `actions.poll()` once each, for what's held and what was
  pressed since (in order), and the axes `move.x`, `move.z`, `turn` and `look` (-1, 0 or 1, from `AXES` there),
  only while their layer is on top (the chant's, and the arena's bag's, let through only the dodge and the walk keys,
  for the dodge's way; the arena's bag takes its R and Enter from the overworld's keys, first, then the arena's);
  the arena camera reads the fight's last poll. Actions also owns the mouse: the
  pointer may lock only while the arena is on top (`setLayers`, with Auto mouse lock), and the camera reads its
  movement each frame with `actions.lookDelta()` (it turns only while the middle button, `dragCamera`, is held);
  no mode sees `Mouse`. Mouse movement in the arena is also read as flicks there: a quick move one of 8 ways
  (`FLICK`, scaled by the flick sensitivity) comes in the poll's `flicks` (`right`, `upLeft`, ...), which the arena's
  input turns into the swing's way (straight down into none); not while dragging the camera.
  A turn of the scroll wheel is a press of `MouseWheel` (one per scroll: it has to rest 150 ms), bound like a
  mouse button (the stab). In a text field only the
  arrows, Esc, the digits and Backspace count (the skill word search picks and undoes with them; a key nobody uses
  stays the field's), and Enter in a field whose `enterKeyHint` is `send` (the chat's); rebinding takes raw keys
  with `captureKey`. The chat is a layer of its own, `chat`, over the overworld or the arena, while its field has
  focus (`ui.chat`'s `focused`, which `Chat.tsx` sets on focus and blur), with only Enter (`sendChat`) and Esc
  (`closeChat`): the browser types the text into its field, and nothing else fires. A click elsewhere takes the
  focus and the keys go back to the game, the chat staying open; / (`openChat`) or a click on the field focuses it
  again.
  Pointer input in the UI stays plain DOM events.
- **Two modes, one world.** `game/game.ts` runs the frame loop and switches between the overworld
  (`modes/overworld/`, mode `"overworld"`) and the fight (`modes/battle/`, mode `"battle"`). Overworld mirrors
  (`OverworldPos`, `OverworldActor`) live in the game's world; only the active mode updates. The fighters live in the
  fight's own world (below), made on encounter and dropped when you return. The fight's result comes while you're
  still in the arena; game.ts holds it and applies it (gear, vitals, wins, notices) as you come back.
- **Drawing has one owner: `client/src/visuals/`.** It owns the engine, both Babylon scenes and everything in them
  (meshes, sprites and their painted frames, animation, the camera, effects). The modes do game logic only and import
  no Babylon (`npm run typecheck` checks it); they never call into drawing or hand it state. Each frame, after the
  mode's update, `game.ts` calls `drawing.frame(dt)` (and `drawing.show(mode)` when the mode changes), and the drawing
  reads the shown mode's state itself: `battle.ctx` (the fight, the lock, the camera's view, this frame's events) or
  `overworld.state` (the level, the actors). Every kind of thing in a fight has one row in `VISUALS`
  (`visuals/visuals.ts`), picked by `kindOf` from the components it already has (`Player`, an `Enemy`'s id, a
  `SkillObject`'s kind); a row is `{ spawn, frame, dispose }`, and `frame` diffs the fight's entities against what it
  has drawn: it spawns the new, frames the rest and disposes the gone. A row's own state holds only its meshes and
  smoothing (squash, eased angles); its pose comes from the components each frame, from Babylon-free pose functions
  that are tested (`visuals/battle/pose.ts`, `visuals/battle/weapons.ts` for any wielder's blade, `arm.ts` for a
  3D humanoid's arms, each enemy's `pose.ts`). One-shot effects are a second table, `EFFECTS`,
  by fight event type (the camera's shake, a Nova's burst, a weapon hit's hit-stop and jolt, a blocked blade's bounce
  and sparks, a perfect block's); each fires once per step and event (`FiredEffects`, `modes/battle/fired.ts`), so
  a step replayed after a resync doesn't fire it again. Hit-stop is drawing only (`visuals/battle/impact.ts`): the
  fight runs on, the two fighters' drawings hold still for the weapon's `hitStopMs` and then ease after their bodies.
  The overworld's actors are drawn the same way, from `WALKERS` by their `kind`. `fighter()`
  (`visuals/battle/battle.ts`) wraps every fighter's row, so what any `Skilled` fighter is doing is drawn the same: the
  circle at its feet while it chants or winds up, and, over anyone but you, its chant's words as a row of squares in
  front of it (`chantWords.ts`), and its going: a dead enemy lies `DISSOLVE_DELAY_TIME`, then crumbles over
  `DISSOLVE_TIME` (fading, sinking, giving off ash), and a player who left the arena (`Player.leftArena`) fades over
  `LEAVE_FADE_TIME` (the sprite in a blended copy of its frame, as the frames are alpha-tested, and its shadow with
  it). The player's look is read from `ui.overworld`'s character and painted once
  (`visuals/characters.ts`), posed for whichever hand its `Wielder` holds the weapon in, the sword itself left out:
  every player's sword is a 3D blade (`visuals/battle/blade.ts`) held at that hand's place in the frame shown,
  turned by the same blade poses as a Kobold's (`playerBlade`, `visuals/battle/pose.ts`). Every other player in the
  fight is painted the same way into a set of frames of their own, in their look (`battle.ctx.who`); the
  sets are kept between fights, one per other player. Each player's sprite shows its back or, once your camera is
  ahead of where they face (their `Skilled` aim), its front (`facingSeen`, `visuals/battle/pose.ts`); the back's
  frames are painted ahead, a front frame the first time it's shown.
- **Sound has one owner: `client/src/audio/`**, built like the drawing. Each frame, after `drawing.frame`, `game.ts`
  calls `audio.frame(mode)`, and the audio listens to the shown mode's state itself: `fightEars` (`audio/battle.ts`)
  hears the fight's step events once each (`EVENT_CUES`, by event type, through the same `FiredEffects`) and what each
  fighter has begun (a swing's blade setting off, an enemy's wind-up or death, a dodge, a jump, a skill winding up: each
  once, keyed by the step it began, so a resync's replay isn't heard twice), a landing, a step every `STRIDE_M` walked
  and a Bolt gone (its impact, unless a resync's reload remade it), and keeps a loop going for each flying skill object
  and the arena's ambience; `overworldEars` (`audio/overworld.ts`) hears footsteps, each campfire, the nearest running
  water and, where the theme gives it a sound, the nearest still water (`nearestWater` on the water map,
  `modes/overworld/water.ts`, so the drawing and the sound find the same water). Both only return plain cues and loops
  (a sound, where, a rate and a gain on top of its own), tested without a browser;
  `audio/audio.ts` alone plays them with Web Audio, each through a gain (`place` and `mixGain`, `audio/mix.ts`: full
  within the place's near distance, fading to silence at its far one, the master volume times its bus's, effects or
  ambient) and a stereo pan (left or right of where the ears face: the arena camera's look point and yaw, or the
  overworld player and the camera's quarter turns). Every sound is one row in `SOUNDS` (`audio/sounds.ts`): its files
  (`<stem>-<n>.ogg` in `audio/sounds/`, loaded with `import.meta.glob`), its volume and rate, how much each play varies
  (`spread`), its bus, whether it loops, how far it carries (`reach`); a play never repeats the variant played last
  (`take`). The other tables there say which sounds each enemy, element, arena look and level theme has. Outside the
  frame there are three ways in: what the game tells the player (`say` sets `notifications.said`, and `EVENT_SOUNDS`
  gives some kinds a sound), a move in the bag (`game.moveItem` plays `bagSound`) and a click on any button (one
  listener on the page). Browsers only start sound after a user gesture: the AudioContext is made on the first pointer
  press or as the game joins (Play), whichever is first. The volumes are settings (`settings/audio.ts`), saved with the
  others.
  Music comes the same way: each frame `musicFor` (`audio/music.ts`, tested) picks the track from the mode, the level's
  theme and the arena's look (`MUSIC`: the title's with no mode or before a level comes, then each level's, each
  arena's in a fight, none once it's decided), and when it changes the old track fades out and the new one fades in
  (`MUSIC_FADE_TIME`). A track is fetched and decoded only when it's wanted and dropped when it stops, since a couple
  of minutes of decoded music is tens of MB. It plays through the music bus, the fourth volume. On the title no frame
  runs: the title's track is the one wanted until a frame says otherwise, and `game.leave()` calls `audio.frame(null)`.
- **The overworld shows what the server says.** `modes/overworld/mirror.ts` mirrors each actor with its `kind`,
  each other player as a `peer` with their character (sent the first time you see them) and whether they're in a
  battle, and each pile as a `pile`; `modes/overworld/prediction.ts` predicts your own walking and reconciles with
  the server's acks.
- **The fight is a shared `Fight`** (`shared/src/battle/fight/`, imported from `@infinite-tower/shared/fight`, its
  own entry point so Rapier stays out of the title's chunk and the rest of the server). One object per battle, with
  no state outside it: its own ECS world, its own Rapier world, fixed steps of `FIXED_DT`, and `step(inputs)` with
  one `PlayerInputData` per player (any number of players and enemies), counted in `steps`. Its only random numbers
  come from seeds in its own state (a swordsman's swings, where split Bolts start; the server picks the seeds), and
  Rapier's deterministic build gives the same numbers on every machine, so the same setup and inputs always give
  the same fight. Its whole state goes out and back in as plain JSON (`save()` / `load()`, `fight/state.ts`: what
  changes in a fight, exactly; the colliders are put where their bodies are), and `hash()` (`hashFight`, there too)
  is a fingerprint of it with every number rounded to 2 decimals. Rapier loads once (`initPhysics()`: as the server
  starts, and in `prepareGame()` behind the title) before any fight is made. System order (`fight.ts`): player
  controller -> enemy brain -> attacks -> motor -> physics -> player ground -> combat -> outcome. It reports what
  happened in a step as `events` (hits, blocks, a charge slamming the wall, a skill's release). How a fight ends is
  `fight/outcome.ts`: lost when no player stands, won when no enemy does, lost after `MAX_FIGHT_TIME` (10 minutes,
  a guard on the server's resources), and a player who disconnects is down and has lost it (`LEAVING_LOSES`). A spar
  (the setup's `yieldAt`, a share of the most HP) keeps every fighter's HP at or above that share (`Health.floor`),
  and one at it counts as down. A `dummy` enemy takes no damage and falls once struck with a light, a heavy and a stab
  (`Enemy.struck`).
  `Fight.leave` marks a player gone from the arena (`Player.leftArena`, part of the state), downing them only while
  it's fought.
  Every hit, skill and burn hurts through `hurt` (`fight/skills/statuses.ts`), which spares an invulnerable player
  (`Player.invulnerable`, a dev cheat from the setup, or set by the server mid-fight), takes defense or special defense
  off by the damage's kind (physical or skill), and pauses HP regen (`Health.regenDelay`, `HP_REGEN_PAUSE_TIME`);
  `regenSystem` there gives it back by the fighter's stats after the step's hits.
- **The core in a fight**: each player's `Player.core` (from the setup, part of the state) and `FighterStats` (the
  setup's `stats`: the core's, from the server). Essence is absorbed as any consumable is used (`useSystem`), and a
  breakthrough counts at once: `takeCore` (`fight/player/use.ts`) adds the step's gains to the fighter's stats and
  grows its bars by `grownVitals`, and the `used` event says `brokeThrough`. So the snapshot carries each player's
  stats and both bars' most. The server takes the fight's core with its result (`Kept`, like the gear and pages).
- **The server runs it** (`server/src/core/battle/`): a `BattleRoom` per battle, from the moment every player has
  sent their first input. It keeps a clock (steps since the fight started, one a 60 Hz tick) and runs the fight up to
  it as soon as it knows every player's input for the next step (`InputTimeline`), holding a step back for a late
  input at most `MAX_INPUT_DELAY` ("A fight on the wire" below has the rules). It's authoritative: hits, damage,
  stamina, deaths and the result. Once it's decided, each player's `onEnd` settles the battle for them
  (`core/game/battle.ts`, or `core/game/duels.ts` for a duel) and `onOver` runs. A loss or a duel frees the fight
  then; a win keeps it running for the winners still in the arena (`afterFight`, `inArena`: their inputs, hashes and
  syncs as before, no result again) until the last of them leaves (`leave`, which after a win is no loss), when it's
  freed and `onClosed` runs. Whoever leaves, the others get a `battleSync` at once with them gone from the arena
  (`Fight.leave`), so their drawings fade them out. A decided room can't be joined. A room takes any number of
  players: a battle against enemies starts with one, a duel two. Each player's session ticks it with their seat, and
  only the first seat still there moves its clock, so it runs one step a tick however many are in it. A player whose
  own result is in before the fight's (`playerResult`: down while the others fight on) is settled then and out of it.
- **Joining a battle** (`GameSession.joinBattle`, `joinBattle` in `core/game/battle.ts`): the Interact key or the
  HUD's button sends `joinBattle`; the server picks the nearest player in a battle within `JOIN_RANGE_TILES` (plus
  the same lag slack as resting) and `BattleRoom.join` seats the joiner, unless it's a duel or `MAX_BATTLE_PLAYERS`
  are still in it (`joinRefused` says why). The fight gets them between steps (`Fight.join`, at `joinStart`, the
  arena's edge); the others get `battleJoined` (their `PlayerSetup`) and a `battleSync` with them in it, and the
  joiner an `encounter` with the room's whole setup and the fight as it is (`joined`). From then on it's a battle like
  any: inputs relayed, each player settled with their own result, and the drops rolled once for the fight, shared by
  the winners. The enemy taken off
  the overworld comes back once the room is over for everyone (`onOver`), not when its first fighter falls or leaves:
  the spawner holds its slot by the taken actor, not by a player. Every fighter is marked `fighting` on the
  overworld (the crossed swords), so the fight can be joined by any of them, the host gone or not.
- **Duels** (`core/game/duels.ts`): the Challenge key sends `challenge`; the server picks the nearest player within
  `CHALLENGE_RANGE_TILES` (+ `LAG_SLACK_TILES`) who isn't fighting, keeps the challenge open for `CHALLENGE_TIME` (one per player, either
  side) and tells both how it goes (`challengeNews`). On `answerChallenge` with accept, both get one `encounter` (the
  other's seat; each player's name and character are in the setup's `who`) for a `FightSetup` with `duel: true`, no
  enemies, in the level's `duelArenaId`.
  In a duel each player is on their own `side` (every `Fighter` has one: enemies -1, players 0), so every hit, skill,
  block and perfect block works player against player; every swing's way is named as its swinger sees it, so one from
  the left comes from the other's right (`mirrorWay` in `weapons/hybrid.ts`). `fight.targets` (what an
  input's `locked` indexes) is the players instead of the enemies. Over when one player stands (`outcome.ts`;
  `playerResult` gives each theirs); `settleDuel` gives back the HP and stamina they came in with and counts nothing.
- **Piles** (`core/overworld/piles.ts`; [plan/drops.md](plan/drops.md) has what's still open): items lying on the
  overworld, each an entity with an `OverworldPos` and a `Pile` (its items as a grid `PILE_COLS` wide, `packPile`, and
  when it vanishes). `Overworld.dropPile` lays one down, `pileSystem` removes it `PILE_LIFETIME_MS` after (by the
  wall clock, so a level nobody's on catches up when it next steps), and `setPileItems` with nothing left removes it
  at once. An arena's drops are piles too, held off the map and untimed (`holdPile`) until they land (`landPile`).
  `state` sends every pile within `VIEW_RADIUS_TILES`; the client mirrors each as an actor of kind `"pile"`, drawn as a
  sack. A pile is opened the same way here as in the arena: by looking at it. The rule is the shared `inView`
  (`shared/src/world/interact.ts`: within `INTERACT_RANGE_M` and `INTERACT_LOOK_RAD` either side of the way you face,
  the one nearest that line), which the server runs with its slack as `inViewWithSlack` (`INTERACT_LAG_SLACK_M`,
  `INTERACT_LOOK_SLACK_RAD`, `core/overworld/interact.ts`), for both places, and for talking to an NPC. On the
  overworld the way you face is the walker's heading: the client turns its chibi with `faceToward` on each predicted
  step, and the server turns its copy (`OverworldPlayer.heading`) with the same `faceToward` on each input it replays,
  both from `START_HEADING` on entering a level. Interact sends `openPile` when the pile in view is
  the nearest thing in reach (`interactionAt`), and opens the bag screen; the session opens the one in view of its copy
  (`Overworld.pileInView`) and from then on keeps a copy of it in its gear's `pile` (the `Gear`'s fourth grid, `NO_PILE`
  for none, never saved or taken into a fight), followed every tick, so another player's take or its vanishing reaches
  it as a `gear`. A `moveItem` from the pile runs the shared `moveGear` on the overworld's pile as it is now (first come
  first served) and writes it back; `moveGear` puts nothing onto a pile. The pile closes with the bag (`closeBag`), on
  walking and when a fight starts.
- **NPCs** are kept like enemies, by id (`NpcId`, `shared/src/world/layout.ts`): where one stands and what it says is
  its file on the server (`core/npcs/<id>.ts`, in `NPCS`), its name and look a folder on the client
  (`visuals/npcs/<id>/`, in `NPC_LOOKS`). An NPC is a list of `stops` (a level, a spot, the way it faces, a condition on
  the story), each with its `talk` there: lines, each with a condition, and maybe an offer (`{ start: quest }`, `{
  deliver: quest }` or `{ shop }`), and maybe a `trace` (a spot and lines it leaves once it moves on). For each player
  (`core/game/talk.ts`) it stands at its first stop whose condition holds (`stopFor`, so stops are listed latest first
  and the last has none) and says the first talk there that holds (so the last talk has none); the trace of every stop
  listed after that one lies on its level. Levels don't place NPCs: as a player enters a level the session works out
  the NPCs whose stop for them is there and the traces there (`placedOn`), keeps them (`session.placed`) and sends them
  in the `level` message's `npcs` and `traces` (`placeFor`), so two players can see an NPC in different places. They
  stay put until the player next enters a level, so an NPC who moves on mid-visit (a quest step done) is still there to
  say goodbye, by its old stop's talk, which follows the story at once; the next visit finds its trace. The lines stay
  on the server until someone talks. The client puts each NPC in its world as an actor of kind `"npc"` with an `Npc`
  holding its id, and each trace as an actor of kind `"trace"` (`ActorMirror.enter`); the walker draws an NPC like
  another player from its `NPC_LOOKS` entry (the chibi in its look, its name over its head) and every trace as a
  bedroll. Talking is Interact on one in view (`inView`, as a pile; `interactionAt` picks it when it's the nearest thing
  in reach: "talk" for an NPC, "look" for a trace, both sending `talk`); the session finds the NPC or trace of its own
  in view of its copy (`Overworld.inView`, with the slack) and answers `dialogue` with the NPC's id and its lines: an
  NPC's offer, if it stands (`dialogueOf`: a quest that can start; a handover on that quest's deliver step, with enough
  in the bag), and for a trace `trace: true`, its lines, no offer and no talk step done. `game.ts` opens the dialogue
  box (`ui.dialogue`, `ui/dialogue/Dialogue.tsx`) with the name and portrait from `NPC_LOOKS`, or for a trace "<name>'s
  bedroll" and no portrait. Its keys are a layer of their own (`dialogue`), so you stand still while it's open: Enter,
  the interact key or a click go on a line (all through `game.interact`), past the last one it closes, and Esc closes
  it; a change of mode closes it too. An offer shows with the last line, with Accept (or Hand over) and Not now; going
  on past the last line takes it (`UiState.nextLine` returns it, `game.takeOffer` sends it).
- **The core** (the rules in `shared/src/soul/core.ts`; [FORMULAS.md](FORMULAS.md#the-core) has the numbers): a
  player's progression, saved with them. The `GameSession` holds its `core` and works its `stats` out from it
  (`coreStats`); its setter puts the walking pace right (`overworldPace`: the burden and agility). A new core goes in
  through `takeCore`, which grows or trims the vitals (`grownVitals`) and sends `core`: on essence absorbed outside a
  fight (the shared use rule, `useItem` and its tick; in the arena after a win the fight follows, by the fight's own
  `takeCore`), on `statPoint` (placed outside fights, taken back only by a campfire, with the rest's slack) and on the
  admin's `coreStep`. HP comes back on its own on the session's tick outside a fight (`regen`, the fight's rule) and
  goes to the client in `state`. A fight's core comes back with its result (`Kept`): a death runs `coreAfterDeath` on
  it (the fill, or a step) and says what went (`coreLost`); a duel keeps what was absorbed and loses nothing. Every
  enemy drops its own essence (its drops in its file), an item whose `essence` effect is its worth.
  The HUD shows it on the back of the portrait card, bottom left in both modes (`ui/hud/CoreCard.tsx`, a click turns
  it): the soul as a smoky glass sphere with light growing from its centre, painted per pixel by `gfx/core/`, with no
  number or bar. Each step the light is brighter and, within a realm, bigger; each realm has its own colour and shape
  (`REALM_LOOKS`); it breathes, and sparks show from `SPARKS_FROM` of the step's fill. A breakthrough is told by `say`,
  and the card listens to `notifications.said` for it: it turns to the core, the light gathers, flashes (the new step
  showing from then), settles (`BREAKTHROUGH`) and turns back. In a fight it draws the fight's core (`ui.battle`).
- **Quests and the story** (`core/game/story.ts`, the one engine for quests and NPCs, which `talk.ts` uses; the data:
  `QUESTS` in `core/content/quests.ts`, `LORE` in `core/content/lore.ts`): a quest is a title, a half of the questbook
  (main or side), a condition to start (`when`, e.g. `{ done: "hollis-hides" }`) and named steps, each a `Task` (gather,
  deliver, reach, talk, kill), the questbook's text and hint, and its `reward` (items, story flags, lore ids). Quests
  hold no lines and name no giver: an NPC's talk offers them. Lore entries are one table by id. Each player's `Story`
  (on the `GameSession`, saved with the player) is the step each quest taken is on, by its id (null once done), the
  kills counted toward a kill step, and the flags set. One condition type, `When` (a flag, a quest on a step, a quest
  done, a quest that can start), is checked by `holds` for quests, stops and talk alike. One function changes a story,
  `unfold`: it applies the effects (`{ start }`: the first step; `{ advance }`: the step done, a deliver step taking its
  items from the bag or refusing if short; `{ finish }`, the admin's: every step left, a short handover taking
  nothing), then does every gather, reach or kill step the world already meets (`Seen`:
  the level, where you are, a won fight's enemies); talk and deliver steps wait for an NPC. Each step done gives its
  reward (what doesn't fit is `dropped`) and each change is told (`news`). It's pure over a story, a bag and a quest
  table (as are `holds`, `questbookOf`, `keptStory`, and `stopFor` and `dialogueOf` in `talk.ts`), so tests bring their
  own quests and NPCs. A talk does each talk step to that NPC once, and a fight's kills count only toward the step they
  began on. The session's side is `talkTo` in `talk.ts` (the dialogue as the story stood, then `{ advance }` for each
  talk step to that NPC), `takeQuest` (`acceptQuest`: only the quest the dialogue of the NPC in view offers) and
  `handOver` (`deliver`: only the handover it asks for), both through `progressStory`, which every tick on the overworld
  (and in the arena after a win) also checks gather and reach steps, and `settleBattle` calls with a win's enemies.
  Anything done or counted saves, leaves what didn't fit in a pile at the player's feet (`Overworld.dropPile`), sends
  `gear` if it changed and `questbook`: `questbookOf` (only taken quests, open ones first: the step on with its hint and
  a `Tally`, and the lore its done steps revealed) and the `news` (taken, a kill counted, a step done with what it
  gave). Death doesn't touch the story. The client keeps the questbook in `ui.questbook` and tells each piece of news
  with `say`; `QuestbookScreen` (`ui/screens/questbook/`) is a layer of its own (`questbook`, over either mode, like
  Settings: you stand still, the world goes on), opened by H (the general action `questbook`) or the HUD's book; H, Esc
  or × close it, and a change of mode does. An item step's tally is counted from the bag on the client (`tallyText`), a
  kill step's is the server's.
- **The arena after a win** (`core/game/battle.ts`): every `Battle` of a room shares its `ArenaDrops`: where the fight
  began (`home`), the piles lying in the arena with where (`ArenaPile`), and when it closes. As the room is won (its
  `onOver`), each enemy's drops are rolled once for the fight (`dropInArena`), whoever won, into a pile `DROP_GAP_M`
  beside where it fell, toward the arena's middle (`dropSpot`), and the arena closes `AFTER_FIGHT_MS` after the win (by
  the wall clock). A player's loss (down, leaving mid-fight or the time limit) puts all they lose into a pile where the
  server's fight has them (`dropWhereFell`), seen and opened only once the fight is won, as the enemy's; a room closed
  on a loss lands it at once. While a session is in it (`afterFight`), its tick follows its open pile, sends
  `arenaDrops` whenever the piles change (`arenaPiles` drops the emptied ones), and once the time is up leaves the arena
  for the player and sends `arenaClosed`. `openPile` there opens the pile the player is looking at
  (`arenaPileInView`: `inViewWithSlack` from where the server's fight has them, along the aim of the last input it
  ran), and `moveItem` works as on the overworld but for the cloth (none there); eating and writing a page work as
  outside a fight. Leaving (`leaveBattle`, a disconnect or the time) is `BattleRoom.leave`; the room's `onClosed` lands
  what's left at `home` as one pile (`landDrops`), its `PILE_LIFETIME_MS` starting then. The client:
  `battleResult`'s `afterFightMs` keeps `FightSync` sending and checking (only a result without it stops it),
  `ctx.drops` holds the arena's piles (drawn as the same sack), the HUD shows `The arena closes in m:ss` at the top and
  an "Open the pile" button (`dropInView`: `inView` along the camera's yaw, without the slack), Interact (E) sends
  `openPile` and opens the bag screen on the server's gear (as the overworld's, without the cloth), and Enter with drops
  still there opens the `leaveArena` popup (Enter again leaves, Esc stays).
- **The browser runs its own copy of the whole fight** (`modes/battle/`), built from the encounter's setup, so the boar
  reacts to you at once. Each frame its clock (`modes/battle/pace.ts`: real time since the fight's first step, plus an
  offset that keeps it in step with the server's) says how many steps are due, and `modes/battle/sync.ts` (`FightSync`)
  runs them with the keys' input, sends its changes, and on a hash mismatch loads the server's fight and replays
  (the bodies it moved are the frame's `corrections`, and their drawings ease over the jump; every step's events,
  replays included, are `sync.events`). (Babylon's own lockstep isn't used: it would catch up stalls a second time.)
  HP and hits show at once from the client's copy, but the result is only ever the server's: the banner waits for
  `battleResult`. After its steps the mode moves the camera's orbit (`modes/battle/camera.ts`: plain numbers, since
  its yaw is also the aim) and fills the HUD's store. The lock-on is the client's alone (`ctx.lock`, steered by
  `modes/battle/lock.ts` each step): it only changes the move and aim the input carries (toward the target), so the
  fight and the server don't know about it.
- **Fighters are moved by code, not by forces.** Systems set a body's velocity (`Body.vel`); the physics step
  (`fight/physics/move.ts`) adds gravity and moves each collider with Rapier's character controller, so the floor
  and the arena's ring of wall stop it and take the speed out. Bodies bumping into each other follow the fight's own
  rule: an enemy shoves a player along, a player never pushes an enemy (a player pinned against the wall holds it
  back), and dodging, knocked back or dead, a player passes through; anyone passes through a dead enemy. Rapier
  simulates nothing itself
  (`fight/physics/arena-physics.ts`): it sweeps, finds contacts and casts rays (`grounded`, the blob shadow).
- **The sword** (`fight/player/sword.ts`, `fight/weapons/`, numbers in `shared/src/weapons/hybrid.ts`): the player
  controller calls `readSword` every step and `attackOrBlock` when nothing else starts, each with a `SwordTurn`. A
  player aims a way (`Player.way`, the input's `way`, from mouse flicks) and swings light, heavy and stab strikes on the
  old momentum chains (`Wielder.combo`, `comboTime`, `momentum`), and holds a block (the `block` action, draining
  stamina in the controller), whose press raises the guard in a time by the blade's felt heft (`guardRaiseTime`) and
  opens a perfect block's window by its length (`perfectBlockTime`, `perfectBlockLeft`); pressed in a heavy's wind-up it
  feints instead (`readSword`, the `feint` event). A swordsman's brain is its `WeaponAttack`'s
  (`fight/behaviors/weapon.ts`): seeded chains of ways, a held block walking up, a perfect block it reads
  (`perfectBlockRead`) and the quick swing after it (`riposte`), and seeded feints of its heavies (`feint`).
- **Attacks are data.** An attack's active frames add an `ActiveHit` (an arc: range + angle, the attack's kind and,
  for a weapon, its way) to the attacker; `combatSystem` (`fight/combat.ts`) resolves hits with plain math, not
  physics. A weapon's hit is first asked of `parries` (`fight/weapons/parry.ts`): a swing meeting the target's own
  swing at a parry angle is deflected, deflects it or clashes, by whose blade went live first. Then of `defend`
  (`fight/weapons/defend.ts`): in front of the target, a weapon in its
  perfect block's window costs the attacker stamina and staggers it (`stagger`: a player's "stagger" action in
  hitstun, an enemy's "staggered" state); a held block stops it for a chip of damage and the blocker's stamina (an
  enemy's poise), the guard breaking when it runs out; a body blow is only blocked, pushing the defender back.
  Anything else lands.
- **Weapons are a system of their own, like skills.** The arsenal is in `shared/src/weapons/weapons.ts`: `WEAPONS`
  (each weapon by item id: its `kind`, the moveset it swings with, its length, damage, heft and minimum strength;
  `feltHeft` is the heft a wielder's strength feels, `canWield` whether it's enough). Equipping a weapon is refused
  below its minimum by the shared gear rules (`moveGear`), on the server, in a fight and in the bag screen alike.
  The sword's rules
  and numbers are in `shared/src/weapons/hybrid.ts`: the ways (`SWING_DIRS`, `WAYS`, `mirrorWay`), the chains and
  momentum (`CHAIN`, `MOMENTUM`), the strikes and the block (`HYBRID`), the hit shapes (`wayShape`: one reach from
  the wielder's own arm reach plus the weapon's length, the arc by line), and `wayStepsAfter`,
  `strikeDamage`, `strikeCost`, worked out from them, the weapon's heft and the wielder's strength. Fighters care
  only which weapon they hold. Anyone with a `Wielder` (what each hand holds, its arm reach and the swing under way)
  attacks with the weapon in hand: the player's controller and an enemy's weapon attack decide when, what and which
  way, and call `startWaySwing` (`fight/weapons/swing.ts`); `weaponSystem` then runs every swing the same way,
  raising its hitbox exactly while it's live. Ending an action or an enemy state (`enter`) ends its swing
  (`endSwing`). The visuals draw the blade from the swing's steps and its way.
- **Skills are inputs too, and any fighter's.** Every fighter is `Skilled` (`fight/skills/skilled.ts`): what it's
  chanting (`chanting`, `words`), the skill winding up (`casting`, `castTime`), a held Beam, where its skills go (`aim`,
  `target`) and its seed. Whoever drives it calls the same three things: `startCast` (a quick-cast, or a chant's
  release; one at a time), `chant(words)` and `releaseChant`; the player's controller does it from the input, a
  casting enemy's `skillAttackSystem` (`fight/behaviors/skill.ts`) from its own choices. A player's input carries a
  whole skill (`cast`) only on the step its key goes down, then just `castHeld` while the key stays down: the fight
  keeps the skill, so a long one isn't resent in every input; the chant's words come the same way, whole, on the step
  they change (`chantWords`). The controller
  winds a cast up as the "cast" action, `windUpSystem` counts any wind-up's time early in the step (so a sidestep sees
  it), and `skillSystem` (`fight/skills/cast.ts`) pays its stamina (if the caster has any) and fires it once the
  wind-up is over. Whatever lasts is a `SkillObject` entity (its `kind`: a Bolt flying
  by plain-math sweeps, not a physics body; a Beam ticking along its line, held while `castHeld` is; a lingering
  Nova's cloud; an Imbue waiting for the caster's sword hits, seen in the step's `hit` events; a Delay's wait); a
  Nova and Self go off at once; each segment fires when the one before it completes (`handOff`), once per Bolt. A
  Follow Bolt homes, at a limited turn rate, onto the caster's `target` (a player's is the input's `locked` enemy) or
  the nearest; split ones aim side by side beside it (`fanM`) until close. Split Bolts start in an upright circle round
  the caster and fly in to meet a point ahead (`splitBolts`; they climb or drop to it: `climbPerM`). A hit runs
  `strike` (`fight/skills/strike.ts`): every element's status on the target's `Statuses`, then the reactions, then
  the damage. `statusSystem` runs statuses down and burns. Statuses also change sword hits (Empowered, Cursed,
  Warded, the Light shield, Siphoning: `fight/skills/statuses.ts`). Every number is in `SKILL_EFFECTS`
  (`shared/src/skills/effects.ts`). The chant is a held input (`chant`) and the "chant" action, which holds the
  player still, with or without the skillbook; a skill on none of the player's pages (`book`, from the setup), or any
  skill with no book in hand, starts only from it. Writing a page (`write`, from the chant, book in hand) is the
  "write" action: after `SAVE_IN_FIGHT_TIME` the fight's `book` has it (a
  `pageWritten` event), and the server saves that book with the result. A stun breaks either off, and so does a
  dodge; it reopens only once the input is let go (`brokenOff`), and the client closes its popup when it sees that.
  A stun while chanting also loses the chant's words (a dodge keeps them), for any chanter: an enemy stunned,
  or staggered is broken off the same way (`cantCast`).
  The bag works the same way: the bag screen open in a fight is the held input `bag` and the "bag" action (held
  still, broken off by a stun or a dodge; a page can be written from it with the book in hand), and a move in it is
  the pressed input `gear` (a `GearMove`), run with the shared `moveGear` on the fight's `gear` (the bag and the
  equipment; no cloth). The `Wielder`'s hands follow the equipment, and the server settles the battle with the
  fight's gear (and its HP).
- **Shops** (`core/game/shop.ts`; their stock, what they buy and every price in `core/content/shops.ts`, server only):
  a keeper's talk offers `{ shop }`, and taking it (Trade, or going on past the last line) sends `openShop`; the session
  opens the shop of the NPC in view (`shopInView` in `talk.ts`), keeps its id in `GameSession.shop` and sends its
  `ShopView` (prices already worked out: the level's `PRICE_FACTOR`, the first purchase there cheaper until the player's
  `shopsBought` has it). The client shows it in the bag screen in place of the equipment (`ShopColumn.tsx`). `buy`,
  `sell` and `exchange` run on the gear: coins (`shared/src/items/coins.ts`, three items, 100 of one make one of the
  next) are paid off the cloth and then the bag, smallest first, the last coin's change in the fewest coins; what's
  got goes into the bag and what doesn't fit onto the cloth, or nothing happens. Coins are never packed up by
  themselves: changing them is `exchange`, one tier at a time. Each answer is a `trade` (the news, the gear, the
  shop). The shop closes with the bag (`closeBag`, walking, a fight starting, a new level).
- **An item kind is data made of components** (`ITEMS`, `shared/src/items/items.ts`): `consumable` (`verb`,
  `useTime`, `effects`) and `wearable` (`on`: the slot kind, and the use button's `verb` where it's worn). They aren't
  ECS entities: a bag holds counts of item ids per cell.
- **Using an item is one rule in both places** (`shared/src/items/using.ts`): `startUse` (a consumable whose effects
  would do something, so no healing at full HP), `stepUse` (its item's `useTime`, counted in `FIXED_DT` steps:
  `useSteps`) and `finishUse` (one used up, its effects applied). `applyEffects` is the one place an effect does
  something: a new kind of effect is one more `ItemEffect` member and one more case there. On the overworld and in
  the arena after a win, `GameSession.useItem` starts it and its tick steps it (sending `using`, then `itemUsed`;
  `closeBag` stops it). Mid-fight it's the pressed input `use` from the "bag" action: the "use" action (held still,
  dodgeable, broken off by a stun like the bag), stepped by `useSystem` (`fight/player/use.ts`), which runs after the
  step's hits and stops it on any hit, nothing used (a `used` event when it's done, which the client tells as
  `itemUsed`).
- **AI and animation are separate.** Enemy behavior systems (`fight/behaviors/`) only set state, facing, wanted
  movement and hitboxes (the motor turns that into velocity); each model's visual (client) reads the state and
  poses the model.
- **Input enters only as `PlayerInputData`** (world-space move + aim): from the keys in the browser, from
  `battleInput` on the server. Keys come from `client/src/settings/bindings.ts` as actions, never hardcoded.
- **Destroy is deferred** to `world.flush()` at the end of each tick; the drawing disposes an entity's meshes the
  next frame it doesn't find it.
- **The UI is React** (`client/src/ui/`, mounted into `#ui`), the HUD's bars included; the canvas and anything in
  the world (sprites, the boar, the sword trail) is Babylon. The game never touches the DOM: it writes plain values
  into stores (`ui/state.ts`, e.g. `ui.battle.set({ hpFraction })`), and components read them with
  `useStore(store, s => s.hpFraction)`.
  What the game says to the player goes through one call, `say(ui.notifications, event)` (`ui/notifications/`),
  e.g. `say(ui.notifications, { kind: "rested" })`. Its table, `EVENT_MESSAGES`, has an entry for every kind of
  `GameEvent` (a kind without one doesn't compile) with where it goes and its words: `"corner"` is a small notice
  in the bottom-right corner (loot, a full bag, dying, resting, eating), `"centre"` the big centre banner, kept for
  bigger events (only a fight starting so far; the arena's result banner is the fight's end).
  Writing every frame is fine: `Store.set` skips unchanged values, so a component re-renders only when the value it
  selected changes (select one primitive per `useStore` call). What the UI asks of the game (sign in, play, return
  to title) goes through `UiActions`, which `main.ts` provides.
- **Styling is Tailwind v4** (`@tailwindcss/vite`, no config file). Colours and fonts are `@theme` tokens in
  `client/src/ui/styles.css` (`bg-hp`, `text-victory`, `font-title`, ...), shared pieces are `@utility` classes
  (`bar`, `bar-layer`). Write each class name out in full (`"from-hp to-hp-dark"`, not `` `from-${bar}` ``),
  because Tailwind can't find names built from pieces; joining whole names (a long list over two strings) is
  fine. Motion comes with `motion-reduce:animate-none`.
- **Every screen sees the same amount, at most**: 16:9 (`shared/src/overworld/view.ts`).
  `client/index.html` puts the game in a frame that wide, so wider windows get bars on the sides and taller ones see
  a little less width. Every window fits that frame: the side panels (bag, shop, character) shrink to fit with
  `fitPanel` (`ui/hud/layout.ts`); the others (Settings, the questbook, the chant, the skillbook, admin) scroll
  once they reach their most height.

## Networking

The browser only ever talks to its own page's host: in dev, Vite on :5173 forwards `/ws` and `/api` to the server
on :8787; in production the server serves the built client itself (hosted, behind a Cloudflare Tunnel that brings
HTTPS and the socket to it as plain HTTP: README's "Hosting").

**HTTP** (`server/src/api/`, Fastify). Every error is `{ "error": "<a sentence the title screen can show>" }`.

| Route | Answers |
|---|---|
| `POST /api/register` `{username, password}` | 201 `AccountInfo` + login cookie; 409 if the name is taken |
| `POST /api/login` `{username, password}` | 200 `AccountInfo` + login cookie; 401 on a wrong name or password |
| `POST /api/logout` | 204, cookie cleared |
| `GET /api/me` | 200 `AccountInfo`; 401 if not logged in |
| `GET /api/servers` | 200 `GameServer[]`: name, socket, players online, `MAX_PLAYERS`; for now only this server |

Login and sign-up share 20 tries a minute per IP address (then 429; IPv6 by its /64). With `BEHIND_CLOUDFLARE`
(hosted, where the tunnel is the only way in) the address is Cloudflare's `CF-Connecting-IP` header, the visitor's;
without it the header is ignored, since anyone could send it. Bodies must be JSON (415 otherwise), at most
4 KB, and are checked by the shared Zod schemas in `shared/src/net/api-requests.ts`. The client makes every HTTP
call through `client/src/net/api.ts`.

**The game socket** (`/ws`). Opening one:

```
Browser                 api/routes/game-socket.ts       ws/sockets.ts             core/
  │── GET /ws + cookie ──►│ before the upgrade:            │                          │
  │                       │ accounts.forToken(cookie) ─────────────────────────────►  │
  │◄── HTTP 503 ──────────│ if the lookup threw            │                          │
  │◄── 101, open ─────────│ accept(ws, account) ──────────►│ new Connection(ws)       │
  │◄── close 4001 ─────────────────────────── no account ──│                          │
  │                       │                                │ online.join(conn) ──────►│ full: close 4002; else
  │                       │                                │                          │ closes the account's
  │                       │                                │                          │ other tab (4000), loads
  │◄── welcome ──────────────────────────────────────────────────────────────────────│ the save, new GameSession
```

While playing, each message goes ws (over 16 KB: close 1009) -> `Connection` (Zod check; dropped if invalid, more
than 20 invalid: close 1008) -> `ws/handlers.ts` (one call on the `GameSession` per message type) ->
`GameSession`, which answers with `link.send(...)`. `state` and `battleHash` aren't answers: the clock ticks every
level's overworld and then every session 60 times a second; on the overworld every 3rd tick sends a `state`, and in
a fight every 15th step of the server's fight a `battleHash`. A `ping` never reaches the session: `Connection`
answers it with a `pong` itself.

In the browser, one `Net` (`client/src/net/net.ts`) owns the socket. `Net.connect(socket)` opens a server's socket
(from the list: a path on the page's host, or a whole URL) and resolves with it and the `welcome`; `net.send(msg)`
sends; each part of the game subscribes to the messages it needs with `net.on(type, fn)`, which returns an
unsubscribe: the overworld to `level`, `state`, `encounter` and `gear`, the battle to `battleHash` and `battleSync`
from its start to its end, and `game.ts` to the rest. Messages that come before anyone listens
(the level, while the game still loads) are held and delivered, in order, once the first listeners are in.
`net.onLost(fn)` hears a dropped socket (with a sentence for the title), `net.onPing(fn)` the ping, and
`net.close()` hangs up quietly.

| Client -> server | When |
|---|---|
| `input {seq, moveX, moveZ}` | each tick while walking (nothing while standing still); replayed, rate-limited |
| `character` | made your character (ignored if you have one) |
| `rest` | Interact by a campfire (the server checks you're there) |
| `useItem {at}` | use the consumable in a bag or cloth cell `at` (`{in, x, y}`; not a pile's), on the overworld or in the arena after a win (mid-fight it's a `use` fight input); refused when it would do nothing (healing at full HP), while already using one, or for what isn't consumable |
| `moveItem {from, to, turned}` | moved what's at spot `from` (a bag, cloth or open pile's cell, or an equipment slot) to `to`: on a grid, its top-left there (overworld, or the arena after a win but for the cloth; shown at once; mid-fight it's a `gear` fight input, bag and slots only) |
| `closeBag` | the bag screen closed: what's on the cloth is lost, an open pile and an open shop close |
| `openShop` | Trade on a keeper's offer: open the shop of the NPC in view beside the bag |
| `buy {item}` | buy one of what the open shop sells, paid in coins from the cloth and the bag |
| `sell {at, count}` | sell `count` of the stack at a bag or cloth cell to the open shop, if it buys that |
| `exchange {from, to}` | change one coin for 100 of the next smaller, or 100 for one of the next bigger, at the open shop |
| `openPile` | Interact by a pile (on the overworld, or in the arena after a win): open the one in view beside the bag |
| `talk` | Interact (or the HUD's "Talk") facing an NPC: the server checks it's in reach and in view |
| `acceptQuest {quest}` | Accept (or going on past the last line) on a quest offer: only the quest the NPC in view offers |
| `deliver {quest}` | Hand over on a handover offer: only what the NPC in view asks that quest's step for, with enough in the bag |
| `saveSkill {page, skill}` | write a skill on a page of the skillbook, outside fights or after a win (mid-fight it's a `write` fight input); refused mid-battle, without the book in hand or with a word the player doesn't know |
| `battleInput {upTo, inputs}` | in a fight, once a frame: each change of input with its step (a cast carries its skill on its first step only, and the chant its words when they change, either dropped by the server if the player doesn't know its words; a gear move its two spots, a use its bag cell), and the last step run |
| `battleResync` | in a fight: your copy didn't match the server's hash; send the whole fight |
| `leaveBattle` | the Leave key after a fight's result (with drops still there, after the popup): out of the arena, back to the overworld (ignored mid-fight) |
| `settings` | a setting changed (debounced on the client) |
| `ping {id}` | every 2 s, for the HUD's ping |
| `challenge` | the Challenge key: duel the nearest player in reach |
| `answerChallenge {accept}` | Accept / Decline on a challenge to you |
| `joinBattle` | Interact or the HUD's "Join the fight" by a player in a battle |
| `chat {text}` | Enter in the chat: a line said (trimmed, not empty; the server stamps the name) |
| `statPoint {stat, add}` | the character panel's + / −: place a free point in a shown stat (outside fights), or take one back (by a campfire too); answered with `core` either way |
| `cheat {cheat}` | dev server only (production ignores it), from the admin panel (F1): `encounter` a fight against an enemy, `invulnerable` on / off, `give` an item and count, `heal`, `coreStep` up or down (overworld only), `completeQuest`, `resetSave` (overworld only; the socket is then closed with `saveReset` and the client joins again) |

| Server -> client | When |
|---|---|
| `welcome` | after joining: HP / stamina, the core (the client works the stats out from it), settings, character (or null), wins, gear, known words, skillbook, the last 50 chat lines, the questbook, `dev` |
| `character` | your character, as saved |
| `level` | entering a level: its layout (what the client may see of it, with the NPCs standing there for you) and where you are |
| `state` | 20 a second in the overworld: `ack` (last input replayed), your position and HP (it comes back on its own), nearby actors, other players (a player's character only the first time) and piles |
| `encounter` | a fight starts: its `setup` (arena, enemy, your HP / stamina, stats, burden, what you wield, your pages) and your `seat` in it; joining a fight under way, `joined` (the host's name and the fight as it was) |
| `battleHash` | 4 a second in a fight: the server's fight's hash after `step`, and how late your inputs come |
| `battleSync` | the whole fight after `step`: on `battleResync`, and as the fight is decided (before the result) |
| `battleInputs` | with other players in the fight: their changes of input as the server ran them, each tick it ran any (and before a hash) |
| `battleJoined` | another player came into your fight: their `PlayerSetup` (a `battleSync` with them in it follows) |
| `joinRefused` | `joinBattle` refused: nobody near is fighting, the fight is full, or it's a duel |
| `challengeNews` | a duel challenge sent, received, declined, expired, called off, or refused (nobody near, busy) |
| `battleResult` | as the fight is decided (still in the arena): won?, wins, HP / stamina, `lost` (what a death dropped), gear, skillbook, the core and `coreLost` (a death's: the fill, a step or nothing), `afterFightMs` (how long the arena stays open for its drops; null if it's over for you); after a duel, `duel` (the opponent's name) |
| `arenaDrops` | after a win, the piles lying in the arena (id, x, z in metres), each time they change |
| `arenaClosed` | the arena's `AFTER_FIGHT_MS` ran out: you're back on the overworld |
| `using` | `useItem` started using what's at `at` (its `useTime`, then `itemUsed`), or `at` null: it stopped, nothing used (the bag closed, a fight started) |
| `rested`, `itemUsed` | what resting or eating (or absorbing) did |
| `core` | the core changed outside a fight (essence absorbed, a point placed or taken back, the admin's step), or a point was refused: the core, HP / stamina, and whether it broke through |
| `dialogue` | after a `talk`: the NPC's id, what it says, and an offer (a quest to take, or a handover) or null; `trace` if it's what the NPC left behind |
| `questbook` | whenever the story changes: the questbook (`QuestView`s) and the news (a quest taken, a kill counted, a step done with what it gave) |
| `healed`, `given`, `invulnerable`, `noQuest` | what a cheat did (dev): vitals refilled, items packed (and how many didn't fit), invulnerability now on or off, no quest left to complete |
| `gear` | your bag, cloth, open pile and equipment after a `moveItem` (allowed or not), `openPile`, when the cloth is left behind, or when the open pile changes (another player took from it) or goes |
| `skillbook` | the skillbook's pages after a `saveSkill` (written or not) |
| `chat` | a line said by anyone online: `line` (the speaker's name, the text) and `speaker` (`"you"`, their id among `state`'s players if on your level, or null) |
| `chatRefused` | your `chat` was dropped: `tooFast` or `tooLong` |
| `shop` | the shop opened (its name, stock and prices, what it buys and for how much), or null: it closed |
| `trade` | the answer to `buy`, `sell` or `exchange`: what happened (or why not), the gear, and the shop's prices now |
| `pong {id}` | the answer to `ping {id}` |

Close codes the client handles: 4001 not logged in (login form), 4000 the account is playing in another tab, 4002
the server is full (`MAX_PLAYERS` are on; a player already on it may still take over from another tab) (`CLOSE_CODES`
in `shared/src/net/server-messages.ts`), 1011 loading the save failed (try again); 1008 and 1009 end in "connection
lost"; 4003 a dev cheat reset the save (the client goes back through the title and joins again). A welcome that
doesn't come within `CONNECT_TIMEOUT_MS` (`client/src/net/net.ts`) counts as unreachable.
Positions in `state` are rounded to 1 cm, and it only carries actors and players within
`VIEW_RADIUS_TILES` of the server's copy of you (a circle, as the camera may look any way), so a hacked client can't
see further.

**A fight on the wire.** Both sides number the fight's steps from 1. Each frame the client sends the changes of its
input since the last message, each tagged with the step it's for and rounded to 3 decimals (so both sides run the same
numbers), and `upTo`, the last step its copy has run; with nothing new, `upTo` alone every 3 steps
(`INPUT_HEARTBEAT_STEPS`). The server checks each message (`battleInput`'s Zod schema: steps in order and not after
`upTo`, the aim a direction, the move no longer than two keys make) and runs every input on its own step: up to
`MAX_INPUT_DELAY` (0.2 s, `MAX_INPUT_DELAY_STEPS` = 12) late it waits, later it runs it on its next step, presses kept,
and one early (a client briefly ahead, as after a ping spike) it keeps for its own step, up to `MAX_INPUT_LEAD_TIME`
(0.5 s, `MAX_INPUT_LEAD_STEPS` = 30) ahead of its clock; further ahead it drops, so a client can't run ahead of real
time (late changes are folded as they come, so at most one a step waits). A step run without the player's input holds
what they held; after `SILENT_STOP_STEPS` of those in a row, their move keys let go. After every `HASH_EVERY_STEPS`-th
step (15: 4 a second) it sends `battleHash`: the step, the hash of its fight there (`Fight.hash`: the whole state, every
number rounded to 2 decimals, so last-bit differences between machines don't count until they grow), and how late the
player's inputs come (`lateSteps`: `pace.ts` moves the client's clock ahead when they come late and back when they come
early, less what the client caused itself). The client compares it with its own hash at that step (kept for 1 s; a hash
for a step it hasn't run yet waits until it has), and on a mismatch sends `battleResync` once (for a hash too far ahead
of it, once it runs again: a stalled tab asks once, not on every hash); the server answers with
`battleSync`, its whole fight (`FightSnapshot`, about 1.5 KB of exact JSON) at its own step, at most every 5 steps
(`MIN_SYNC_GAP_STEPS`); the client loads it and replays its inputs since (or, behind it, jumps there). That's about 0.45
KB/s down for one player against one boar; up, about 7 KB/s while the aim changes every step (the camera turning, or
locked on to a moving enemy), a fraction of that while it doesn't. There's no message that says how a fight ended: only
the server's fight decides it, and its final `battleSync` and `battleResult` say so.

With other players in the fight (a duel, or a battle joined), the server passes each one's changes of input, as it ran
them, to the others (`battleInputs`), every tick it ran a step and before every hash. A client runs another player as
repeating what they last did until their real input comes; then, if it changed on a step already run, it loads its own
copy as it was before that step (`FightSync` keeps one after every step for a second, in a fight with others) and
replays to where it was. Too far back for that, it asks for the server's fight. Your own character never waits; another
may jump a little on your screen (the drawings ease over it, as after a `battleSync`).

**A simulated ping (dev only).** A dev server delays every game socket's messages by half of `DEV_PING_MS` each way
(`.env`, any whole number of ms, 50 if left out), in order, the close included (`ws/delay.ts`), so the netcode can be
felt on localhost. A page can ask for another with `?ping=N` (the client passes it on to `/ws`; anything but a whole
number of ms gets the `.env`'s). Production never delays.

**Chat.** One chat for the whole server (`core/game/chat.ts`, one `Chat` in `OnlinePlayers`, in memory only): a
`chat` from a player with a character is checked against `MAX_CHAT_CHARS` and their rate (`MAX_CHAT_LINES_PER_WINDOW`
in `CHAT_WINDOW_MS`), stamped with their character's name, kept in the last `CHAT_HISTORY_LINES` and sent to every
session online, each told who the speaker is to them (`speaker`). A line dropped is a `chatRefused` to its sender
only. `welcome` carries the last `CHAT_LINES_ON_JOIN`. In the browser, `game.ts` keeps the log (`ui.chat`, the last
`CHAT_LOG_LINES`) and `ui/chat/Chat.tsx` shows it; the overworld mode puts a `Speech` on the speaker's walker (you,
or the peer by `speaker`) for `SPEECH_TIME`, which `visuals/overworld/walker.ts` draws as a bubble over the head (and
name). In a fight it's the log only.

**The HUD's ping.** `Net` sends a `ping` every 2 s (`client/src/net/ping.ts`) and reports the average of the last 4
round trips to `net.onPing`, which puts it in `ui.ping`; `ui/hud/Ping.tsx` shows it in both HUDs unless Show ping
(`settings.hud`) is off. The `pong` is delayed like everything else, so `?ping=200` reads about 200.

## Saving

What's kept between connections is a `PlayerSave` (`core/ports.ts`): HP / stamina, wins, settings, character, bag,
equipment (items gone from the game or in the wrong slot are dropped on load), the skill words they know
(`knownWords`), the skillbook's 4 pages (`skillbook`, each a skill or null) and the story (`story`, one `jsonb`: the
quests taken and their steps by id, kills counted, flags), keyed by account; words not in the shared `WORDS` are
dropped on load, and so is a page that's no longer a skill of known words, and a quest gone from `QUESTS` or on a step
it no longer has (`keptStory`: forgotten, so it's offered again). The `GameSession` saves after every fight (the
moment it's decided, or lost by leaving it), rest, item use, quest progress and making a character, on disconnect,
and within a second of a settings change, a move in the bag, a trade or a page written. The shops where the first,
cheaper, purchase is made are saved (`shops_bought`; unknown ids dropped on load). The cloth and an open
pile are never saved, and nor are the overworld's piles (a restart loses them).
The level is saved (`level`), and you come back to it at its start; position isn't saved. The core is (`core_steps`,
`core_fill`, `stat_points`; `keptCore` makes a saved one right on load), and the stats come from it, so they aren't.
A new character starts on `START_LEVEL`, the kingdom (Highmere), and a death saves it as your level (the session's
`wakeOnPad`; you cross to it as you leave the arena); a save made before levels were saved was moved to the
Grass Field by a migration (`0015_players-keep-their-level`), so nobody already playing was moved. Saves from before
the core start at Early Yan, empty (`0016_core`).

Postgres is reached through Drizzle (`server/src/db/schema.ts`). The server applies new migrations when it starts;
`npm run db:generate` writes them (see "A schema change" below).

## Tests

`npm test` runs every `*.test.ts` under `shared/test/`, `server/test/` and `client/test/` with Node's test runner
(`tsx --test`); no test framework, database or browser. Each `test/` folder mirrors its `src/` and has a tsconfig
of its own (Node's types), checked by `npm run typecheck`. New work is written test-first (see AGENTS.md).

- **shared**: the ECS, math, walking, the view rules, every Zod schema, the stats' formulas and the core's rules
  (`soul/core.test.ts`: the ladder and its names, each step's fill, absorbing with breakthroughs and the rest carried,
  a whole core, each step's gains and points, placing and taking back, what a death takes, a saved core made right),
  essence absorbed (`items/using.test.ts`), and the arena fight run headless with
  enemies whose numbers the tests own (`shared/test/battle/fight/fixtures.ts`): the same inputs give the same fight
  byte for byte, gravity and the floor, the wall, shoving and passing through (a dead enemy by anyone), knockback,
  each way's reach and
  shape by line (`combat.test.ts`), the sword (`player/sword.test.ts`: aimed ways, the momentum chains, the reverse
  quickest, damage building, lost to a gap, a dodge or a block, spent by a stab; the heavy; each strike's stamina),
  the defences (`weapons/defend.test.ts`: the held block, any way in front, stamina and the chip, a heavy's double
  cost, running out breaking it, its slow drain, not the back; the perfect block, in the window, the attacker's lost
  stamina and recoil, getting in first, too early, mashing; no parry by a swing; the guard rising by heft and the
  window by blade length), the swordsman
  (`behaviors/weapon.test.ts` and `kobold.test.ts`: ways never twice running, its block costing poise, its perfect
  block and the swing after, chains by its seed and through a save, its landed hits only hurting), whole
  fights won and lost,
  the time limit and leaving (down only mid-fight, gone from the arena either way, through a save), which pile is in
  view (`inView`), a walker's heading
  (`faceToward`), a fight's whole state
  (exact through JSON; loaded into a new fight, or one that went its own way, it plays on step for step the same, live
  hitboxes included), its hash (the same for the same inputs, changed by anything that matters, not by a last-bit
  difference), a dodge's i-frames step by step (a dodge on the very step a hit lands beats it; its stamina and burden
  costs), and a dodge pressed during an attack waiting for its blade (on any step of it, once, ahead of a buffered
  attack, through a save and a rollback). Skills (`shared/test/battle/fight/skills/`): the wind-up, its cost at release,
  waiting behind a swing, cancelled by a dodge or a hit; the chant (held still, broken off by a stun or a dodge but
  not a sword hit, the only way to cast a skill on no page, needing no book; its words in the fight: kept by a dodge,
  lost to a stun or a release); an enemy that chants word by word, releases, quick-casts and is broken off by a stun
  (`skilled.test.ts`) and writing a page in it (its time, standing still,
  cancelled by a stun or closing, through a save); Bolt, Nova and Self; chains (from a hit, at full range, at
  the wall, a Bolt after a Nova); a Bolt through a save and the hash; each element's damage, status and resistance;
  the four reactions, their order and cooldowns; Self per element (sword hits included); an invulnerable player
  taking no damage, its flag in the state and hash. A duel (`duel.test.ts`, and the sword's defences above): hits and
  Bolts player against player, the lock, and how it ends. `weapons/hybrid.test.ts` for the ways' rules. Eating in a
  fight (`player/use.test.ts`): healed and one
  used up once its `useTime` is up, held still, not at full HP or with the bag shut, stopped (nothing eaten) by
  closing the bag, a dodge, a hit that only hurts or one that stuns, and through a save; and the shared rule
  (`items/using.test.ts`, any consumable's time and effects coming from its item). The core in a fight
  (`player/absorb.test.ts`: essence absorbed in its time, held still, stopped by a hit with the essence kept, a
  breakthrough growing the stats and bars at once, a whole core refusing it, through a save) and the stats it gives
  (`core-stats.test.ts`: defense and special defense, toughness on a blow's stun and an enemy's stagger, stamina
  recovery, agility, HP regen and its pause, a burn pausing it). Each fight test file awaits `initPhysics()` first.
  Also the battle inputs' rounding and what counts as a change.
- **server core**, through its ports: `server/test/fixtures/` has a `FakeLink` (records what a player was sent and
  how the link was closed), a `MemoryPlayerStore` and a `MemoryAccountStore`, plus `TEST_LEVEL`, a level whose
  numbers the tests own. Joining, a second tab, saving, the overworld's input replay and encounters, resting, items
  (eating taking its `useTime`, stopped by closing the bag, walking or a fight; mid-fight only as the fight's input),
  accounts and passwords are all tested without a database or a socket, and so are battles: the server deciding a
  win from the player's inputs alone, a loss emptying the bag, leaving mid-fight (or a second tab) losing it, the
  time limit, the room against a client's copy (`server/test/fixtures/fight.ts`: a `FakeClient` and an in-order wire
  that can hold messages back): waiting for the first input, each input on its own step hash for hash, never past
  its clock, waiting for a late input up to `MAX_INPUT_DELAY_STEPS` and running a later one on its next step,
  keeping early inputs for their own steps and dropping ones too far ahead, a silent client's fight going on (and
  still lost at the time limit), lateness,
  `battleSync` on asking and as it's decided; dodging a bite k steps before it lands, on time, 150 ms late and too
  late, with the same hit or miss and HP on both sides; blocking (or perfect-blocking) the Kobold's attack the same way;
  the Kobold as tuned, its old wind-ups, beaten by a player who perfect-blocks and punishes whatever its seed, beating
  one who only holds a block or only swings (`enemies/kobold-swordsman.test.ts`); a cast or a page written
  with a word the player doesn't know dropped (and chant words), a skill on none of the pages cast only from a chant,
  chanting without the book; the skillbook (pages written, refused for
  an unknown word, without the book in hand or mid-battle; a page written in the fight saved with its result, kept
  through a death); and the input timeline (changes held, late presses and casts kept, a late change and an on-time
  one in one message, too far ahead dropped, a silent player stopping, lateness, the latest of late chant words
  kept).
  The dev cheats: each ignored in production, and invulnerability and a heal mid-fight reaching the fight and the
  client; completing the current quest (main first, its rewards, clicks walking the main story); resetting the save
  (a new player's with the character and settings, nothing saved over it, joining again at the start). The core
  (`soul.test.ts`): in `welcome` and a fight's setup, saved; essence absorbed on the overworld (told,
  saved, a breakthrough growing the vitals, not into a whole core), in a fight and kept after a win, and in the arena
  after a win with the fight following; free points (placed while any are left, taken back only by a campfire, not in
  a battle); HP regen on the overworld and in `state`; a death losing the fill or a step (leaving mid-fight too); the
  admin's step up and down. Every enemy dropping its own essence (`enemies/index.test.ts`), and a spar costing the core
  nothing (`duels.test.ts`). Duels: a challenge's reach, one per player, declining, expiring and being called off;
  the duel's fight (one step a tick from two sessions, inputs passed on), a spar's result, and forfeiting by leaving.
  Joining a battle:
  reach and its slack, duels and full rooms refused, each player's own result (one down settled at once, a win for
  everyone still in it), a joiner leaving, the enemy kept until the room is over. Chat: every line to everyone online
  (other levels, a fight, a player still making a character), the speaker's name stamped and who they are to each,
  none from a player without a character, the history kept to its cap, the last lines in `welcome`, the length and
  rate limits (each player's own) told to the sender only, nothing kept past a restart. Piles: packed with nothing
  overlapping, the one a player faces found (in reach and round from their heading, each with its slack), sent within
  the view's radius, vanishing after `PILE_LIFETIME_MS` or once empty; a walker's heading turned by its inputs as the
  client's is; opening one (in reach and looked at, not one behind or off to the side, the one nearest the way they
  face, not mid-fight), taking from it into the bag, nothing put onto it or taken from one not
  opened, closing it (the bag, walking, a fight, its vanishing), and two players at one pile (each seeing the other's
  take, the same item going to the first). NPCs (`talk.test.ts`, `npcs/index.test.ts`): sent with the level their stop
  is on for the player and not another, talking to one in reach and looked at (each with its slack, the way they last
  walked), not on another level, not mid-fight, with no step to it sending only its lines and changing nothing; with
  NPCs the test owns, the stop it stands at, the traces of the stops it's moved on from (not of one it's yet to reach)
  and the talk said there, offers only while they stand; each real one always standing somewhere (its last stop
  unconditional, every stop on a level) with something to say there (its last talk unconditional), its traces with
  lines and none at its first stop, all clear of solid tiles, and one by the start level's fire for a new player.
  Shops (`shops.test.ts`): each keeper and the money changer offering trade, opened only with the keeper in view,
  the capital's prices with the first purchase cheaper once (saved), coins paid smallest first and never packed up,
  change in the fewest coins, what doesn't fit on the cloth or nothing bought, too little money, only the stock sold
  and only what a shop deals in bought, coins changed a tier at a time at any shop, and the
  shop closing with the bag or on walking. Coins (`shared/test/items/coins.test.ts`): their worth, prices written out,
  the fewest coins, changing rates, the money in some grids.
  Hollis moving on (`npcs/hollis.test.ts`): at the fire until his chain is done, then in the Mistwood with his trace at
  the fire; done mid-visit, still at the fire saying goodbye until the player comes back; his trace read with
  Interact (`trace: true`, no offer, no step to him done); his Mistwood quest, through Ilse and back. The story engine
  (`story.test.ts`, with quests the tests own): each condition, `start` and `advance` (told, rewards given once each,
  what doesn't fit dropped, a deliver step's items taken or refused), each kind of step the world meets (gather kept,
  reach on the level and in its area, kills of that kind counted across fights but not from before the step, one fight
  doing one step, what's already true the next, talk and deliver waiting), nothing done giving the same objects, the
  questbook (only taken quests, open first, tallies, lore from done steps), and what a save keeps (`keptStory`).
  Hollis's quests through the session (`quests.test.ts`, numbers read from `QUESTS`): the offer after his lines,
  accepting (told and saved; only from him in reach and in view, only what he offers, not mid-fight), gathering on the
  tick, the handover (the items gone, the reward in, the next quest offered; refused with too few, for another quest or
  out of reach), a reward that doesn't fit left at your feet, won fights counting kills (told each time), the talk step
  (his lines for it, flags and lore), the story kept on death, and the questbook in `welcome`. The Waking Hollow's
  quests (`waking-hollow.test.ts`): its chain is the main quest, each waiting on the one before; the native by the
  fire offers the first; walked through the session (a boar fight, the meat handed
  over, then Hollis on the Grass Field, who offers his own first quest), each revealing a lore entry of its own; and
  after it, both natives offering a side quest. The Grass Field's and the Mistwood's natives (`natives.test.ts`):
  each past the Hollow, offering a new character a side chain that waits on nothing else, each chain played step by
  step through the session (gather, hand over, reach, win, talk: each done, its reward and lore told), their lines
  for each talk step and after, and lore no other quest reveals. The story's data
  (`content/quests.test.ts`, `content/lore.test.ts`): step ids unique, real items, enemies, NPCs and levels, a quest
  waiting only on one listed earlier, every condition naming real quests, steps and flags, every quest offered by
  someone and revealing a lore entry, a talk step's NPC with lines for it and a deliver step's asking for it, every
  lore entry revealed. The
  arena after a win
  (`arena-drops.test.ts`, and the room's and the joined battle's tests): the room running on for the winners (their
  inputs and hashes, no second result), leaving it no loss, freed when the last leaves, a loss or a duel freed at once,
  a decided fight not joinable; the drops beside the fallen enemy and not on the overworld, one roll for the fight
  however many won, `arenaDrops` as they change,
  opening it in reach of the server's fight and in front of its aim (each with its slack) and not mid-fight, a winner
  or a disconnecting joiner leaving gone from the others' fight at once, taking from it (saved soon, the last of it
  making it go), no cloth there but eating (the fight's HP following) and writing a page, leaving with what was
  taken, the leftovers landing at the fight's spot when the last winner leaves (their `PILE_LIFETIME_MS` from then),
  `AFTER_FIGHT_MS` sending them out (`arenaClosed`), and a disconnect there being no loss. Death drops
  (`death-drops.test.ts`): all from the bag and hands, alone landing at the fight's spot at once
  (a disconnect and the time limit alike, its `PILE_LIFETIME_MS` from then), with others fighting on lying where you
  fell, not openable mid-fight, then taken from after the win, the arena's piles landing as one, everyone down landing
  it all, and a duel dropping nothing. The training yard (`training.test.ts`): the herald sending a new avatar to
  Bram, the old stick given once (at once when the quest is taken from him), the dummy and spar fights started only
  from his talk, unjoinable, costing nothing won or lost, and moving the quest only when won.
- **server outlets**: `api/` with `buildServer()` and `app.inject()` / `app.injectWS()` (routes, cookies, error
  sentences, the rate limit (per visitor by `CF-Connecting-IP` behind Cloudflare, the header ignored otherwise),
  cache headers, the `/ws` login check and its `?ping=`); `ws/` with a fake WebSocket, the simulated ping included
  (each way half of it, in order, 0 for none, never in production); `env.ts`'s `DEV_PING_MS`, `SERVER_NAME`,
  `MAX_PLAYERS` and `BEHIND_CLOUDFLARE`; `/api/servers`; a full server refusing a new player; a `ping`
  answered with a `pong`. `db/` has no tests yet ([plan/tests.md](plan/tests.md)).
- **client**: only logic that runs without Babylon or the DOM: key bindings (a saved key keeps a new default off
  it), the keyboard (held, latched, text fields, the chat field's Enter, rebinding's raw key), where each key goes
  (the layer on top, each with its own keys; held keys read only there; / opening the chat and kept from the page,
  the chat holding everything but Enter and Esc) and who has them (the chat only while its field has focus), the
  chat log's cap, what the keys and buttons ask for (actions; the attack pressed last; the flicks' 7 ways, none down, no
  aim keys; the stab on K or the wheel, the block), the player's pose and blade (ways, aim, block), sword trail and
  cut, the
  boar's and the Kobold's poses, effects fired once per step and event,
  camera, mouse, HUD and combat settings, settings sync, when the mouse is captured, overworld prediction, what
  Interact does
  where you stand (the nearest in reach, a pile or an NPC only if you face it), the mirror (other players, piles, the
  level's NPCs), the dialogue (a line at a time, closing after the last, an offer taken by going past it; its keys
  over either mode), the questbook (H in either mode, H and Esc only over it, a saved H keeping it unbound; its step
  tallies), quest news' and a breakthrough's words, what a death's notice says the core lost, the fight's
  sync (only changes sent,
  with their steps and heartbeats; the whole fight run at once; hashes checked, now or once it gets there; one resync
  asked, the server's fight loaded and replayed to where the server gets, or jumped to; a dodge neither replayed twice
  nor dropped; another player's inputs coming late rolled back and replayed; every step's events reported, a
  replayed step's again; the result and its banner waiting for the
  server; after a win that keeps the arena open, still sending and checking), the leave popup's keys (the leave key
  again leaves, Esc stays) and pace (real time's steps, catching up after a stall, a backlog dropped, ahead when late
  and back when early, lateness it caused itself not made up twice, a stall's silence not taken for lateness, old news
  ignored), the title's sequence timing, the ping (its average, stale
  pongs) and its readout, character creation's steps and rows, the chant's carousel (what the next square takes, known
  words only, why one doesn't fit, the search, a kind then its word by number (a shut kind's number and a word that
  doesn't fit doing nothing), Backspace out of a kind or off the last word, words into a skill and
  back), the core's sphere (`gfx/core.test.ts`: brighter every step, bigger every step of a realm, each realm's colour,
  sparks only near a breakthrough, a breakthrough showing the old step until its flash), the bag screen's mouse
  (bagMouse.ts: hover, select, drag
  between the bag, the cloth and the slots and from an open pile, turn, use) and tooltip (itemInfo.ts), the item
  pictures' sizes, and the
  look's pictures (each view's size: the portrait, the chibi facing each way, the battle sprite in each pose from
  behind and the front, the sword in the hand that holds it, or left out, the face only from the front; the chibi's
  legs standing together in two boots, the right one in shadow), the side of a player the camera sees (and keeps
  side-on), and the player's frames painted (the chibi at once, the back's one per slice, a front frame only when
  first shown) and where their sword hand is.
  The sound (`client/test/audio/`): every file in the table and none spare, a variant never played twice running and its
  spread, where a sound is heard from (full near, silent far, quieter between, panned to its side of where the ears
  face) and the volumes mixed, the nearest water; in a fight (a real `Fight`), each step event heard once and as what, a
  swing's whoosh once as its blade sets off (lower and louder the heavier the blade, and for a heavy), wind-ups, deaths,
  dodges, jumps and landings, steps every stride on the arena's ground, a Bolt's cast, loop and impact (split ones one
  loop; none for one a reload remade), the result once, a new fight forgetting the last; on the overworld, the ears,
  campfires, the
  nearest water, footsteps for players only, and a jump not taken for a walk; the volume settings saved and read back;
  the music's files all there and used, and which track plays on the title, each level and each arena, and none once a
  fight is decided.
  Rendering, how the fight feels, the React screens and what the sound sounds like are tried in a browser.

Time and chance are faked with node:test's mocks (`t.mock.timers`, `t.mock.method(Math, "random")`), and tests read
tuning numbers from the code, so retuning the game doesn't break them.

CI (`.github/workflows/ci.yml`, GitHub Actions) runs `npm run typecheck`, `npm test` and `npm run build` on
Node 26 for every pull request into `main` and every push to it. A PR is merged only once that check is green.

## Rules

- **The server decides; the client asks and draws.** Anything a player shouldn't be able to change lives on the
  server. Everything the client sends is checked against a Zod schema first.
- **The server is core plus outlets** (above). Game rules go in `core/`; anything that talks to the outside world
  goes in an outlet, behind a port.
- **Every player is logged in.** No guest play; `/ws` closes sockets without a login cookie before anything else.
- **Fights are server-authoritative.** The arena's `Fight` is shared code; the server runs it and decides hits,
  damage, stamina, deaths and the result. The client runs its own copy to show it at once, sends only its inputs
  (tagged with their steps) and takes the server's fight whenever the hashes differ. There's no message a client
  could claim a result with, and the result shows only when the server's comes; keep it that way.
- **Keys come from `client/src/settings/bindings.ts`, through `core/keyboard.ts`**, the page's only key listener.
  Game code asks about actions (`core/actions.ts`), the UI listens with `useAction`; neither sees key codes, and
  nothing else listens for keys. When showing a key on screen, read it from the bindings (`keyName`). Esc (the
  settings) and ⌘ can't be rebound.
- **Text is escaped by JSX**, so server or player strings can be rendered safely. No `innerHTML` or
  `dangerouslySetInnerHTML`.
- **Drawing has one owner, `client/src/visuals/`**, the only code that imports Babylon (`npm run typecheck` fails
  otherwise, and on a mode importing visuals/). It reads the modes' state each frame; game code never draws, and
  never hands state to drawing code.
- **Sound has one owner, `client/src/audio/`**, built the same way: it hears the modes' state each frame, and game
  code only calls it for what isn't state (a move in the bag). What plays where is plain, tested data (`SOUNDS`,
  `MUSIC`); only `audio/audio.ts` touches Web Audio. Every file is CC0 and listed in SOUNDS.md.
- **Small, single-purpose files** (roughly under 200 lines). Add a folder per new mode, enemy or screen rather than
  growing an existing file. Small math (clamping, smoothing, distances, turning) goes in `shared/src/core/math.ts`.

## Folders and files

**Names.** The map you walk is the **overworld** everywhere (shared `overworld/`, server `core/overworld/`, client
`modes/overworld/`, `Overworld*` components, mode `"overworld"`); the fight is a **battle** (client folder, mode),
and the place it happens is the **arena**. The tower's places are the **world** (shared `world/`, server
`core/world/`, client `visuals/levels/` and `visuals/arenas/`): the tower has floors, a floor has levels, and a level
names the arena its fights happen in. React components are PascalCase `.tsx` files that export components only
(so Vite Fast Refresh works); game code stays `.ts` and imports nothing from React. Numbers with a unit say it in the
name (`MAX_BODY_BYTES`).

**Top level.**

| | |
|---|---|
| `README.md` | a short description, the finished features, how to run it, the top-level folders |
| `ARCHITECTURE.md` | this file |
| `SOUNDS.md` | every sound and music file: its pack, author and licence (all CC0) |
| `FORMULAS.md` | every calculation that decides how the game plays, with where its numbers live and worked examples |
| `AGENTS.md` | how to work in this repo: ask before game mechanics, decisions so far, checks, git and PRs |
| `plan/` | future plans and parked ideas, one file each |
| `package.json` | the workspaces and every `npm run` script (the workspaces have only their own dev / build) |
| `compose.yaml` | the dev database: Postgres 17 in Docker, on 127.0.0.1 |
| `compose.prod.yaml` | hosting (README's "Hosting"): the server's image and Postgres 17, the server on the host's 127.0.0.1:8787 for a Cloudflare Tunnel, `BEHIND_CLOUDFLARE` on |
| `Dockerfile`, `.dockerignore` | the server's image: builds the client, then runs the server as `npm start` does (production, as the `node` user) |
| `.env.example` | local settings (database, ports) with working dev values; `.env` is the git-ignored copy (hosting reads it too) |
| `tsconfig.base.json` | strict TypeScript settings every workspace extends |

```
shared/src/      Code client AND server run. No Babylon, no DOM (its tsconfig has no DOM lib).
  index.ts         Re-exports everything but the fight (import from "@infinite-tower/shared")
  core/            ecs.ts (World, components, queries, deferred destroy), components.ts (LocalPlayer),
                   math.ts (Vec2/3, clamp, smoothstep, approach, damp, distXZ, wrapAngle, turnToward, seededRandom,
                   nextRandom),
                   time.ts (FIXED_DT, toSteps)
  world/           The tower's places. layout.ts (LevelMap: what the client may see of a level, its floor, tile
                   map and campfires; LevelLayout: a LevelMap as one player is sent it, with the NPCs standing there
                   for them (PlacedNpc, by NpcId from NPC_IDS) and the traces left there; moveWalker, the one
                   collision rule, and
                   stepWalker on it for
                   prediction + replay; nearCampfire / REST_RANGE_TILES, JOIN_RANGE_TILES; Heading, START_HEADING,
                   HEADING_WAY and faceToward: the way a walker faces, turned by its moves on both sides), interact.ts
                   (INTERACT_RANGE_M and INTERACT_LOOK_RAD, the reach to a pile or an NPC and how far round from the
                   way you face, on the overworld and in an arena alike; inView, the one in view), tiles.ts
                   (TILES: each tile kind's
                   character and rules, solid or tall grass; tileAt, isSolid, inTallGrass, mapHalfSize), arena.ts
                   (ArenaDef: an arena's id, radius and ArenaLook, sent in each encounter's FightSetup), day.ts (the
                   time of day from the wall clock, the same everywhere with no messages: DayClock, dayFraction,
                   retimeDay; sunAt and moonAt, their arcs. Drawing only: nothing in a fight reads it)
  overworld/       view.ts (VIEW: a screen's widest shape, 16:9)
  battle/          components.ts (Player, Wielder and its swing, Health, Stamina, Statuses, Body, Fighter, ActiveHit,
                   SkillObject, Enemy, LungeAttack, ChargeAttack, WeaponAttack, SkillAttack),
                   player.ts (PLAYER tuning, Vitals, GRAVITY), defs.ts (ENEMY_IDS; EnemyDef = body + stats +
                   optional attacks), input.ts (PlayerInput; StepInput, a change of input on the wire,
                   with its step; IDLE_INPUT, copyInput, sameInput, quantizeInput), netcode.ts (what both sides
                   agree on: HASH_EVERY_STEPS, MAX_INPUT_DELAY, MAX_INPUT_LEAD_TIME), stats.ts (Stats: the shown
                   and hidden ones, BASE_STATS, FighterStats; what each does: physicalDamage, skillDamage,
                   moveSpeed, maxHpOf, staminaMaxOf, the defenses' taken factors, stunTime, staminaRegenPerSec,
                   hpRegenPerSec, carryLimit; grownVitals)
  soul/            core.ts (the core: REALMS, STEP_NAMES, CORE; CoreState (steps done, fill, points placed),
                   newCore, fillToFinish, coreName, coreStats, absorb, placePoint, takeBackPoint, pointsEarned /
                   pointsLeft, coreAfterDeath, coreAtStep, keptCore)
    fight/           The arena fight, "@infinite-tower/shared/fight" (index.ts; Rapier comes with it).
                     fight.ts (Fight: its own world and physics, the system order, step(inputs), steps, save /
                     load / hash, join(player) and leave(player) (gone from the arena; down mid-fight), outcome,
                     events, dispose; the enemy motor and
                     player ground systems), setup.ts (FightSetup, the one-on-one and DUEL_STARTS
                     starting spots, joinStart (where a joiner comes in), spawning players and enemies:
                     components + a collider, one component per attack in the def, a Wielder for whoever holds
                     things), context.ts (FightContext,
                     FightOutcome, FightEvent), combat.ts (addHit,
                     hits in an arc, the weapon's defence asked first, stagger, knockback, the hit timers),
                     outcome.ts (won /
                     lost; MAX_FIGHT_TIME, LEAVING_LOSES, playerResult), state.ts (FightSnapshot: the whole state,
                     exactly, out and back in; saveFight, loadFight; hashFight: its fingerprint, numbers rounded
                     to 2 decimals)
      physics/         init.ts (initPhysics: load Rapier once), arena-physics.ts (ArenaPhysics: the floor and the
                       ring of wall, a collider per fighter, sweeps with the character controller, contacts, rays),
                       move.ts (gravity, moving every body, who shoves whom and who passes through)
      player/          controller.ts (move, jump, the sword, dodge, a cast's
                       wind-up, the chant (held still; a skill on no page cast only from it), the bag (held still;
                       gear moved; eating started) and writing a page, stamina; controlPlayer; no sword in hand,
                       no attacks or block; no skillbook, no quick-casts or pages), sword.ts (SwordTurn; readSword: the
                       aimed way, presses buffered, the perfect block's window, a heavy's feint; attackOrBlock: light
                       / heavy / stab
                       on the old momentum chains, the held block), use.ts (useSystem: a consumable used
                       once its useTime is up, stopped by a hit; takeCore: a new core's gains into the fighter at once)
      skills/          cast.ts (skillSystem: casts released and paid for, segments fired in turn and their modifiers,
                       the skill objects (Bolts, Beams, clouds, Imbues, Delays) stepped, a page written once
                       SAVE_IN_FIGHT_TIME is up; imbueOf),
                       skilled.ts (any fighter's skills: startCast, chant, releaseChant, endCast, interrupt,
                       cantCast, windUpSystem), strike.ts (a stage hitting a target: statuses, reactions, damage;
                       foesNear), statuses.ts
                       (statusSystem; hurt, by the damage's kind and the target's defenses; regenSystem; what statuses
                       do to damage dealt and taken, healing, walking speed)
      behaviors/       What enemies do; each enemy is a mix of them. brain.ts (target, approach (or keeping away) /
                       poise / stagger / stun / death), lunge.ts, charge.ts, weapon.ts (the Kobold's brain: seeded
                       chains of ways or a stab, never the same twice running, a block held walking up, a read
                       perfect block and the swing after it, seeded feints of its heavies), skill.ts (casting: a
                       quick-cast
                       up close, a chant a word at a time from farther, backing away while it chants if kept away,
                       seeded extra modifiers, stamina like a player's; the warlock's), sidestep.ts (stepping aside from
                       a Bolt winding up at it), common.ts (enter, roll: the enemy's seeded random numbers)
      weapons/         swing.ts (weaponSystem: every wielder's swing run alike, its hitbox up while live;
                       startWaySwing, endSwing, endChain, bladeLive; handsOf), defend.ts (defend: the perfect
                       block, the held block and its stamina or poise; blocking, facingOf), parry.ts (parries: a
                       swing parried by a swing, or two clashing; the recoil by the swings' weights)
  character/       character.ts (Character = name + gender + look; LOOK_OPTIONS: every look part's option ids,
                   drawn by client/src/gfx/look/; GENDERS (boy / girl: how the game refers to you, nothing else);
                   name rules)
  items/           items.ts (ITEMS: name, description, size in cells, stack size, weight, and its components:
                   consumable, wearable; each monster's essence, absorbed in ABSORB_TIME; ItemCounts = item id ->
                   count), bag.ts (Bag: a grid of placed stacks;
                   fits, addItem, moveItem, takeOne, takeItems, bagWeight, bagProblems: the rules both sides fit
                   items by),
                   gear.ts (Gear: the bag, the cloth (CLOTH), an open pile (NO_PILE for none) and the Equipment
                   slots; Spot, UseSpot, moveGear between them (nothing onto a pile), gearWeight without the cloth
                   or pile, heldIn), burden.ts (BURDEN, gearBurden: light / heavy / overloaded, and what each does
                   to walking and dodging), using.ts (startUse, stepUse, finishUse, applyEffects: a
                   consumable used from the bag, the same on the overworld and in a fight), coins.ts (COINS,
                   COIN_VALUE in copper, coinsFor: an amount in the fewest coins, formatPrice ("1g 20s 5c"),
                   exchangeRate, moneyIn)
  skills/          skill.ts (a skill as data: segments of a Form, elements and modifiers; FORMS, ELEMENTS, OPPOSITE,
                   MODIFIER_FITS, WORDS (all of them); validateWord / validateSkill: why a word is refused, for the builder
                   and the server's check; skillCost, releaseTime; SKILL: their numbers; SKILLBOOK_PAGES, Skillbook,
                   blankSkillbook, SAVE_IN_FIGHT_TIME, sameSkill; wordKind, NEXT_WORDS, skillOf / wordsOf: words in
                   the order they're chanted <-> a skill), effects.ts (SKILL_EFFECTS: what skills
                   do in a fight, every number; STATUSES, REACTIONS; shotOf: a segment's modifiers
                   applied in order)
  weapons/         weapons.ts (WEAPONS, the arsenal by item id, each of a WEAPON_KINDS kind, with its heft and
                   minStrength; feltHeft, canWield, weaponIn, weaponItemIn; AttackKind, AttackSteps, HitShape), hybrid.ts (the sword's: SWING_DIRS and WAYS (the
                   stab), STRIKES, mirrorWay, SCREEN_DIR; chainKind, CHAIN, MOMENTUM; HYBRID (light, heavy, stab,
                   the block and perfect block, the lunge); wayShape, wayStepsAfter, strikeCost, strikeDamage,
                   guardRaiseTime, perfectBlockTime)
  net/             client-messages.ts (Zod schemas + inferred ClientMsg, SkillSchema; server-only import),
                   server-messages.ts (ServerMsg types, ServerMsgOf<t>, the socket's CLOSE_CODES; ChatLine,
                   MAX_CHAT_CHARS; the questbook's QuestView, Tally, LoreEntry, QuestNews; DialogueOffer), handlers.ts
                   (Handlers<Msg> map + dispatch by `t`, the server's), api.ts (the HTTP API's types: username /
                   password rules, Credentials, AccountInfo, GameServer, ApiError), api-requests.ts (its Zod schemas;
                   server-only import), text-rules.ts (TextRules for the
                   username and character name, rulesHint), text-schema.ts (their Zod check; server-only),
                   settings.ts (MAX_KEYS_PER_ACTION, OVERWORLD_CAMERA_ANGLES)
shared/test/      Unit tests, mirroring src/ (npm test)

server/          Node. Authoritative: levels, encounters, overworld actors, enemy stats, fight results, saves.
  drizzle.config.ts  drizzle-kit's settings (where the schema and migrations are)
  scripts/         check-layers.ts (the hexagonal import rules; run by `npm run typecheck`)
  test/            Unit tests, mirroring src/ (core/game/helpers.ts: a started session, an NPC talked to, a fight
                   won at once). fixtures/: fakes.ts (FakeLink, MemoryPlayerStore,
                   MemoryAccountStore: core's ports in memory), level.ts (TEST_LEVEL, TEST_CHARACTER), fight.ts
                   (a BattleRoom against a FakeClient's copy of the fight, over a wire that can hold messages back)
  src/
    main.ts          The only file that sees everything: loads the fight's physics, builds db -> core -> api + ws,
                     plugs them together, runs the tick timer
    env.ts           DEV, PORT, DATABASE_URL, DEV_PING_MS, SERVER_NAME, MAX_PLAYERS, BEHIND_CLOUDFLARE from the
                     environment (loads the repo's .env if there is one; parseDevPing, parsePingMs, parseServerName,
                     parseMaxPlayers, parseBehindCloudflare)
    core/            The game. No sockets, HTTP, SQL or env.
      ports.ts         What core needs from outside, as interfaces: PlayerStore (+ PlayerSave), AccountStore,
                       PlayerLink
      game/            online.ts (who's playing: one session per account, load on join, save on leave, a second
                       tab takes over, a new player refused past maxPlayers; count; isOn (a left or replaced
                       session's late messages are dropped); one Overworld per level, made when its first player
                       arrives, stepped only while someone's on it), session.ts (GameSession, one player: their
                       save, their walker in their level's overworld (`me`), the battle they're in; a method per
                       thing a player can ask; disconnect: mid-fight, leaving it, and leaving the overworld;
                       nearestOtherSession, the nearest other player in reach; Others, what a session sees of the
                       rest; the pile they have open, followed every tick; their `story`; the NPCs and traces
                       `placed` on their level as they entered it; `talk`, `acceptQuest`,
                       `deliver` (talk.ts); in the arena
                       after a win (`afterFight`):
                       the drops sent as they change, and sent out when it closes; LAG_SLACK_TILES),
                       cheats.ts (runCheat: the dev cheats; in a fight they edit the room's fight),
                       chat.ts (Chat: the server's chat, in memory: its history, each player's rate, every line to
                       everyone online; CHAT_HISTORY_LINES, CHAT_LINES_ON_JOIN, MAX_CHAT_LINES_PER_WINDOW,
                       CHAT_WINDOW_MS),
                       duels.ts (Duels: challenges, their reach, expiry and news; starting a duel; settling a
                       spar; CHALLENGE_RANGE_TILES, CHALLENGE_TIME),
                       battle.ts (start a battle in a BattleRoom with the bag and what's worn, or join one (fighterOf:
                       a player as the fight takes them; seatInBattle: a session put in a room and sent its
                       `encounter`; both a duel's too), settle its end for the player: the gear as the fight left
                       it, wins, a loss dropping all they carry where they fell (dropWhereFell), vitals; the arena
                       after a win: ArenaDrops (shared by the room), the drops rolled once as the room is won
                       (dropInArena, dropSpot), arenaPiles, arenaPileInView, landDrops (what's left, as one pile);
                       AFTER_FIGHT_MS, DROP_GAP_M), training.ts (startTraining: a spar from an NPC's talk, at
                       TRAINING_YIELD_SHARE, nobody joining, nothing lost or gained but the story),
                       snapshot.ts (the state message: only actors, other players and piles within
                       VIEW_RADIUS_TILES, each player's character sent once),
                       story.ts (the story engine, for quests and NPCs: Story, newStory; When and holds; Effect,
                       Seen and unfold; stepOn; questbookOf; keptStory; progressStory, the session's side),
                       talk.ts (NPCs over the engine: stopFor, placedOn, dialogueOf; the session's side:
                       placeFor, talkTo, takeQuest, handOver, shopInView),
                       shop.ts (shopView: a shop's stock and prices for a player; openShop, buy, sell, exchange:
                       paying, change and what doesn't fit going to the cloth),
                       clock.ts (FixedClock: 60 Hz steps, catching up after stalls)
      battle/          The fight, run by the server. room.ts (BattleRoom: its clock, waits for everyone's first
                       input, runs each step once it has everyone's input or it's MAX_INPUT_DELAY late, sends
                       battleHash and battleSync, ends and frees it (after a win, once the last winner leaves the
                       arena; RoomHooks: onOver, onClosed); `leave` sends the rest the fight with the leaver gone;
                       `edit` changes a player's fighter between steps and sends
                       everyone the fight; join seats a player in a fight under way, settle gives each player their
                       own result; MAX_START_WAIT_TIME, MIN_SYNC_GAP_STEPS, MAX_BATTLE_PLAYERS),
                       inputs.ts (InputTimeline: one player's changes of input by step, what's known, late ones
                       on the next step, early ones kept for theirs, too far ahead dropped, a silent player let
                       go; SILENT_STOP_STEPS)
      overworld/       The overworld simulation. overworld.ts (Overworld: one level's world, shared by its players:
                       join / leave, startEncounter (marks them fighting, takes the touched actor), endFight, the
                       systems and spawner; dropPile, holdPile / landPile (an arena's), pileInView and inView
                       (the one a player faces; inView among the NPCs and traces placed for that player),
                       pileItems, setPileItems), components.ts
                       (OverworldPos, OverworldActor, OverworldPlayer: a player's walk, heading, character and
                       whether they're fighting; Pile), piles.ts (packPile, pileSystem; PILE_LIFETIME_MS, PILE_COLS),
                       interact.ts (inViewWithSlack, the shared inView with INTERACT_LAG_SLACK_M and
                       INTERACT_LOOK_SLACK_RAD: the overworld's piles and NPCs, and an arena's piles),
                       parts.ts (spawnActor from behavior
                       parts), context.ts (OverworldContext, what systems get), player.ts (input queue + replay
                       turning the heading with faceToward, grass encounters per player, nearestHuntablePlayer),
                       spawner.ts (each spawn an enemy's overworld actor; one taken into a fight comes back
                       respawnTime after it's decided)
        behaviors/       wander, chase (notice -> "!" -> chase), touch (encounter on touch), move (moveWalker)
      world/           The tower: floors, their levels and the arenas fights happen in. level.ts (LevelDef:
                       layout (a LevelMap: no NPCs), spawn point, spawns (each may name its own arenaId), encounter
                       table, arenaId, duelArenaId, exits (ExitDef: edge tiles that take you to another level, and
                       where you land); rollEnemy), index.ts (LEVELS and ARENAS by id, START_LEVEL (the kingdom,
                       where new characters and the dead wake), levelOrStart, getLevel, getArena); kingdom.ts (Highmere,
                       on no floor: the summoning hall, the courtyard, the market and the gate to the Grass Field)
        floors/1/        Floor 1's levels, a file each: waking-hollow.ts, grass-field.ts, mistwood.ts (tile map,
                         campfires, spawns, exits), and arenas.ts (the floor's ArenaDefs)
      enemies/         One file per enemy, by its EnemyId: wild-boar.ts, kobold-swordsman.ts, kobold-greatsword.ts
                       (the swordsman with a greatsword), goblin-warlock.ts, training-dummy.ts and bram.ts (the
                       training yard's, fought only as spars: no drops, no overworld actor) (its EnemyDef, its drops,
                       its overworld actor's behavior parts). index.ts (ENEMIES, one line each; rollDrops)
      npcs/            One file per NPC, by its NpcId: hollis.ts, maren.ts, tobin.ts, corwin.ts, ilse.ts, herald.ts,
                       grocer.ts, apothecary.ts, smith.ts, changer.ts, bram.ts (its
                       stops: where it stands and what it says there, by the story, and what it leaves at one it
                       moves on from). index.ts (Npc, Stop, Talk, Trace; NPCS, one line each)
      content/         player.ts (PLAYER_STATS: Early Yan's; fullVitals, newPlayer: empty-handed),
                       quests.ts (QUESTS: every quest, by id; QuestDef, QuestStep, Task), lore.ts (LORE: every lore
                       entry, by id; LoreId), shops.ts (SHOPS: what each sells and buys; ITEM_VALUES in copper,
                       PRICE_FACTOR by level, SELL_SHARE, FIRST_PURCHASE_DISCOUNT)
      accounts/        accounts.ts (Accounts: sign-up, login check, login sessions; tokens hashed before they're
                       stored), passwords.ts (scrypt)
    ws/              Outlet: the game socket. sockets.ts (takes each /ws socket api/ opened, with its account;
                     joins the player, drops messages once it's no longer on; the connection's simulated
                     ping), connection.ts (one socket = the
                     PlayerLink: Zod-checked in, typed out, delayed both ways by a dev ping), delay.ts (DelayLine:
                     a FIFO that holds each message for a while, in order), handlers.ts (each ClientMsg -> one call
                     on the session; connection.ts answers `ping` itself)
    api/             Outlet: HTTP, on Fastify. server.ts (builds the app: plugins, JSON-only bodies, the built
                     client from client/dist, with hashed assets/ cached for good; /api/servers), cookies.ts (the
                     httpOnly login cookie), errors.ts (every error as `{error}` with a sentence the title screen
                     can show)
      routes/          One Fastify plugin per file, each registered in server.ts. accounts.ts (accountRoutes:
                       the /api handlers; login + sign-up rate-limited), game-socket.ts (gameSocketRoute, /ws:
                       checks the login cookie before the upgrade, then hands the socket on)
    db/              Outlet: Postgres. schema.ts (the tables, in TypeScript: Drizzle ORM), db.ts (connects to
                     DATABASE_URL, applies new migrations at startup), player-store.ts / account-store.ts (the
                     two stores core asks for; one query at a time per player), migrations/ (SQL written by
                     `npm run db:generate`, plus drizzle-kit's meta/), seed.ts (dev data: accounts test1-3,
                     password = username; refuses to run in production)

client/          Browser game: the two modes, their drawing (Babylon), input, React UI.
  index.html       The page: the 16:9 stage frame, the canvas, #ui
  vite.config.ts   Dev server :5173, proxies /ws and /api to the game server
  test/            Unit tests of the logic that runs without Babylon or the DOM, mirroring src/
  src/
    main.ts          Bootstrap: make the keyboard, mouse and Actions, mount the UI (title screen), ask who's logged
                     in, start preparing the game;
                     logging in (or Play) connects, then joins; Return to title (or a lost connection) leaves
    game/            start.ts (its own lazily loaded chunk with Babylon and Rapier: prepareGame() loads the
                     physics and builds the modes, the drawing (createDrawing: the engine and both scenes) and
                     the sound (createAudio) once, behind the title, and returns the Game),
                     game.ts (Game: join() starts a session on a connection, leave() ends it; subscribes to
                     the server messages no mode owns, keeps the settings in sync, runs the frame loop (the
                     mode's update, then `drawing.frame` and `audio.frame`), overworld <-> battle switching, who
                     has the keys, the character from `welcome` / `character`, opening creation without one;
                     tells the player what happened with `say`; the known words and pages from the server; the fight
                     breaking off the chant; `saveSkill` as the fight's `write` in a battle; the chat log and
                     `sendChat`),
                     transition.ts (Mode,
                     flash / fade), debug.ts (the dev handles on `window`, `cast(skill)` among them)
    net/             net.ts (Net, the game socket: connect, send, `on(type)` with an unsubscribe, onLost, onPing,
                     close; passes on the page's `?ping=`; holds messages until the first listeners), api.ts (every
                     HTTP call: who's logged in, log in, register, log out, the server list), ping.ts
                     (startPinging: Net's ping, every 2 s)
    core/            keyboard.ts (the page's one key listener: held and latched keys, each keydown raw to Actions;
                     text fields keep their keys but the arrows, Esc, the digits and Backspace, and Enter where
                     it sends; captureKey for rebinding), mouse.ts (optional,
                     pointer lock: on a click in the arena, or by itself as the arena starts wanting the mouse when
                     auto lock is on; shouldAutoLock is that rule; buttons as "Mouse0"…, read from pointer events
                     since Babylon's scene cancels pointerdown, which stops mousedown), buttons.ts (held +
                     latched presses, counted in order), actions.ts (Actions: the bindings turned around, key ->
                     action, general's plus the place's; the layer stack, `on` for listeners, `poll` for the top
                     layer's held and pressed actions and its axes, the flicks read from the mouse's movement
                     (`FLICK`; `FLICKS`, the 8-way aim), `lookDelta` for the arena's mouse
                     movement, and when the mouse may lock)
    settings/        settings.ts (Settings: every kind of setting in one object; main.ts makes it once and passes
                     it to the game and the UI; `welcome` restores the player's, syncSettings sends each change
                     back), bindings.ts (ACTIONS: every action in general, overworld or battle, label, default keys,
                     fixed mouse buttons and the wheel; MENUS:
                     the title's, creation's, the bag's, the chant's, the
                     skillbook's, the chat's, the dialogue's and the questbook's fixed keys; KeyBindings:
                     the player's keys; keys saved where they used to be,
                     MOVED_FROM, load where they are now; a new default on
                     a saved key is left unbound), camera.ts (CameraSettings: sensitivity, the
                     overworld camera's quarter turns), mouse.ts
                     (MouseSettings: auto lock, on by default, so a save without it reads as on; flick
                     sensitivity, FLICK_SENSITIVITY), hud.ts
                     (HudSettings: show ping, the same way), audio.ts (AudioSettings: the master, effects,
                     ambient and music volumes, 0 to 1 on the slider's step, each saved only if changed)
    gfx/             Pictures drawn in code onto plain pixels, no Babylon (the UI uses them too)
      core/            The core as a sphere (the HUD's card): light.ts (REALM_LOOKS: each realm's glyph, glass smoke,
                       glow, colour ramps, halo and light shape; coreLight: the light's size and brightness by step;
                       nearness and sparksPerSec, from SPARKS_FROM; the noise), sphere.ts (CoreSphere: the core shown,
                       a breakthrough's gather, flash and settle, the sparks, and paint into SPHERE_PX² RGBA pixels)
      items/           items.ts (drawItem: each item's picture for the bag, 16 pixels a cell, in the same pixel
                       kit as look/)
      look/            Character art (ART.md is the style guide): a look drawn as a 64x64 portrait (creation, the
                       character panel, dialogue, the HUD's card), a 32x32 chibi facing front, back or side (the
                       world) and a 64x64 battle sprite from behind and the front in each pose (the arena), in
                       code. art.ts (VIEWS, CHIBI_FACINGS, BATTLE_FACINGS, layers, Frame, render), pixels.ts (Pen,
                       masks), palette.ts (ramps), body.ts (body types), battle.ts (POSES, SWORD_POSES, the front as
                       the back mirrored, leftHanded, frontHead), moves.ts (the sword fight's frames),
                       head.ts (face shapes), face.ts (eye and mouth types), hair/ (styles), outfit.ts + jerkin.ts
                       (wear), sword.ts, look.ts (Look -> picture: drawPortrait, drawChibi, drawBattle, with or
                       without the sword; battleBody, a pose's frame for a hand)
    dev/             art-lab.ts: localhost:5173/art.html (dev server only) draws every look option as the portrait,
                     the chibi facing each way and the battle sprite in each pose and frame, from behind and the
                     front, in either hand, to check art
    ui/              React: everything drawn over the canvas
      mount.tsx        createRoot + <App>; App.tsx picks the HUD for the mode, then the chat, the dialogue, notices,
                       banner, the fade between modes (game/transition.ts sets it), the questbook, Settings, character
                       creation, title
                       screen (the HUD, the chat and Settings only once `inWorld` and not creating; creation as soon as
                       a game runs without a character, under the title)
      state.ts         UiState: the stores the game writes (title, screen, overworld HUD, battle HUD, ping, skills:
                       the known words and the book's pages; bars are `...Fraction`, 0..1), `notifications`
                       (notifications/), `settingsScreen`, `creation`, `overworldPanel` (which side panel is open, its width on screen),
                       `chant`, `battleBag`, `leaveArena`, `skillbookScreen`, `admin`, `challenge`, `chat` (open,
                       focused, and the log: hearChat keeps the last CHAT_LOG_LINES), `dialogue` (who's talking,
                       their lines and the one shown, the offer: openDialogue, nextLine (past the last line, the offer
                       to take), closeDialogue) and `questbook` (open, the server's quests: toggleQuestbook,
                       closeQuestbook) (the UI writes them too,
                       the game watches them;
                       `whoHasTheKeys`: the layer stack, the top one gets the keys), and UiActions (what the UI asks
                       of the game: signIn, logOut, play, interact, leaveArena, challenge, answerChallenge, useItem,
                       moveItem, castSkill, saveSkill, sendChat, takeOffer, saveCharacter, returnToTitle, cheat,
                       setDayClock, statPoint).
                       No React.
      store.ts         Store<T> (set skips unchanged values); useStore.ts reads one value in a component
      keyNames.ts      KeyboardEvent.code / mouse button -> printable name
      styles.css       Tailwind v4 entry + @theme tokens
      components/      Used by more than one screen: Bar.tsx (HUD bar + souls-style damage chip),
                       PlayerBars.tsx (HP + stamina, in the same corner on both HUDs), styles.ts (BUTTON,
                       TEXT_INPUT), noFocus.ts (buttons a click can't focus, so Space / Enter stay with the game),
                       useAction.ts (a component listening for actions), LookPicture.tsx (a look on a canvas: the
                       portrait, or the chibi facing front)
      hud/             OverworldHud.tsx (HP / stamina, wins, level name, ping, the buttons, the panel and Interact
                       keys, the challenge key and a challenge's Accept / Decline notice), InteractButton.tsx (the
                       button by a campfire, a fight, a pile, an NPC or a trace, in both HUDs: "Rest by the fire" /
                       "Join the fight" / "Open the pile" / "Talk" / "Look"),
                       BattleHud.tsx (the bag in a fight:
                       the fight's gear, no cloth, eating as a fight input;
                       the book over it; after a win the server's gear with the drops' pile, the arena's countdown, Interact and
                       the leave popup), HudLayer.tsx (the layer both draw in), CoreCard.tsx (bottom left in both
                       modes, under the chat: your portrait and name, turned by a click, or on a breakthrough for its
                       moment, to your core, gfx/core/'s sphere painted at most 30 times a second while it shows, and
                       the realm and step), character/ (CharacterPanel.tsx: the
                       portrait, the core's realm and step, the shown stats as a polygon chart, each one's number
                       between − (only by a campfire) and + for free points, hovering them previewing the change and
                       what the stat does; chart.ts: chartPoints, the polygon's corners for any number of stats, and
                       chartMax, its rim: the most a stat could be at the step), inventory/ (the bag screen:
                       InventoryPanel.tsx lays out the equipment (or an open shop: ShopColumn.tsx, its stock, your
                       coins and changing them), an open pile over the cloth, and the bag, in a row (in a window taller
                       than it's wide, the pile and the cloth below the other two), wires the
                       mouse and the bag keys, and shows the selected item (with Sell when a shop buys it), the
                       dragged ghost and the tooltip;
                       BagGrid.tsx draws a grid (the bag, the cloth or a pile) and its
                       hovered / selected / landing states, EquipmentSlots.tsx the slots; bagMouse.ts holds those
                       states as plain data, itemInfo.ts the tooltip's lines, grid.ts the cell and slot sizes),
                       PanelFrame.tsx (the side panels'
                       box: it measures itself and shrinks to fit the view), layout.ts (fitPanel: where a side panel
                       goes and how far it shrinks to stay on screen and clear of the status block and the core card;
                       stacksGrids; useStageSize; the core card's and the Rest button's place, which the notices
                       keep clear of), icons.tsx (the HUD buttons' icons), Ping.tsx (both HUDs' ping)
      chat/            Chat.tsx (the chat, bottom left in both modes, above the core card: the log's last lines,
                       or, open, all of it and the field it's typed in; / opens it or focuses it again, Enter sends,
                       Esc closes; unfocused, the field is dimmed with "Press / to chat", the key read from the
                       bindings)
      dialogue/        Dialogue.tsx (an NPC talking, bottom centre over the Interact button: its portrait, name and
                       the line, and with the last line an offer: Accept or Hand over, and Not now; Enter or a click
                       goes on, Esc closes), keys.ts (withKeys: a line's `{group.action}` written out as the
                       player's own key)
      skills/          chant.ts (ChantState with the kind being picked from; the carousel's rules: what the next
                       square takes, `choices` with why a known word doesn't fit, KINDS and kindOpen, `numbered` and
                       pickNumber (a kind, then its word, or a search's match), addWord, `back`, skillText),
                       SkillBuilder.tsx (the squares sliding left, the word search, a column per kind with its
                       words, the number and Backspace keys), ChantPopup.tsx (the fight's chant: open / close, cast,
                       a page written, shown while the fight writes it; the fight breaks it off, through game.ts),
                       SkillbookScreen.tsx (the book in hand, over the bag: its 4 pages, written at once), Hotbar.tsx
                       (the pages on the battle HUD with their keys)
      notifications/   What the player is told, and where. say.ts (`say(to, event)`; `GameEvent`, what happened;
                       `EVENT_MESSAGES`, one entry per kind of event: where it goes, "centre" or "corner", and its
                       lines), battleResult.ts (what a `battleResult` says: what dropped, died / lost,
                       refused), state.ts (Notifications, UiState's `notifications`: the notices' and the banner's
                       stores, `said` (the last event told, for the sound), notify / announce / dismiss / clear,
                       MAX_NOTICES), Notices.tsx (the corner: newest
                       at the bottom, at most 5 showing, wrapping at 20rem, about 8 s each, beside an open side panel
                       and above the Rest button), Announcement.tsx (the centre banner: one at a time, wraps in the
                       middle 80%, no ×: it fades on its own), useFadeOut.ts (hold, fade, dismiss)
      screens/         One folder per full-screen page, holding the parts only that page uses
        title/           TitleScreen.tsx (login form, or the server list, Play / Retry and Log out; status line, the
                         sequence's layers), LoginForm.tsx, ServerList.tsx (name and players / cap, or Full),
                         MenuButton.tsx (the big "◆ Play"), styles.ts, sequence.ts (the enter / leave sequences'
                         stages and timing), useSequence.ts (the stage for the title's phase)
          backdrop/        The title's low-poly scene on a 2D canvas: Backdrop.tsx (the scene + light shafts, motes,
                         grain, vignette), Scene.tsx (canvas, frame loop), draw.ts (painter's order, glow layer),
                         world.ts (tiles, tower, its shadow, crystals), light.ts (moon, the tower's own light,
                         glint, rim, fog into dark / light, tone map), path.ts (the camera through the sequence),
                         space.ts
        questbook/       QuestbookScreen.tsx (the questbook over either mode: the main quest and side quests side
                         by side, each quest's step, hint and tally, or done, and the lore it revealed; J, Esc or ×
                         close it), tally.ts (tallyText: a step's "1 / 3", items counted in the bag)
        admin/           AdminPanel.tsx (dev only, F1 toggles, Esc closes: the cheats, a core step up or down among
                         them; the time of day and its speed set through `setDayClock`), admin.ts (its times, speeds and
                         counts)
        settings/        SettingsScreen.tsx (Esc toggles, Show ping, Return to title), CameraSection.tsx
                         (camera and flick sensitivity, Auto mouse lock), AudioSection.tsx (the four volume
                         sliders), KeyBindingsList.tsx (rebinding), styles.ts (a setting's row)
        creation/        A new player making their character, on white: CreationScreen.tsx (the scene: the System's
                         greeting, the panel beside the portrait and chibi, "Is this you?", saving, the farewell,
                         the white clearing off the world), scene.ts (its steps, a pure reducer), lines.ts (what
                         the System says), LookMaker.tsx (the panel), options.ts (its rows), SystemWindow.tsx,
                         useTyped.ts (text typed out), styles.ts (dark on white)
    modes/           The two game modes: game logic only, no Babylon (visuals/ draws them)
      overworld/       The overworld mode: mirrors the server
        overworld.ts     The mode: its state (the level, the actors, the camera's turns), level loads, the walk keys
                         (turned to the camera) and the camera's turn keys, server state, the overworld HUD;
                         interactionAt: the Interact key rests, joins a fight, or opens the pile, talks to the NPC
                         or looks at the trace you face (inView along your heading), the nearest in reach; the
                         heading back to START_HEADING on a `level`;
                         a chat line's Speech on its speaker (SPEECH_TIME)
        prediction.ts    Predict your own walking (and heading), reconcile with the server's acks
        water.ts         waterMap: each water tile's flow, width, depth and banks from the level's tiles, for the
                         drawing and the sound alike (WATER_DEPTH_TILES); only water that runs off the map (touches
                         its edge, or the woods joined to it, in two places) flows, bridges joining a river's pieces;
                         its tiles split into running and still; tested
        facing.ts        The shared Heading (north / east / south / west, on the map) and Facing (up / right / down /
                         left, on screen): mapMove (walk keys to a move on the map), facingOnScreen, mirrorFor;
                         the camera's tilt (CAMERA_PITCH, tiltCamera)
        mirror.ts        Mirror the server's actors, each with its kind, other players (peers) and piles, and the
                         level's NPCs and traces (enter); entityOf
        components.ts    OverworldPos, OverworldActor (its kind: the player, a peer, a boar, a Kobold, a goblin, a
                         pile, an NPC, a trace), Peer (another player's character, fighting), Npc (which NPC, by
                         its id),
                         Speech (a chat line over a walker's head, and how long it has left), OverworldState
      battle/          The 2.5D arena mode: your own copy of the whole fight, run at once and kept in line
        battle.ts        The mode: start / end a fight (the fight's copy from the encounter's setup), per frame the
                         fight's steps (as many as pace.ts says) and the inputs out (1-4 quick-cast the fight's pages, the
                         chant held open, a page to write), the fight's pages into the HUD, hashes, syncs and the
                         result in; each frame's events and corrections
        sync.ts          FightSync: runs the fight with your inputs, sends their changes with their steps, checks the
                         server's hashes, loads its fight and replays on a mismatch; other players' inputs as the
                         server relays them (until then they repeat their last), going back to the first step one
                         changed and replaying; a player joining (onJoined); every step's events (`events`,
                         replays included); the server's outcome; stats (INPUT_HEARTBEAT_STEPS, HISTORY_STEPS)
        fired.ts         FiredEffects: a frame's step events not yet taken, so a replayed step's events go off once
                         (the drawing's effects and the sound alike)
        pace.ts          Pace: the fight's clock, steps due each frame, in step with the server's (PACE_SLACK_STEPS,
                         MAX_STEPS_PER_FRAME, MAX_BACKLOG_STEPS)
        context.ts       BattleContext (the fight, its sync, its outcome as the server says, after a win the arena's
                         time and drops, the lock, the camera's view, this frame's events and corrections, the
                         skills waiting to be cast), resultShown, AFTER_FIGHT_BANNER_TIME
        camera.ts        The camera's orbit, locked or not, in plain numbers (ArenaView: yaw, pitch, eye, at): its
                         yaw is the aim
        lock.ts          The lock-on: steerLock (lock / unlock / lock closest / retarget by screen side, off when the
                         target dies), lockYaw (the way to face it), no Babylon: tested
        input.ts         A poll -> PlayerInputData (the attack is the last pressed; the way from the last flick, none
                         straight down; a block pressed or held)
        hud.ts           Fills the battle HUD's store, stunned, the skillbook in hand and an arena pile in view
                         included
    audio/           All the sound (Web Audio). audio.ts (createAudio: the AudioContext, made on a user gesture;
                     loading every file; plays each frame's cues and keeps its loops going, placed and mixed; the
                     page's button clicks, the events told and `play` for the bag; MAX_VOICES; the music, a track
                     at a time, crossfaded, MUSIC_FADE_TIME), music.ts (TRACKS: each track's volume; MUSIC: which
                     plays on the title, each level theme and each arena look; musicFor), sounds.ts (SOUNDS:
                     each sound's files, volume, rate, spread, bus, loop, reach; `take`, a variant other than the
                     last; ENEMY_SOUNDS, ELEMENT_SOUNDS, STEP_SOUNDS (each arena look's ground), ARENA_AMBIENCE,
                     RUNNING_WATER_SOUND, STILL_WATER_SOUNDS (by level theme), EVENT_SOUNDS (what `say` events
                     sound like), bagSound),
                     mix.ts (Ears, Hearing, place: a sound's gain and pan from where it is; mixGain;
                     nearestWater), battle.ts (fightEars: a fight's cues and loops each frame; swingVoice;
                     ARENA_HEARING, STRIDE_M), overworld.ts (overworldEars: footsteps, campfires, the nearest
                     running and still water; OVERWORLD_HEARING, STRIDE_TILES), sounds/ (the .ogg files,
                     SOUNDS.md), music/ (a track's .ogg, `<track>.ogg`, a seamless loop)
    visuals/         All the drawing: the only code that imports Babylon. Reads the modes' state; nothing hands it any
      visuals.ts       The owner: createDrawing (the engine, both scenes; `show(mode)`, `frame(dt)`; each player's look
                       painted); Visual ({ spawn, frame, dispose }); VISUALS (each kind of thing in a fight) and
                       kindOf; EFFECTS (each fight event's one-shot effect) and FiredEffects (once per step and event)
      characters.ts    PlayerLook: paints a look's chibi at once and its battle frames from behind one per slice
                       after, or the rest when a fight starts, again when the hand the fight's weapon is in changes
                       (its `Wielder`), the sword left out; a frame from the front only the first time it's shown
                       (battleSprite); where the sword hand is in a frame (handAt); BATTLE_FRAMES; chibiDraw; the "!"
                       alert and the crossed swords over a player in a battle
      enemies/         One folder per enemy, by its EnemyId: wild-boar/, kobold-swordsman/, goblin-warlock/, each
                       with model.ts (built from primitives), pose.ts (where its parts head, from its state; no
                       Babylon: tested), animation.ts (its fight visual: the pose eased into, the walk) and sprite.ts
                       (its overworld picture and size); kobold-greatsword/ has only its sprite.ts and animation.ts:
                       the swordsman's lizard model, bulkier and plated (KoboldBuild; its blade comes from
                       WEAPON_LOOKS); training-dummy/ (animation.ts with its model: a straw dummy on a post, a mark
                       lit for each kind of strike landed; sprite.ts); bram/ (only sprite.ts: in a fight he's drawn
                       as a person, `npc` in ENEMY_LOOKS, visuals.ts painting his NPC look). index.ts (ENEMY_LOOKS,
                       one line each; byEnemy)
      npcs/            One folder per NPC, by its NpcId: hollis/, maren/, tobin/, corwin/, ilse/, herald/, grocer/,
                       apothecary/, smith/, changer/, bram/, each with look.ts
                       (its name and look, drawn as a player's). index.ts (NpcLook; NPC_LOOKS, one line each)
      sprites.ts       spriteMaterial, redrawSprite; textures.ts (procedural textures; glowTexture and
                       puffTexture for particles); materials.ts (colorMaterial)
      battle/
        scene.ts         ArenaScene (what the arena's visuals share): the scene, camera, its sky, post, materials, the
                         skill kit, each fighter's node, each player's look in their frames, the shake, each fighter's
                         impact
        impact.ts        Weapon impacts, drawing only: a hit's hit-stop and the target's jolt the blade's way, a blocked
                         blade's bounce and sparks (strike, clash), a perfect block's longer hold, bounce and shower of
                         sparks (parried), and a broken guard's jolt and flash (guardBroken); impactPose and
                         joltOf (no Babylon: tested)
        battle.ts        fighter() (a fighter's node following its body, eased over corrections, held by a hit-stop and
                         pushed by a jolt, its reactions' bursts, any skilled fighter's chant circle and chant
                         words, a dead enemy crumbling to ash and a player who left the arena fading; DISSOLVE_TIME,
                         LEAVE_FADE_TIME), arenaStage (the scenery per arena, the camera on the mode's view plus
                         shake, the lock-on's diamond, your aim ring, the drops' sacks after a win)
        aimRing.ts       Your own aim ring, always shown while you fight: wedgeOf and ringLights (the aimed way's
                         wedge, a stab's mark; tested) and aimRing, drawn by arenaStage
        materials.ts     The arena's materials (the player's frames among them); playerFrames (a set of a player's,
                         from behind and the front)
        player.ts        The player's visual: the sprite, its shadow, its 3D sword at the frame's sword hand, the sword's
                         trail (in an Imbue's colour); a leaving player's sprite in a blended copy of its frame, to
                         fade; personEnemyVisual, the same drawing for an NPC fought as an enemy (its stance from its
                         state)
        slash.ts         A swing's crescent trail across the swinger's view (buildSlash, placeSlash from the motion's
                         TrailPose): every player's and the Kobolds'
        blade.ts         The 3D sword: buildBlade (grip, guard and blade along a hand's +y, from WEAPON_LOOKS: the
                         Kobolds' and every player's); its tip's glint just before it goes live (cueBlade, showCue
                         by glintOf); a flat sprite's held blade (holdBlade, placeBlade: at the
                         sprite's hand on its plane, turned the way the player faces, eased but for mid-swing)
        chantWords.ts    Another fighter's chant: its last words and the next, empty square, in front of it
        pose.ts          The player's pose and frame, from the action, the swing, the aim and the block (staggered
                         included; a way takes the nearest drawn swing, an aim the nearest guard pose);
                         playerBlade (their 3D blade, from the same, by the weapon's MOTIONS
                         row and the shared draw-back, drawn back less: SPRITE_DRAWBACK); facingSeen (their back
                         or front, by where the camera is, held side-on within TURN_MARGIN_RAD). No Babylon: tested
        arm.ts           The humanoid arm rig every 3D enemy's arms use: shoulder, upper arm, elbow, forearm and hand,
                         reached each frame with two-joint IK (reachArm, no Babylon: tested) to where its pose puts
                         the hand; a wielder's arm is its armReachM long
        weapons.ts       Any wielder's weapon, from its swing: wayCut (a swing's line across the screen, along its way;
                         a stab's straight ahead),
                         strokeOf (where its blade is on a step), the frame (wind-up, live, follow-through);
                         MOTIONS, by weapon kind: the trail's line, a 3D blade held aimed and its way through a
                         wind-up and a swing, from a cut at any angle; the draw-back before it drives (DRAWBACK,
                         pullOf, drawnBack) and the blade at rest and reeling (every wielder's: the
                         Kobolds' and the players'); WEAPON_LOOKS, by weapon: its 3D blade and its hit-stop. No
                         Babylon: tested
        skills.ts        The skills' effects, built in code, pooled: the kit (bursts: Nova, Self, Imbue's cast, a
                         Bolt's impact, the reactions, Earth's shards, a clash's sparks, a perfect block's, a broken guard's
                         flash), the chant's and wind-up's
                         circle, and a visual per SkillObject kind (a Bolt's core and trail or an Earth rock, a
                         Beam's tubes and flares, a cloud's dome and pulse, a Delay's orb, an Imbue's glow at the
                         sword hand)
        skillLooks.ts    SHADER_LOOKS and PARTICLE_LOOKS (each element's colours and motion), the skill shader
                         (GLSL: flow / shell / circle / ring) and its pooled meshes, pooled particles, Lightning's arcs
      overworld/       The overworld, drawn HD-2D style: pixel-art billboards on 3D ground (the flat 2D one is
                       archived: plan/overworld-2d.md)
        scene.ts         OverworldScene: perspective camera, its sky, bloom, colour grade, vignette and the
                         tilt-shift blur (GLSL); the sprite materials (a pile's sack among them, drawPile, a
                         trace's bedroll, the arena's too); standingQuad
        walker.ts        WALKERS (chibi, other players', NPCs', enemy, pile and trace billboards: glide, hop,
                         facing, the sky's tint and blob shadows, "!", another player's or an NPC's own chibi and
                         name, a player's crossed swords, a Speech's bubble over the head)
        bubble.ts        speechBubble: a chat line wrapped into a speech bubble, at most 3 lines
        overworld.ts     overworldStage (the level, the camera following the player and easing through its quarter
                         turns, the sky's frame)
        scenery.ts       Scenery's shapes (ledges, props) and the rules every level's keeps: groundY, isTall, hidesWalker
        terrain.ts       Builds it: hands the sky the level's look and campfire lights; cliff blocks (shadow casters),
                         grass tops and fringes, the map's ground (paintGround), instanced props (the tiles' and the
                         scenery's, each tinted by the light where it stands; a tall one's shadows come from upright
                         cards only shadow maps see, one kept turned to the sun or moon and one turned to each campfire
                         in reach, each cast by its own light), the campfires; face turns the props to the camera;
                         a ledge hiding any of the player from the camera turns see-through (hidesWalker, SEE_THROUGH)
        props.ts         The pixel-art props (trees, pines, bushes, rocks, ruins, grass, flowers, the market's stalls
                         and forge, the yard's dummies), drawn standing up;
                         Pen
      levels/          Each level's drawing, a folder per LevelLayout.theme. index.ts (LEVEL_LOOKS: its env (daylight
                       colours and fog), tile looks, its WaterLook and the 3D surroundings; the campfire's picture
                       and light, campfireLights), tiles.ts (paintGround and tileProps: a map's ground picture and
                       props from its tile looks)
        ground.ts        groundPainters: the ground painters every level's tiles share, over its GroundPalette (a
                         summoning pad's carved rim and ring among them)
        grass-field/     tiles.ts (GRASS_FIELD_TILES: each tile kind's ground painter and props, dusky colours),
                         scenery.ts (the 3D cliffs and woods round the map; no Babylon: tested)
        mistwood/        tiles.ts (MISTWOOD_TILES: dark pines, dead trees, mushrooms, reeds), scenery.ts (its
                         surroundings; no Babylon: tested)
        kingdom/         tiles.ts (KINGDOM_TILES: marble, carpet, cobbles, the stalls; TOWN_TILES, the town's tiles
                         for the other looks to borrow), scenery.ts (castle walls and the keep behind the hall, house
                         blocks with plaster sides and tiled roofs, the town's rooftops round the map)
      sky/             sky.ts: the one owner of the arena's and overworld's lights and shadows (nothing else makes a
                       light or a shadow generator): the time of day's sun or moon (one shadow-casting light,
                       cross-faded at the horizon) and their discs, the sky light, sky colour and fog over a look's
                       colours (SkyLook), the map's flickering point lights (the nearest the camera cast shadows), a
                       sprite's tint, the yaw that turns a shadow card to a light. daylight.ts (the day clock,
                       setDayClock (dev: `?time=`, `window.setTime`); by the sun's height: the direct light, the
                       sky's colours and the discs' fade; moonlight), blobs.ts (a sprite's blob shadows, Blobs: a
                       round one from the sky light, and one away from each light that reaches it, as dark as that
                       light's share there; blobShadowsAt, tested)
      water/           The one water look, overworld and arena alike: water.ts (waterMaterial, a shader with
                       ripples carried by the current (in place where there's none), waves rising and falling in
                       place, a ring now and then at a random spot on still water (none where there's a current),
                       fresnel sky, sun and moon glints and shore foam, tuned by a WaterLook and RINGS; setWater gives
                       a mesh its current, shore and depth per vertex), level.ts (levelWater: the
                       level's ground with the water cut out, its bed, banks and surface, from the water map in
                       modes/overworld/water.ts)
      arenas/          Each arena's look, a folder per ArenaLook. index.ts (ARENA_LOOKS, one line each: a look's
                         env (its daylight colours and fog), its map lights and build; showArena, the one call
                         battle.ts makes: hands the sky its look and returns the look's root, whose disposal takes
                         its meshes and materials), parts.ts (what
                         the looks share: lookRoot, speckled, floor, scatter, ringSpots, settle)
        forest-clearing/ the boar's and tall grass's: moss, a dirt floor, standing stones, pines, ferns, logs
        stone-ruins/     the Kobolds': flagstones, broken columns and walls, two arches, far ruins, cypresses
        mire/            the Goblin Warlock's: peat, stumps, glowing mushrooms, pools, reeds, dead trees
```

## Adding things

- **A message.** Client -> server: a Zod schema in `shared/src/net/client-messages.ts` and the union, a method on
  `GameSession` (`server/src/core/game/session.ts`) that does it, and a handler in `server/src/ws/handlers.ts` that
  calls it (TypeScript errors until you do). Server -> client: a case in `ServerMsg` (`server-messages.ts`) and a
  `net.on("<type>", ...)` where it's used (the mode that owns it, or `client/src/game/game.ts`).
- **A level.** A file in its floor's folder, `server/src/core/world/floors/<n>/<level-id>.ts` (or in `world/` for one
  on no floor, as the kingdom), exporting its `LevelDef` (its `floor` if any, an encounter table if its grass fights,
  and its map as rows of tile characters, north first, centred on 0, 0), and its line in `LEVELS`
  (`server/src/core/world/index.ts`). It names its arena by `arenaId`. The level's test walks the map: the start, the
  campfires, the NPCs and every spawn (mirrored too, as the spawner may) clear of solid tiles and reachable, and the
  start on summoning pad tiles (`@`). A way to another level is an `ExitDef` on each side (an open stretch of the map's
  edge, and where you land on the other); the scenery cuts a gap in front of it. For a new look, a theme in
  `LevelLayout["theme"]` (`shared/src/world/layout.ts`), a folder named by it in `client/src/visuals/levels/` (its tile
  looks and 3D scenery) and its line in `LEVEL_LOOKS`.
- **A tile kind.** Its line in `TILES` (`shared/src/world/tiles.ts`: a character no other kind uses, solid or not,
  tall grass or not); walking, encounters and enemies follow from it. Then how it looks in every level look's tile
  table (`client/src/visuals/levels/<theme>/tiles.ts`: a ground painter, and props if it has any; TypeScript errors
  until it's there), which the overworld draws. A new prop is its art in `PROP_ART`.
- **An arena.** An `ArenaDef` (id, radius, look) beside the level that fights in it, and its line in `ARENAS`. The
  level's `arenaId` is where tall grass and spawns without one fight; a spawn's own `arenaId` takes its fights
  elsewhere (`startBattle`). Every arena has the same radius for now (tested). The wall's shape is the fight's
  (`arena-physics.ts`), from the radius; a look never changes how a fight plays.
- **An arena look.** Its name in `ARENA_LOOK_IDS` (`shared/src/world/arena.ts`), a folder named by it in
  `client/src/visuals/arenas/` exporting an `ArenaLookDef` (`env`: sky, fog, ambient, sky light, sun; `build`: every
  mesh under one `lookRoot`, its materials `own`ed, ending in `settle`), and its line in `ARENA_LOOKS` (TypeScript
  errors until it's there). Dressing stays outside the radius: nothing inside the wall but the floor.
- **An enemy.** Its id in `EnemyId` (`shared/src/battle/defs.ts`); a file named by it in `server/src/core/enemies/`
  (its `EnemyDef` combining behaviors, its drops, its overworld actor's behavior parts) and its line in `ENEMIES`;
  a folder named by it in `client/src/visuals/enemies/` (model, pose and its test, animation, sprite) and its line
  in `ENEMY_LOOKS` (TypeScript errors until both are there); and a spawn in a level. A new enemy behavior is a def
  shape in `shared/src/battle/defs.ts`, a component and its states in `EnemyState`
  (`shared/src/battle/components.ts`), an entry in `ATTACKS` (`shared/src/battle/fight/setup.ts`) and a system in
  `shared/src/battle/fight/behaviors/`, listed in `fight.ts`, its state in `fight/state.ts`. A new overworld
  behavior: component + factory + system in `server/src/core/overworld/behaviors/`.
- **An NPC.** Its id in `NPC_IDS` (`shared/src/world/layout.ts`); a file named by it in `server/src/core/npcs/`
  (its `stops`, the last with no `when`, each `{ level, at, heading, talk }` with its talk there, the last with no
  `when`) and its line in `NPCS`; a folder named by it in `client/src/visuals/npcs/` (`look.ts`: its name and a look
  from `LOOK_OPTIONS`) and its line in `NPC_LOOKS`. The tests check it always stands somewhere with something to
  say, clear and walkable to; placing, talking and drawing it need nothing more.
- **An NPC moving on.** A stop above its old one in its file, with a condition (`when: { flag: ... }`, a flag a quest
  step's reward sets) and its own talk; each player sees it at the first stop whose condition holds, from their next
  visit to a level. The old stop keeps a talk for that flag (its goodbye, said until they leave) and gets a `trace`
  (where it lies and its lines, pointing the way), which lies there for anyone who sees the NPC further on.
- **A quest.** A row in `QUESTS` (`server/src/core/content/quests.ts`): its title, half, a `when` to start it (for a
  chain, `{ done: <the one before> }`, listed earlier), and its steps, each with an `id` (saved with players: renaming
  one forgets the quest for anyone on it), a `Task`, the questbook's text and hint (only what the NPC told) and its
  `reward` (`items`, `flags`, `lore` ids). Then, in the NPC's file, at the stop where it's given: a talk `when: {
  canStart: <quest> }` with `offer: { start: <quest> }`; a talk `when: { quest, step }` for each step that needs its
  own words; on a deliver step, one with `offer: { deliver: <quest> }`; and on a talk step, the lines the NPC says as
  it's done. The data tests check every item, enemy, NPC, level, condition and lore id is real, every quest is
  offered, and every talk and deliver step has its NPC's lines. A new kind of task is a member of `Task`, a case in
  `met` (`server/src/core/game/story.ts`, or `false` if an NPC does it) and, if it counts something, a `Tally`.
- **A lore entry.** A row in `LORE` (`server/src/core/content/lore.ts`), and its id in the `reward.lore` of the step
  that reveals it; the questbook lists it under that quest once the step is done.
- **A weapon.** An item in `ITEMS` (`shared/src/items/items.ts`, `wearable` on a hand), its row in `WEAPONS`
  (`shared/src/weapons/weapons.ts`: kind, length, damage, heft, minimum strength), its bag picture (`client/src/gfx/items/items.ts`)
  and its row in `WEAPON_LOOKS` (`client/src/visuals/battle/weapons.ts`). Whoever holds it swings it with the
  kind's moves and `MOTIONS` row, so a weapon of a kind that exists needs no animation code: a player's sprite holds
  the same 3D blade as a model. A new kind is a name in `WEAPON_KINDS` and a `MOTIONS` row (and, for the player, its
  sprite poses).
- **An enemy that wields a weapon.** `wielder` on its `EnemyDef` (`{ hands: { rightHand: "kobold-blade" },
  armReachM }`) gives it a `Wielder`; a `weapon` attack makes it fight like the Kobold, or its own AI calls
  `startSwing` (`fight/weapons/swing.ts`) with the attack's kind, side and place in its chain. The weapon system does
  the rest. A 3D model draws its blade from `WEAPON_LOOKS` (two-handed or not) and moves it with its weapon kind's
  `MOTIONS` row, in the hand of an arm from `visuals/battle/arm.ts`; its pose puts the hand and turns the body ahead of
  the blade.
- **A visual** (anything new drawn in a fight). One row in `VISUALS` (`client/src/visuals/visuals.ts`): a
  `Visual` with `spawn` (build its meshes), `frame` (pose them from the entity's components, each frame) and
  `dispose`, and its kind in `kindOf`, from a component the entity already has. Its pose is a function of that
  state, without Babylon, beside it and tested; its own state holds only meshes and smoothing. A one-shot effect of a
  fight event is an entry in `EFFECTS`. Nothing outside `visuals/` changes: the mode already holds the state it
  draws (if it doesn't, add it to the mode's state, not a call into drawing).
- **Something kept between connections.** A field on `PlayerSave` (`server/src/core/ports.ts`) and `newPlayer()`
  (`core/content/player.ts`), read in `GameSession`'s constructor and written in `GameSession.save()`; a column in
  `server/src/db/schema.ts` (then a migration, below), and `toRow` / `fromRow` in `db/player-store.ts`.
  Another store is a class implementing `PlayerStore`, swapped in for `new PgPlayerStore(db)` in `main.ts`.
- **A schema change.** Edit `server/src/db/schema.ts`, run `npm run db:generate -- --name <what-changed>`, read the
  SQL it wrote and commit it with `migrations/meta/`. drizzle-kit asks when it can't tell a rename from a drop +
  add. For a data change it can't work out, `npm run db:generate -- --custom --name <what>` writes an empty
  migration to fill in. Don't edit merged migrations: databases that already ran them won't run them again.
- **An HTTP route.** A handler in `server/src/api/routes/accounts.ts` (or a new plugin file in `api/routes/`,
  registered in `api/server.ts`), with its body's Zod schema in `shared/src/net/` as `schema: { body }`;
  `req.body` comes typed and checked. Throw `HttpError(status, sentence)` for an answer the client should show.
  Logic goes in core, not in the handler.
- **Something core needs from outside** (a clock, mail, another database). An interface in `core/ports.ts`, an
  implementation in an outlet (or a new outlet folder, added to `OUTLETS` in `server/scripts/check-layers.ts`),
  and one line in `main.ts` passing it in. Core never imports the implementation.
- **A key binding.** The action in `ACTIONS` (`client/src/settings/bindings.ts`, label + default keys) in general,
  overworld or battle, read from `actions.poll()` (`held`,
  `pressed`; a pair of opposites goes in `AXES`), or
  listened for with `useAction(input, [<action>], ...)`, and added to its layer in `LayerActions` (`core/actions.ts`)
  if it isn't the whole group's; the settings screen lists it on its own. A player whose saved keys hold its default
  key gets it unbound, shown as Unbound in the settings.
- **A new kind of setting.** A store in `client/src/settings/` with `restore` / `toSaved` (see camera.ts), added to
  `Settings`, `createSettings()`, `restoreSettings()` and `toSaved()` in settings.ts, a field in
  `SavedSettingsSchema` (`shared/src/net/client-messages.ts`), and a section in `ui/screens/settings/` shown by
  SettingsScreen. The server stores whatever passes the schema (`players.settings`, jsonb). Game code reads it
  from the `settings` it already has (`ctx.settings` in the arena).
- **A UI screen or HUD piece.** A component in `client/src/ui/` (`hud/`, or a folder of its own in
  `screens/`; parts used by more than one screen go in `components/`). If the game has to feed it, add fields to a
  store in `ui/state.ts` and `set` them from game code; if it has to ask the game for something, add a function to
  `UiActions` (main.ts provides them).
- **A cheat** (dev only). A case in `CheatSchema` (`shared/src/net/client-messages.ts`), its branch in `runCheat`
  (`server/src/core/game/cheats.ts`; a fight's state changes through `room.edit`), a test that production ignores it,
  and a button in `client/src/ui/screens/admin/AdminPanel.tsx`.
- **Something the game says to the player.** A case in `GameEvent` (`client/src/ui/notifications/say.ts`) and its
  entry in `EVENT_MESSAGES` (TypeScript errors until you add it): `where: "corner"` (a notice) for anything small,
  `"centre"` (the banner) only for bigger events like a fight starting; long wording gets its own file there, like
  battleResult.ts. Game code calls `say(ui.notifications, { kind: ... })`. Test the words in
  `client/test/ui/notifications/say.test.ts`; its placement test lists the events allowed in the centre. If it should
  make a sound, its kind's entry in `EVENT_SOUNDS` (`client/src/audio/sounds.ts`).
- **A sound.** A CC0 file only (SOUNDS.md says where every file is from: add its row), mono Ogg Vorbis named
  `<sound>-<n>.ogg` in `client/src/audio/sounds/`, and its row in `SOUNDS` (`client/src/audio/sounds.ts`; the table's
  test fails on a file that's missing or unused). Something in a fight is heard from the fight's state in
  `audio/battle.ts` (a step event's entry in `EVENT_CUES`, or a change on a fighter), something on the overworld in
  `audio/overworld.ts`; neither plays anything itself, they return cues and loops, so test them there.
- **Music.** A CC0 track only (its row in SOUNDS.md), a seamless loop saved as stereo Ogg Vorbis at the others'
  loudness, `client/src/audio/music/<track>.ogg`, with its row in `TRACKS` (`client/src/audio/music.ts`). Where it
  plays is its name in `MUSIC` there: a new level theme or arena look doesn't compile until it has one.

## Where to tune things

What these numbers go into, as formulas with worked examples: [FORMULAS.md](FORMULAS.md).

| What | Where |
|---|---|
| Player speeds, dodge costs and feel (at stats of 10) | `shared/src/battle/player.ts` (`PLAYER`) |
| Weapons: the arsenal (length, damage, heft, minimum strength) | `shared/src/weapons/weapons.ts` (`WEAPONS`) |
| The sword: the swings' starts by chain (and their floor), momentum, the heavy and the stab, the reach; the held block, its drain and costs, the guard break, the guard's raise time, the perfect block, the heavy's feint, the lunge | `shared/src/weapons/hybrid.ts` (`CHAIN`, `MOMENTUM`, `HYBRID`, `REACH_FACTOR`, `ARC_DEG`) |
| A swordsman: its wind-ups, recovery, chains, when it blocks, how often it perfect-blocks and feints a heavy; its poise | its def and weapon attack (`server/src/core/enemies/kobold-swordsman.ts`) |
| Arm reach (to the hilt) | `PLAYER.armReachM`; an enemy's `wielder.armReachM` |
| The core: the realms and steps, each step's fill, what a step gives (stats, free points) | `shared/src/soul/core.ts` (`CORE`, `REALMS`, `STEP_NAMES`) |
| What each stat does: HP and stamina per point, defenses, HP regen and its pause, the carry limit | `shared/src/battle/stats.ts` |
| The stats chart: its size, where the names sit, its rings; the character panel's width | `client/src/ui/hud/character/chart.ts`; `WIDTH_PX` in `client/src/ui/hud/character/CharacterPanel.tsx` |
| How the core's sphere looks: each realm's colours and light, the light's size and brightness by step, its breath, when sparks start, a breakthrough's timing, how long the card shows it | `REALM_LOOKS`, `LIGHT`, `SPARKS_FROM` in `client/src/gfx/core/light.ts`; `BREAKTHROUGH`, `BREATH_TIME` in `client/src/gfx/core/sphere.ts`; `BREAKTHROUGH_SHOWN_MS` in `client/src/ui/hud/CoreCard.tsx` |
| Each monster's essence: its worth and how long it takes to absorb | `shared/src/items/items.ts` (`essence`, `ABSORB_TIME`); who drops it in `server/src/core/enemies/<id>.ts` |
| Enemy stats, attacks, sidesteps, keeping away, what and how it casts, drops, overworld wandering and chasing | `server/src/core/enemies/<id>.ts` |
| Items: size, stack size, weight; what using one does and how long it takes (overworld and fight alike), the slot they're worn in | `shared/src/items/items.ts` (`consumable`, `wearable`) |
| Bag size | `shared/src/items/bag.ts` (`STARTER_BAG`) |
| Piles: how long one lies, how wide it's laid out; its size on screen | `server/src/core/overworld/piles.ts` (`PILE_LIFETIME_MS`, `PILE_COLS`); `PILE_SIZE_TILES` in `client/src/visuals/overworld/walker.ts` |
| A trace's (an NPC's bedroll) size on screen | `BEDROLL_SIZE_TILES` in `client/src/visuals/overworld/walker.ts` |
| The reach to open a pile or talk to an NPC (overworld and arena alike), how far round from the way you face, and their slack | `INTERACT_RANGE_M`, `INTERACT_LOOK_RAD` in `shared/src/world/interact.ts`; `INTERACT_LAG_SLACK_M`, `INTERACT_LOOK_SLACK_RAD` in `server/src/core/overworld/interact.ts` |
| The arena after a win: how long it stays open, where the drops lie; the banner's time; the sack's size | `AFTER_FIGHT_MS`, `DROP_GAP_M` in `server/src/core/game/battle.ts`; `AFTER_FIGHT_BANNER_TIME` in `client/src/modes/battle/context.ts`; `PILE_SIZE_M` in `client/src/visuals/battle/battle.ts` |
| A dead enemy crumbling, a leaving player fading | `DISSOLVE_DELAY_TIME`, `DISSOLVE_TIME`, `DISSOLVE_SINK_M`, `ASH_PER_SEC`, `LEAVE_FADE_TIME` in `client/src/visuals/battle/battle.ts`; the ash's look in `PARTICLE_LOOKS` (`skillLooks.ts`) |
| Cloth size, slots, the starting equipment | `shared/src/items/gear.ts` (`CLOTH`, `SLOTS`, `starterEquipment`) |
| Players a server lets on, its name in the server list | `.env` (`MAX_PLAYERS`, `SERVER_NAME`); defaults in `server/src/env.ts` |
| Carry limit | `shared/src/battle/stats.ts` (`CARRY_LIMIT_AT_AVERAGE`) |
| What carrying too much does | `shared/src/items/burden.ts` (`BURDEN`) |
| Shops: what each sells and buys, what things are worth, the capital's prices, what a shop pays, the first purchase's discount | `server/src/core/content/shops.ts` (`SHOPS`, `ITEM_VALUES`, `PRICE_FACTOR`, `SELL_SHARE`, `FIRST_PURCHASE_DISCOUNT`); the coins' worth in `shared/src/items/coins.ts` (`COIN_VALUE`) |
| Skills: word costs, how a chain's cost grows, release time; which modifiers fit which Form | `shared/src/skills/skill.ts` (`SKILL`, `MODIFIER_FITS`) |
| How long writing a page takes in a fight | `shared/src/skills/skill.ts` (`SAVE_IN_FIGHT_TIME`) |
| Skills in a fight: D, the Forms, each element, the reactions, Self, the modifiers, the object caps | `shared/src/skills/effects.ts` (`SKILL_EFFECTS`) |
| How water looks (colour, murk, reflection, glints, ripples, foam), per level and in the mire; rings in still water; how fast it runs | `water` in `LEVEL_LOOKS` (`client/src/visuals/levels/index.ts`); `POOLS` in `client/src/visuals/arenas/mire/mire.ts`; `RIPPLE` (the ripples' scale and cycles), `RINGS` in `client/src/visuals/water/water.ts`; `FLOW`, `WATER_DEPTH_TILES` in `client/src/modes/overworld/water.ts` |
| Sounds: each one's files, volume, rate, variation, bus, how far it carries; which sounds an enemy, element, arena or level has | `SOUNDS` and the tables below it in `client/src/audio/sounds.ts` |
| Music: which track plays where, each track's volume, how long a crossfade takes | `MUSIC`, `TRACKS` in `client/src/audio/music.ts`; `MUSIC_FADE_TIME` in `client/src/audio/audio.ts` |
| How far sounds carry and how far they pan; footsteps' stride; how many of one sound play at once; the default volumes | `ARENA_HEARING`, `STRIDE_M` (`client/src/audio/battle.ts`), `OVERWORLD_HEARING`, `STRIDE_TILES` (`audio/overworld.ts`), `MAX_PAN` (`audio/mix.ts`), `MAX_VOICES` (`audio/audio.ts`), `VOLUME` (`client/src/settings/audio.ts`) |
| How each element's skills look (colours, how ragged and fast they move, their particles) | `client/src/visuals/battle/skillLooks.ts` |
| How far back any wielder draws its blade before an attack, more before a heavy, drawn only; how far a Kobold leans, turns and bends with it; a player's share of it | `DRAWBACK` in `client/src/visuals/battle/weapons.ts`; `KOBOLD_DRAWBACK` in `client/src/visuals/enemies/kobold-swordsman/pose.ts`; `SPRITE_DRAWBACK` in `client/src/visuals/battle/pose.ts` |
| The aim ring (wedge size, radius, height, the stab's mark) | top of `client/src/visuals/battle/aimRing.ts` |
| How fast a player's 3D blade turns and follows the sprite's hand, how much it glows; the tip's glint (size, colour, and when: `glintOf` in `weapons.ts`) | top of `client/src/visuals/battle/blade.ts` |
| How far to the side a swing's whoosh is heard from | `SWING_SIDE_M` in `client/src/audio/battle.ts` |
| How far a player's sprite crouches winding up a heavy | `HEAVY_WINDUP_STRETCH` in `client/src/visuals/battle/player.ts` |
| Hit-stop by weapon; the hit's jolt and a blocked blade's bounce; a perfect block's hold and bounce, a broken guard's jolt | `hitStopMs` in `WEAPON_LOOKS` (`client/src/visuals/battle/weapons.ts`); top of `client/src/visuals/battle/impact.ts` |
| Levels: map, spawns, encounter tables, campfires, arena size, which arena each spawn fights in | `server/src/core/world/floors/` |
| Where an NPC stands and what it says, by the story, and what it leaves where it moved on from; its name and look | `server/src/core/npcs/<id>.ts`; `client/src/visuals/npcs/<id>/look.ts` |
| Quests: what each step asks (counts), what it gives (items, lore ids, flags), its questbook text and hint; lore entries | `server/src/core/content/quests.ts` (`QUESTS`), `server/src/core/content/lore.ts` (`LORE`) |
| Which tiles block walking or roll encounters | `shared/src/world/tiles.ts` (`TILES`) |
| How big a walker is against solid tiles | `shared/src/world/layout.ts` (`WALKER_RADIUS`) |
| How each tile looks; the overworld's colour grade and camera (its turn time; its tilt's range and speed), a walker's blob size | `client/src/visuals/levels/` (`tiles.ts` per look), `client/src/visuals/overworld/scene.ts`, top of `client/src/visuals/overworld/overworld.ts` and `walker.ts`; `CAMERA_PITCH` in `client/src/modes/overworld/facing.ts` |
| A level's daylight sky, fog and light; a campfire's light | `env` in `LEVEL_LOOKS` and `CAMPFIRE_LIGHT` in `client/src/visuals/levels/index.ts` |
| An arena look's daylight sky, fog and light; its map lights | `env` and `lights` in each `client/src/visuals/arenas/<look>/` |
| The day's length; the sun's and moon's arcs | top of `shared/src/world/day.ts` |
| The time of day's light: colours by sun height, moonlight, fades | top of `client/src/visuals/sky/daylight.ts` |
| Map-light shadows, sprite tint, sun and moon discs | top of `client/src/visuals/sky/sky.ts` |
| Blob shadows | `BLOB` in `client/src/visuals/sky/blobs.ts` |
| Arena camera feel, locked and not | top of `client/src/modes/battle/camera.ts` |
| How quick a mouse flick aims (distance, time, rest between flicks) | `FLICK` in `client/src/core/actions.ts` |
| Retarget ties | `client/src/modes/battle/lock.ts` (`RETARGET_TIE_RAD`) |
| Where a fight starts (and a duel) | `shared/src/battle/fight/setup.ts` |
| A duel challenge's reach and how long it stays open | `server/src/core/game/duels.ts` |
| Chat: lines kept, lines sent on joining, the rate limit; the longest line; the log's length; a bubble's time | top of `server/src/core/game/chat.ts`; `MAX_CHAT_CHARS` in `shared/src/net/server-messages.ts`; `CHAT_LOG_LINES` in `client/src/ui/state.ts`; `SPEECH_TIME` in `client/src/modes/overworld/overworld.ts` |
| The arena's wall and floor | `shared/src/battle/fight/physics/arena-physics.ts` |
| How a fight ends: time limit, leaving mid-fight | `shared/src/battle/fight/outcome.ts` |
| Fight netcode: hash rate, how late an input may be, how far ahead | `shared/src/battle/netcode.ts` |
| Fight netcode: start wait, resync gap | `server/src/core/battle/room.ts` |
| Fight netcode: a silent player letting go | `server/src/core/battle/inputs.ts` |
| Fight netcode: heartbeat, history, pacing | `client/src/modes/battle/sync.ts`, `client/src/modes/battle/pace.ts` |
| View: a screen's widest shape; how far round the player actors and other players are sent | `shared/src/overworld/view.ts` (`VIEW`); `VIEW_RADIUS_TILES` in `server/src/core/game/snapshot.ts` |

Changing any of these changes how the game plays: ask first (see [AGENTS.md](AGENTS.md)).
