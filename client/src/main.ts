/**
 * Entry point: mounts the React UI, which opens on the title screen. Play connects to the server, then
 * game/start.ts builds the game; that module is its own chunk, downloading while the title is up.
 *
 *   game/     start-up, mode switching, transitions  net/     server connection
 *   field/    the 2D map mode (+ level renderers)     battle/  the 2.5D arena fight mode (Havok)
 *   core/     keyboard, mouse, frame time             gfx/     procedural textures + pixel-art sprites
 *   ui/       React UI over the canvas (title, HUDs, toasts, fade); the game writes to it through ui/state.ts
 */
import { Connection } from "./net/connection.js";
import { mountUi } from "./ui/mount.js";
import { UiState } from "./ui/state.js";

const loadGame = import("./game/start.js");
// The real handling is where it's awaited, after Play; this only keeps an early failure from being
// reported as unhandled before then.
loadGame.catch(() => {});

const ui = new UiState();

async function play(): Promise<void> {
  if (ui.title.get().phase !== "menu") return;
  ui.title.set({ phase: "connecting", error: null });
  // The server owns the field, encounters and enemies; nothing starts until it says hello.
  const joined = await Connection.open().catch((err: unknown) => {
    ui.title.set({ phase: "menu", error: message(err) });
    return null;
  });
  if (!joined) return;

  try {
    ui.title.set({ phase: "loading" });
    const { startGame } = await loadGame;
    await startGame(ui, joined);
    ui.title.set({ phase: "leaving" });
  } catch (err) {
    console.error(err);
    ui.title.set({ phase: "failed", error: `${message(err)} Reload the page to try again.` });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

mountUi(document.getElementById("ui")!, ui, { play: () => void play() });
