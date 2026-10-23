/**
 * Shown on load, before anything connects. Play (Enter / Space / J, or a click) asks the game to join; if
 * the server can't be reached the error shows here and Play becomes Retry. Fades out over the field once
 * the game is running.
 */
import { useEffect, useState } from "react";
import type { TitleState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { Backdrop } from "./Backdrop.js";

const PLAY_KEYS = ["Enter", "Space", "KeyJ"];
/** Keep equal to duration-700 on the root. */
const FADE_MS = 700;
const RISE = "animate-rise motion-reduce:animate-none";
const PROGRESS: Partial<Record<TitleState["phase"], string>> = { connecting: "Connecting…", loading: "Loading…" };

export function TitleScreen({ title, play }: { title: Store<TitleState>; play: () => void }) {
  const phase = useStore(title, (s) => s.phase);
  const error = useStore(title, (s) => s.error);
  const [gone, setGone] = useState(false);
  const ready = phase === "menu";

  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (!PLAY_KEYS.includes(e.code)) return;
      e.preventDefault();
      if (!e.repeat) play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, play]);

  useEffect(() => {
    setGone(false);
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Checked with the phase, so going back to the title (Return to title) shows it on the same frame.
  if (gone && phase === "leaving") return null;
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
        {phase !== "failed" && (
          <nav className={`mt-12 ${RISE} [animation-delay:250ms]`}>
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
          </nav>
        )}
        <p id="title-status" className={`mt-6 min-h-5 max-w-md text-sm ${error ? "text-[#ff8f86]" : "text-white/70"}`}>
          {error ?? PROGRESS[phase]}
        </p>
      </main>
    </div>
  );
}
