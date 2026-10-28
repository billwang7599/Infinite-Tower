# Swipe-to-swing

Status: **being built**. The lock-on is built (AGENTS.md has what was decided, ARCHITECTURE.md how it works); what's
left is swinging the sword with the mouse. Today each swing still has its own key, and a left click swings left to
right.

## Decided by the user

- The mouse or trackpad steers the sword, locked or not: a swipe's direction picks one of the eight swings. A swipe is
  plain mouse movement, with no button held (not a drag). A click is the stab. With the lock off, swings go where the
  camera faces.
- How readily movement becomes a swing is a sensitivity in Settings.
- The U I O / J K L / M , . swing keys go away; swings come only from the mouse or trackpad.
- A mouse or trackpad is required to play: swings come only from it, and the arrow keys move the camera and the
  target.

## How it fits

- The pointer lock stays (and so may the auto mouse lock setting): with no button held, it's what lets the game read
  movement without the pointer leaving the window. The mouse alone already no longer turns the camera.
- A swipe would be read in the input system (`client/src/core/actions.ts`) and turned into the same attack actions
  the keys make now, so the fight code, netcode and server don't change. A right-button drag (`dragCamera`) turns the
  camera, so it never swings.
- Bolt and Beam could aim at the locked enemy.

## Picked by the agent (tune by feel)

- A swipe is mouse movement of at least 40 px within 150 ms; its direction snaps to the nearest of the eight swings
  (45° each). The movement count starts over after each swipe, so one long sweep is one swing.
- The Settings sensitivity scales that distance: 0.5 to 2, default 1 (higher needs less movement, at 2 a 20 px flick).
- Small movements that never reach the distance in time are dropped, so resting a hand on the mouse doesn't swing.
  A swipe is read later than a key press and the parry window is tight, so these numbers are first guesses.
