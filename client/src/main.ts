/**
 * Entry point: mounts the React UI, which opens on the title screen. Meanwhile game/start.ts (its own
 * chunk) downloads and prepares the game behind the title, so Play only has to connect and join.
 *
 *   game/     start-up, sessions, mode switching       net/      server connection
 *   field/    the 2D map mode (+ level renderers)      battle/   the 2.5D arena fight mode (Havok)
 *   core/     keyboard, mouse, frame time              gfx/      procedural textures + pixel-art sprites
 *   settings/ key bindings, camera, saved in browser   ui/       React UI over the canvas; the game writes to it through ui/state.ts
 */
import { VIEW } from "@infinite-tower/shared";
import { Connection } from "./net/connection.js";
import { loadSettings } from "./settings/settings.js";
import { mountUi } from "./ui/mount.js";
import { UiState } from "./ui/state.js";

// The page frame (#stage) is held to the same widest view as the camera and the server; wider windows get side bars.
document.getElementById("stage")!.style.setProperty("--view-aspect", String(VIEW.maxAspect));

const ui = new UiState();
const settings = loadSettings();

const preparing = import("./game/start.js").then((m) => m.prepareGame(ui, settings));
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
    (await preparing).join(joined, () => void backToTitle("Lost the connection to the game server."));
    ui.title.set({ phase: "leaving" });
  } catch (err) {
    fail(err);
  }
}

/** Leaves the world (hanging up on the server) and shows the title again, with `error` under Retry. */
async function backToTitle(error: string | null = null): Promise<void> {
  (await preparing).leave();
  ui.title.set({ phase: "menu", error });
}

/** The details ("Failed to fetch", a WebGL error…) go to the console; the title gets a sentence. */
function fail(err: unknown): void {
  console.error(err);
  ui.title.set({ phase: "failed", error: "The game couldn't load. Reload the page to try again." });
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

mountUi(document.getElementById("ui")!, ui, settings, {
  play: () => void play(),
  returnToTitle: () => void backToTitle(),
});
