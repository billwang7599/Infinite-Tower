# Lock-on and swipe-to-swing

Status: **later**, after spells ([spells.md](spells.md)). Nothing is built. Today the player turns the camera, attacks
go where it faces, there's no lock-on, and each swing has its own key.

## Decided by the user

- The camera can lock onto an enemy. A fight starts locked on, and Q toggles the lock off and on (the agent's pick
  of key; Q is free now). Right Shift locks onto the closest enemy, whether locked or not, so blocking moves to Left
  Shift alone.
- Locked, the camera pans to keep the target in view, even if it goes off screen.
- When the locked enemy dies, the lock turns off (it doesn't jump to another enemy).
- The mouse or trackpad steers the sword, locked or not: a swipe's direction picks one of the eight swings. A swipe is
  plain mouse movement, with no button held (not a drag). A click is the stab. With the lock off, swings go where the
  camera faces.
- How readily movement becomes a swing is a sensitivity in Settings.
- The U I O / J K L / M , . swing keys go away; swings come only from the mouse or trackpad.
- The mouse no longer turns the camera by moving. Unlocked, the arrow keys turn and tilt it, and so does dragging
  with the right button held. Locked, a right-button drag does nothing.
- Locked, all four arrows retarget: each picks the enemy nearest the locked one in that direction on screen (left,
  right, up, down), and a tie goes to the closest enemy.
- Q and E are freed from the camera (Q then toggles the lock).
- A mouse or trackpad is required to play: swings come only from it, and the arrow keys move the camera and the
  target.
- AGENTS.md's "no lock-on or auto-aim" rule changes when this is built, not before.

## How it fits

- Mouse look goes away in battle. The pointer lock stays (and so may the auto mouse lock setting): with no button
  held, it's what lets the game read movement without the pointer leaving the window.
- A swipe would be read in the input system (`client/src/core/actions.ts`) and turned into the same attack actions
  the keys make now, so the fight code, netcode and server don't change. A right-button drag is read there too, as
  camera turning, so it never swings.
- Bolt and Beam could aim at the locked enemy.

## Picked by the agent (tune by feel)

- A swipe is mouse movement of at least 40 px within 150 ms; its direction snaps to the nearest of the eight swings
  (45° each). The movement count starts over after each swipe, so one long sweep is one swing.
- The Settings sensitivity scales that distance: 0.5 to 2, default 1 (higher needs less movement, at 2 a 20 px flick).
- Small movements that never reach the distance in time are dropped, so resting a hand on the mouse doesn't swing.
  A swipe is read later than a key press and the parry window is tight, so these numbers are first guesses.
