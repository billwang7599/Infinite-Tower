# Fights on the server: what's left

Status: **later**. Built: the arena fight is shared code on Rapier; the server runs it and decides it; the browser runs
its own copy of the whole fight at once and sends only its inputs, each for a numbered step, checked against the
server's hash 4 times a second (see ARCHITECTURE.md, "The server runs it" and "A fight on the wire"). This is what's
still open.

## Open questions

- **Timing cheats within the late window.** An input may reach the server up to `MAX_INPUT_DELAY` (200 ms) after its
  step and still run on it, so a client could hold its inputs back on purpose and decide them with 200 ms more of
  the fight in view (the boar's AI is deterministic, so a client can already see where it's going). A smaller
  window means more corrections on bad connections. Not decided; worth a look once there's PvP or anything to win.
- **Corrections are snaps, eased.** When the hashes differ, the client loads the server's fight and replays; every
  fighter's drawing eases toward where it jumped (`DrawOffset`; a big jump shows as it is). A hit the client hadn't
  seen coming (an input of yours that ran late) can still pop. In headless Chrome, steady pings of 50, 200 and
  500 ms needed none in a dozen whole fights; freezing the page for 600 ms cost 2. Real jitter will tell.
- **Bandwidth.** Down: a `battleHash` (about 85 bytes) 4 times a second, about 0.45 KB/s, and a `battleSync` (about
  1.2 KB) only when the copies differ. Up: a change of input per step while the camera turns (about 7 KB/s), far
  less while it's still. Sending the move and the aim
  as small integers, or only the fields that changed, would cut the upload if it matters.
- **Alt-tab.** The browser stops drawing a hidden tab, so its fight and its inputs stop. The server waits 200 ms, then
  runs on with the player's last input; after `SILENT_STOP_STEPS` (15) such steps it takes them to have let go of
  the move keys, and the boar keeps fighting. Coming back, the client is far behind the server's fight: it asks for
  it and jumps there.
- **Other browsers' maths.** The fight's own JavaScript math (`Math.sin`, `atan2`, `hypot`) gives the same numbers in
  Node and Chrome (both V8), but Safari and Firefox may differ in the last bit. The hash rounds every number to 2
  decimals, so such a difference only counts once it has grown into something visible (or happens to sit on a
  rounding edge); then the client takes the server's fight. Expect more corrections there; untested so far. If it's
  bad, the fight could use its own sin / cos / atan2.
- **Loading the server's fight puts each collider where its body is**, rather than restoring Rapier's own snapshot
  (12 KB). Rapier's broad phase may then be laid out differently than the server's, which could only matter when a
  sweep touches two wall segments at exactly the same moment; tests that play on after a load, wall included, stay
  identical step for step. If it ever shows, send Rapier's snapshot with `battleSync`.
- Bundle size: the package carries Rapier's WebAssembly as base64 in the JavaScript (about 1.7 MB gzipped, against
  Havok's 0.7 MB). The package with a separate `.wasm` file would be about 0.5 MB smaller gzipped, at the cost of
  loading the file by hand in Vite and Node.
