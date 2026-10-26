import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import type { AnnouncementState, Message } from "./state.js";
import { useFadeOut } from "./useFadeOut.js";

const SHOW_MS = 1800;
const FADE_MS = 500;

type Dismiss = (id: number) => void;

/** The big centre banner (a fight starting). One at a time: a new one replaces the one up. */
export function Announcement({ announcement, dismiss }: { announcement: Store<AnnouncementState>; dismiss: Dismiss }) {
  const current = useStore(announcement, (s) => s.current);
  return (
    <div
      id="announcement"
      className="pointer-events-none absolute top-[22%] left-1/2 flex w-4/5 -translate-x-1/2 justify-center"
    >
      {current && <Banner key={current.id} message={current} dismiss={dismiss} />}
    </div>
  );
}

/** Fades in, holds for SHOW_MS, fades out, then dismisses itself. No ×: it only ever goes on its own. */
function Banner({ message, dismiss }: { message: Message; dismiss: Dismiss }) {
  const { leaving } = useFadeOut(message.id, dismiss, SHOW_MS, FADE_MS);
  return (
    // Wraps (balanced) inside the stage's middle 80% instead of running off it.
    <div
      data-announcement
      style={{ transitionDuration: `${FADE_MS}ms` }}
      className={
        "min-w-0 px-4 pt-1 pb-2 text-center font-title text-3xl text-balance tracking-wider text-white "
        + `text-shadow-[0_2px_8px_#000] transition-opacity starting:opacity-0 ${leaving ? "opacity-0" : "opacity-100"}`
      }
    >
      {message.text}
    </div>
  );
}
