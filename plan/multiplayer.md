# Multiplayer

Status: **direction**. The final game is multiplayer; the prototype is single-player on purpose. Nothing about how
it plays is decided.

## Where things stand

- The server is already authoritative for the field, and every player has an account and a save. Each player has
  their own `GameSession` with their own world: players can't see each other yet.
- A second tab on the same account takes over the first (close code 4000).
- Fights run in the browser, so they'd have to move to the server first ([server-fights.md](server-fights.md)).

## Open questions

- Do players share a field (see each other walk around), and how many per field or floor (channels)?
- Can players join each other's fights? How big is a party ([vision.md](vision.md))?
- PvP or not.
- What `state` carries when there are other players nearby (it already only sends what's near your screen).

## Parked: geckos.io

[geckos.io](https://github.com/geckosio/geckos.io) sends game messages over WebRTC data channels (UDP-like: no
waiting for a lost packet to be resent). The user asked to note it down. Worth a look only if multiplayer latency
turns out to matter; until then game messages stay on plain `ws` (`server/src/ws/`).
