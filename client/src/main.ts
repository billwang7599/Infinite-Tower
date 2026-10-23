/**
 * Entry point: mounts the React UI, which opens on the title screen. Meanwhile game/start.ts (its own
 * chunk) downloads and prepares the game behind the title, so Play only has to connect and join.
 *
 *   game/     start-up, mode switching, transitions   net/      server connection
 *   field/    the 2D map mode (+ level renderers)      battle/   the 2.5D arena fight mode (Havok)
 *   core/     keyboard, mouse, frame time              gfx/      procedural textures + pixel-art sprites
 *   settings/ key bindings, saved in the browser       ui/       React UI over the canvas; the game writes to it through ui/state.ts
 */
import { Connection } from "./net/connection.js";
import { KeyBindings } from "./settings/bindings.js";
import { mountUi } from "./ui/mount.js";
import { UiState } from "./ui/state.js";

const ui = new UiState();
const bindings = new KeyBindings();

const preparing = import("./game/start.js").then((m) => m.prepareGame(bindings));
// Failing before Play (no WebGL, say) shows on the title right away; after Play, play() reports it.
preparing.catch((err: unknown) => {
  if (ui.title.get().phase === "menu") fail(err);
});

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
    (await preparing).join(ui, joined);
    ui.title.set({ phase: "leaving" });
  } catch (err) {
    fail(err);
  }
}

/** The details ("Failed to fetch", a WebGL error…) go to the console; the title gets a sentence. */
function fail(err: unknown): void {
  console.error(err);
  ui.title.set({ phase: "failed", error: "The game couldn't load. Reload the page to try again." });
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

mountUi(document.getElementById("ui")!, ui, bindings, { play: () => void play() });
