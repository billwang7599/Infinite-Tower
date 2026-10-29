/**
 * Shown on load, before anything connects. Logged out, it's the login form; logged in, the game servers to pick
 * from, and Play (a MENUS key or a click) asks the game to join the picked one, and Log out is under it. If the
 * server can't be reached the error shows here and Play becomes Retry.
 *
 * Joining plays the enter sequence (sequence.ts; the camera's path is backdrop/path.ts): the text fades, the view
 * glides into the tower to its middle, looks straight up it, and rushes up it, faster and faster, while the server
 * loads the player; then a white flash clears over the world. Return to title plays it backwards.
 */
import { useEffect } from "react";
import type { Actions } from "../../../core/actions.js";
import { keepFocus } from "../../components/noFocus.js";
import { useAction } from "../../components/useAction.js";
import type { TitleState, UiActions } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { Backdrop } from "./backdrop/Backdrop.js";
import { LoginForm } from "./LoginForm.js";
import { MenuButton } from "./MenuButton.js";
import { ServerList } from "./ServerList.js";
import { stageMs, type Stage } from "./sequence.js";
import { LINK } from "./styles.js";
import { useReducedMotion, useSequence } from "./useSequence.js";

const RISE = "animate-rise motion-reduce:animate-none";
const PROGRESS: Partial<Record<TitleState["phase"], string>> = {
  signingIn: "Logging in…", connecting: "Connecting…", loading: "Loading…", entering: "Entering…",
};

/** The stages the scene shows in (the camera moves are its own: backdrop/path.ts), and the white over it. */
const SCENE: readonly Stage[] = ["menu", "fade", "approach", "lookUp", "rush", "flash", "rushOut", "pullBack"];
const WHITE: Partial<Record<Stage, string>> = {
  flash: "animate-white-in", reveal: "animate-white-in [animation-direction:reverse]",
  whiteout: "animate-white-in", rushOut: "animate-white-in [animation-direction:reverse]",
};

/** What the rush is waiting on, under it. */
const PROGRESS_LINE =
  "absolute inset-x-0 bottom-[14%] animate-white-in text-center text-xs tracking-[0.5em] text-white/60 uppercase";

type TitleActions = Pick<UiActions, "play" | "signIn" | "logOut">;

interface TitleProps {
  title: Store<TitleState>;
  input: Actions;
  actions: TitleActions;
}

export function TitleScreen({ title, input, actions }: TitleProps) {
  const phase = useStore(title, (s) => s.phase);
  const error = useStore(title, (s) => s.error);
  const username = useStore(title, (s) => s.username);
  const servers = useStore(title, (s) => s.servers);
  const pickedSocket = useStore(title, (s) => s.pickedSocket);
  const stage = useSequence(phase);
  const still = useReducedMotion();
  const ready = phase === "menu" && stage === "menu";

  useAction(input, ["play"], (_action, repeat) => {
    if (!ready || !username) return false;
    if (!repeat) actions.play();
  });

  // The title has cleared off the world: it's the player's now.
  useEffect(() => {
    if (stage === "done" && title.get().phase === "entering") title.set({ phase: "playing" });
  }, [stage, title]);

  if (stage === "done" || phase === "playing") return null;
  const ms = stageMs(stage);
  const showForm = !username && (phase === "menu" || phase === "signingIn");
  const showPlay = !!username && phase !== "failed" && phase !== "checking";
  return (
    <div
      id="title-screen" data-stage={stage}
      className={`fixed inset-0 overflow-hidden font-ui text-white select-none ${
        stage === "menu" ? "" : "pointer-events-none"
      }`}
    >
      {SCENE.includes(stage) && <Backdrop stage={stage} still={still} />}
      {(stage === "lookUp" || stage === "rush") && (
        <p id="title-progress" className={PROGRESS_LINE}>
          {PROGRESS[phase]}
        </p>
      )}
      {stage in WHITE && (
        <div key={stage} className={`absolute inset-0 bg-white ${WHITE[stage]}`}
          style={{ animationDuration: `${ms}ms` }} />
      )}

      {(stage === "menu" || stage === "fade") && (
        <div className={`absolute inset-0 ${stage === "fade" ? "animate-title-out" : ""}`}
          style={{ animationDuration: `${ms}ms` }}>
          <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/20 to-transparent" />
          <main className="absolute inset-y-0 left-[8vw] flex flex-col justify-center">
            <header className={RISE}>
              <p className="mb-4 text-[13px] tracking-[0.5em] text-white/55 uppercase">A climb without end</p>
              <h1
                className={
                  "font-title text-[clamp(48px,7.5vw,104px)] leading-[0.92] font-normal tracking-[0.06em] "
                  + "text-victory text-shadow-title"
                }
              >
                Infinite
                <br />
                Tower
              </h1>
            </header>
            <div className={`mt-12 ${RISE} [animation-delay:250ms]`}>
              {showForm && <LoginForm busy={phase === "signingIn"} submit={actions.signIn} />}
              {showPlay && servers.length > 0 && (
                <ServerList servers={servers} picked={pickedSocket} disabled={!ready}
                  pick={(socket) => title.set({ pickedSocket: socket })} />
              )}
              {showPlay && (
                <nav className="mt-5 flex flex-col items-start gap-3">
                  {/* Never focused: Enter / Space go to the play keys, and can't also click it. */}
                  <MenuButton type="button" disabled={!ready} onMouseDown={keepFocus} onClick={actions.play}>
                    {error ? "Retry" : "Play"}
                  </MenuButton>
                  <p id="title-account" className="text-sm text-white/60">
                    Logged in as <span className="text-white">{username}</span>
                    <span className="mx-2 text-white/30">·</span>
                    <button
                      type="button" disabled={!ready} onMouseDown={keepFocus} onClick={actions.logOut}
                      className={LINK}
                    >
                      Log out
                    </button>
                  </p>
                </nav>
              )}
            </div>
            <p id="title-status" className={`mt-6 min-h-5 max-w-md text-sm ${error ? "text-error" : "text-white/70"}`}>
              {error ?? PROGRESS[phase]}
            </p>
          </main>
        </div>
      )}
    </div>
  );
}
