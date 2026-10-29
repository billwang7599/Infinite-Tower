/**
 * Entry point: mounts the UI (the title screen) and asks the server who's logged in, while game/start.ts (its own
 * chunk) prepares the game behind the title, so Play only has to connect and join.
 */
import { VIEW, type Credentials } from "@infinite-tower/shared";
import { Actions } from "./core/actions.js";
import { Keyboard } from "./core/keyboard.js";
import { Mouse } from "./core/mouse.js";
import { currentAccount, listServers, logIn, logOut, register, SERVER_UNREACHABLE } from "./net/api.js";
import { Net, NotLoggedInError } from "./net/net.js";
import { createSettings } from "./settings/settings.js";
import { mountUi } from "./ui/mount.js";
import { LEAVE_COVERED_MS } from "./ui/screens/title/sequence.js";
import { UiState, type SignInKind } from "./ui/state.js";

// The page frame (#stage) is held to the same widest view as the camera and the server; wider windows get side bars.
document.getElementById("stage")!.style.setProperty("--view-aspect", String(VIEW.maxAspect));

const ui = new UiState();
const settings = createSettings();
const mouse = new Mouse(document.getElementById("game") as HTMLCanvasElement);
const input = new Actions(settings.bindings, new Keyboard(), mouse, settings.mouse);

const preparing = import("./game/start.js").then((m) => m.prepareGame(ui, settings, input));
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
  if (ui.title.get().phase !== "checking") return;
  ui.title.set({ phase: "menu", error: null, ...state });
  if (state.username) void loadServers();
}

async function loadServers(): Promise<void> {
  try {
    const servers = await listServers();
    const picked = ui.title.get().pickedSocket;
    const pickedSocket = servers.some((s) => s.socket === picked) ? picked : servers[0]?.socket ?? null;
    ui.title.set({ servers, pickedSocket });
  } catch (err) {
    ui.title.set({ servers: [], pickedSocket: null, error: message(err) });
  }
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
  await loadServers();
}

async function signOut(): Promise<void> {
  if (ui.title.get().phase !== "menu") return;
  try {
    await logOut();
    ui.title.set({ username: null, error: null, servers: [], pickedSocket: null });
  } catch (err) {
    ui.title.set({ error: message(err) });
  }
}

async function play(): Promise<void> {
  if (ui.title.get().phase !== "menu" || !ui.title.get().username) return;
  if (!pickedServer()) {
    ui.title.set({ error: null });
    await loadServers();
  }
  const server = pickedServer();
  if (!server || ui.title.get().phase !== "menu") return;
  ui.title.set({ phase: "connecting", error: null });
  // The server owns the overworld, encounters and enemies; nothing starts until it says hello.
  const joined = await Net.connect(server.socket).catch((err: unknown) => {
    // The login expired since the page loaded: back to the form.
    if (err instanceof NotLoggedInError) ui.title.set({ phase: "menu", username: null, error: err.message });
    else {
      ui.title.set({ phase: "menu", error: message(err) });
      void loadServers();
    }
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
    joined.net.close();
    fail(err);
  }
}

/** Hangs up and shows the title again, `error` under Retry. The game stops once the title's white covers it. */
async function backToTitle(error: string | null = null): Promise<void> {
  if (ui.title.get().phase === "returning") return;
  const game = await preparing;
  ui.title.set({ phase: "returning", error: null });
  await new Promise((resolve) => setTimeout(resolve, LEAVE_COVERED_MS));
  game.leave();
  ui.title.set({ phase: "menu", error });
  await loadServers();
}

function pickedServer() {
  const { servers, pickedSocket } = ui.title.get();
  return servers.find((s) => s.socket === pickedSocket) ?? null;
}

/** The details ("Failed to fetch", a WebGL error…) go to the console; the title gets a sentence. */
function fail(err: unknown): void {
  console.error(err);
  ui.title.set({ phase: "failed", error: "The game couldn't load. Reload the page to try again." });
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

mountUi(document.getElementById("ui")!, ui, settings, input, {
  signIn: (kind, credentials) => void signIn(kind, credentials),
  logOut: () => void signOut(),
  play: () => void play(),
  saveCharacter: (character) => void preparing.then((game) => game.saveCharacter(character)),
  interact: () => void preparing.then((game) => game.interact()),
  challenge: () => void preparing.then((game) => game.challenge()),
  answerChallenge: (accept) => void preparing.then((game) => game.answerChallenge(accept)),
  useItem: (at) => void preparing.then((game) => game.useItem(at)),
  moveItem: (from, to, turned) => void preparing.then((game) => game.moveItem(from, to, turned)),
  castSkill: (skill) => void preparing.then((game) => game.castSkill(skill)),
  saveSkill: (page, skill) => void preparing.then((game) => game.saveSkill(page, skill)),
  returnToTitle: () => void backToTitle(),
  cheat: (cheat) => void preparing.then((game) => game.cheat(cheat)),
  setDayClock: (change) => void preparing.then((game) => game.setDayClock(change)),
});
