/**
 * Entry point: mounts the React UI, which opens on the title screen and asks the server who's logged in.
 * Meanwhile game/start.ts (its own chunk) downloads and prepares the game behind the title, so Play only has to
 * connect and join.
 *
 *   game/     start-up, sessions, mode switching       net/      server connection, the account API
 *   field/    the 2D map mode (+ level renderers)      battle/   the 2.5D arena fight mode (Havok)
 *   core/     keyboard, mouse, frame time              gfx/      procedural textures + pixel-art sprites
 *   settings/ key bindings, camera (kept on server)    ui/       React UI over the canvas (the game writes to
 *                                                                it through ui/state.ts)
 */
import { VIEW, type Credentials } from "@infinite-tower/shared";
import { currentAccount, logIn, logOut, register } from "./net/account.js";
import { Connection, NotLoggedInError, SERVER_UNREACHABLE } from "./net/connection.js";
import { createSettings } from "./settings/settings.js";
import { mountUi } from "./ui/mount.js";
import { LEAVE_COVERED_MS } from "./ui/screens/title/sequence.js";
import { UiState, type SignInKind } from "./ui/state.js";

// The page frame (#stage) is held to the same widest view as the camera and the server; wider windows get side bars.
document.getElementById("stage")!.style.setProperty("--view-aspect", String(VIEW.maxAspect));

const ui = new UiState();
const settings = createSettings();

const preparing = import("./game/start.js").then((m) => m.prepareGame(ui, settings));
// Failing before Play (no WebGL, say) shows on the title right away; after Play, play() reports it.
preparing.catch((err: unknown) => {
  if (["checking", "menu", "signingIn"].includes(ui.title.get().phase)) fail(err);
});

currentAccount().then(
  (account) => settle({ username: account?.username ?? null }),
  () => settle({ username: null, error: SERVER_UNREACHABLE }),
);
/** Unless preparing the game already failed. */
function settle(state: { username: string | null; error?: string }): void {
  if (ui.title.get().phase === "checking") ui.title.set({ phase: "menu", error: null, ...state });
}

async function signIn(kind: SignInKind, credentials: Credentials): Promise<void> {
  if (ui.title.get().phase !== "menu") return;
  ui.title.set({ phase: "signingIn", error: null });
  try {
    const account = await (kind === "login" ? logIn : register)(credentials);
    ui.title.set({ phase: "menu", username: account.username });
  } catch (err) {
    ui.title.set({ phase: "menu", error: message(err) });
    return;
  }
  await play();
}

async function signOut(): Promise<void> {
  if (ui.title.get().phase !== "menu") return;
  try {
    await logOut();
    ui.title.set({ username: null, error: null });
  } catch (err) {
    ui.title.set({ error: message(err) });
  }
}

async function play(): Promise<void> {
  if (ui.title.get().phase !== "menu" || !ui.title.get().username) return;
  ui.title.set({ phase: "connecting", error: null });
  // The server owns the field, encounters and enemies; nothing starts until it says hello.
  const joined = await Connection.open().catch((err: unknown) => {
    // The login expired since the page loaded: back to the form.
    if (err instanceof NotLoggedInError) ui.title.set({ phase: "menu", username: null, error: err.message });
    else ui.title.set({ phase: "menu", error: message(err) });
    return null;
  });
  if (!joined) return;

  try {
    ui.title.set({ phase: "loading" });
    (await preparing).join(joined);
    ui.title.set({ phase: "entering" });
    // Also catches a connection that dropped while the game was loading.
    joined.net.onLost((reason) => void backToTitle(reason));
  } catch (err) {
    fail(err);
  }
}

/**
 * Leaves the world (hanging up on the server) and shows the title again, with `error` under Retry. The game stops
 * once the title's white covers it, so the field never blinks out in view.
 */
async function backToTitle(error: string | null = null): Promise<void> {
  if (ui.title.get().phase === "returning") return;
  const game = await preparing;
  ui.title.set({ phase: "returning", error: null });
  await new Promise((resolve) => setTimeout(resolve, LEAVE_COVERED_MS));
  game.leave();
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
  signIn: (kind, credentials) => void signIn(kind, credentials),
  logOut: () => void signOut(),
  play: () => void play(),
  saveCharacter: (character) => void preparing.then((game) => game.saveCharacter(character)),
  rest: () => void preparing.then((game) => game.rest()),
  useItem: (at) => void preparing.then((game) => game.useItem(at)),
  moveItem: (from, to, turned) => void preparing.then((game) => game.moveItem(from, to, turned)),
  returnToTitle: () => void backToTitle(),
});
