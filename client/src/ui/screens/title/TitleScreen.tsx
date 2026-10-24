/**
 * Shown on load, before anything connects. Logged out, it's the login form; logged in, Play (Enter / Space / J,
 * or a click) asks the game to join, and Log out is under it. If the server can't be reached the error shows here
 * and Play becomes Retry. Fades out over the field once the game is running.
 */
import { useEffect, useState } from "react";
import type { TitleState, UiActions } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { Backdrop } from "./Backdrop.js";
import { LoginForm } from "./LoginForm.js";

const PLAY_KEYS = ["Enter", "Space", "KeyJ"];
/** Keep equal to duration-700 on the root. */
const FADE_MS = 700;
const RISE = "animate-rise motion-reduce:animate-none";
const PROGRESS: Partial<Record<TitleState["phase"], string>> = {
  signingIn: "Logging in…", connecting: "Connecting…", loading: "Loading…",
};

type Actions = Pick<UiActions, "play" | "signIn" | "logOut">;

export function TitleScreen({ title, actions }: { title: Store<TitleState>; actions: Actions }) {
  const phase = useStore(title, (s) => s.phase);
  const error = useStore(title, (s) => s.error);
  const account = useStore(title, (s) => s.account);
  const [gone, setGone] = useState(false);
  const ready = phase === "menu";
  const { play } = actions;

  useEffect(() => {
    if (!ready || !account) return;
    const onKey = (e: KeyboardEvent) => {
      if (!PLAY_KEYS.includes(e.code)) return;
      e.preventDefault();
      if (!e.repeat) play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, account, play]);

  useEffect(() => {
    setGone(false);
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Checked with the phase, so going back to the title (Return to title) shows it on the same frame.
  if (gone && phase === "leaving") return null;
  const showForm = !account && (phase === "menu" || phase === "signingIn");
  const showPlay = account && phase !== "failed" && phase !== "checking";
  return (
    <div
      id="title-screen"
      className={`fixed inset-0 overflow-hidden bg-night font-ui text-white select-none transition-opacity duration-700 ${
        phase === "leaving" ? "pointer-events-none opacity-0" : ""
      }`}
    >
      <Backdrop />
      <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/20 to-transparent" />
      <main className="absolute inset-y-0 left-[8vw] flex flex-col justify-center">
        <header className={RISE}>
          <p className="mb-4 text-[13px] tracking-[0.5em] text-white/55 uppercase">A climb without end</p>
          <h1 className="font-title text-[clamp(48px,7.5vw,104px)] leading-[0.92] font-normal tracking-[0.06em] text-victory text-shadow-title">
            Infinite
            <br />
            Tower
          </h1>
        </header>
        <div className={`mt-12 ${RISE} [animation-delay:250ms]`}>
          {showForm && <LoginForm busy={phase === "signingIn"} submit={actions.signIn} />}
          {showPlay && (
            <nav className="flex flex-col items-start gap-3">
              <button
                type="button"
                disabled={!ready}
                // Keeps focus off the button, so Enter / Space go to the window listener and can't click it twice.
                onMouseDown={(e) => e.preventDefault()}
                onClick={play}
                className="flex cursor-pointer items-center gap-3 py-1 font-title text-[28px] tracking-[0.12em] transition-opacity duration-150 disabled:cursor-default disabled:opacity-40"
              >
                <span className="text-sm text-victory">◆</span>
                {error ? "Retry" : "Play"}
              </button>
              <p id="title-account" className="text-sm text-white/60">
                Logged in as <span className="text-white">{account}</span>
                <span className="mx-2 text-white/30">·</span>
                <button
                  type="button" disabled={!ready} onMouseDown={(e) => e.preventDefault()} onClick={actions.logOut}
                  className="cursor-pointer underline-offset-4 hover:text-white hover:underline disabled:cursor-default disabled:opacity-40"
                >
                  Log out
                </button>
              </p>
            </nav>
          )}
        </div>
        <p id="title-status" className={`mt-6 min-h-5 max-w-md text-sm ${error ? "text-[#ff8f86]" : "text-white/70"}`}>
          {error ?? PROGRESS[phase]}
        </p>
      </main>
    </div>
  );
}
