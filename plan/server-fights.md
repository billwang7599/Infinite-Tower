# Multiplayer and fights on the server: what's left

Status: **later**. Built: one shared overworld, a server list, duels, joining fights, and fights the server runs and
decides while each browser runs its own copy (ARCHITECTURE.md, "The fight" and "Networking").

## Open

- **Timing cheats within the late window.** An input may reach the server late and still run on its own step, so a
  client could hold inputs back and decide them with more of the fight in view. A smaller window means more
  corrections on bad connections. Worth a look once there's PvP or anything to win.
- **Latency budgets** for parry and perfect-block windows in PvP: a reactable window shrinks by the ping.
- **Corrections are snaps, eased**: a hit the client hadn't seen coming can still pop. Real jitter will tell.
- **Other browsers' maths**: Safari and Firefox may differ in the last bit; the hash's rounding hides small drift.
  Untested; if bad, the fight could use its own trigonometry.
- **Bandwidth and bundle size**: the upload could shrink with smaller inputs; Rapier's WebAssembly could load as a
  separate file.
- **A hidden tab** stops its fight; the server lets go of its keys and it catches up on return.
- More than one overworld (channels), and parties bigger than a shared battle.
- Parked (the user asked to note it): geckos.io, game messages over WebRTC, only if latency turns out to matter.
