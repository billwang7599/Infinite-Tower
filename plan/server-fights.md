# Fights on the server: what's left

Status: **later**. Built: the arena fight is shared code on Rapier, the server runs it and decides it, and the
client predicts only its own character (see ARCHITECTURE.md, "The server runs it"). This is what's still open.

## Open questions

- **Lag compensation.** Inputs carry no time: a slash or dodge happens on the server step its input arrives for,
  so with a slow connection a dodge that looked in time can come too late. Inputs with timestamps, or the server
  judging hits against what the player saw, are possible later steps. Not decided.
- **What others see is late.** Enemies are drawn 5 steps (83 ms) behind the newest state, plus half the round trip,
  so their wind-ups show a little late to the player; hits land when the server says. Worth a feel test with the
  dev ping (`?ping=N`) before tuning `INTERPOLATION_DELAY_STEPS` or adding extrapolation.
- **More than one player in a fight.** The fight, the room and the messages take any number of players, but every
  battle has one, and that player's session steps its room. With more: something has to step each room once a tick
  (a set of rooms in `OnlinePlayers`, or a pod per battle), and these placeholders need deciding: whom an enemy
  goes for (the nearest player still standing), when the fight is lost (every player down; one who left counts as
  down), whether a downed player on a winning side wins, and whether players bump into each other (they pass
  through).
- **Bandwidth.** A `battleState` is JSON, about 0.7 KB at 20 a second (about 14 KB/s) for one player against one
  boar; inputs are about 7 KB/s up while moving. With 20 against 20, a binary format or sending only what changed
  would be worth it.
- **Alt-tab.** The server's fight goes on while the player's tab is hidden (the browser stops drawing and sending):
  after 15 steps without input the server takes them to have stopped, and the boar keeps fighting.
- Bundle size: the package carries Rapier's WebAssembly as base64 in the JavaScript (about 1.7 MB gzipped, against
  Havok's 0.7 MB). The package with a separate `.wasm` file would be about 0.5 MB smaller gzipped, at the cost of
  loading the file by hand in Vite and Node.
- The fight's own JavaScript math (`Math.sin`, `atan2`, `hypot`) gives the same numbers in Node and Chrome (both
  V8), but other browsers may differ in the last bit; the prediction's reconciling takes that away, as a small
  correction.
