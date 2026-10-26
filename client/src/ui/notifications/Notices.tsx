import { REST_BUTTON_BOTTOM_PX, REST_BUTTON_HEIGHT_PX } from "../hud/layout.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { DismissButton } from "./DismissButton.js";
import type { Notice, NoticesState } from "./state.js";
import { useFadeOut } from "./useFadeOut.js";

const SHOW_MS = 8000;
const FADE_MS = 500;
/** From the stage's edges, and from what the notices keep clear of. */
const MARGIN_PX = 16;

type Dismiss = (id: number) => void;

interface NoticesProps {
  notices: Store<NoticesState>;
  dismiss: Dismiss;
  /** The open side panel's width, or null: the stack moves to its left, so it never covers the bag. */
  besidePanelPx: number | null;
  /** The Rest button is up (bottom centre): the stack rises above it, which narrow windows and the bag need. */
  aboveRestButton: boolean;
}

/** The small notices, stacked in the bottom-right corner, newest at the bottom. Only their × takes clicks. */
export function Notices({ notices, dismiss, besidePanelPx, aboveRestButton }: NoticesProps) {
  const items = useStore(notices, (s) => s.items);
  const rightPx = besidePanelPx === null ? MARGIN_PX : besidePanelPx + 2 * MARGIN_PX;
  const bottomPx = aboveRestButton ? REST_BUTTON_BOTTOM_PX + REST_BUTTON_HEIGHT_PX + MARGIN_PX : MARGIN_PX;
  return (
    <div
      id="notices"
      style={{ right: rightPx, bottom: bottomPx, maxWidth: `calc(100% - ${rightPx + MARGIN_PX}px)` }}
      className="pointer-events-none absolute flex w-80 flex-col items-end transition-[right,bottom] duration-300"
    >
      {items.map((n) => (
        <NoticeRow key={n.id} notice={n} dismiss={dismiss} />
      ))}
    </div>
  );
}

/**
 * Fades in, holds for SHOW_MS, then fades out while its row collapses (so the ones above settle down), then
 * dismisses itself. The ×, or being pushed out by newer ones (`leaving`), skips to the fade out.
 */
function NoticeRow({ notice, dismiss }: { notice: Notice; dismiss: Dismiss }) {
  const { leaving, leave } = useFadeOut(notice.id, dismiss, SHOW_MS, FADE_MS, notice.leaving);
  return (
    // grid-rows 1fr -> 0fr collapses the row smoothly; starting: is the first frame, so it also fades / grows in.
    <div
      data-notice
      style={{ transitionDuration: `${FADE_MS}ms` }}
      className={`grid max-w-full transition-all starting:grid-rows-[0fr] starting:opacity-0 ${
        leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}
    >
      {/* overflow-hidden for the collapse; the gap above is inside it, so that collapses too */}
      <div className="min-h-0 overflow-hidden">
        <div className="mt-2 flex items-start gap-2 rounded-sm bg-black/55 py-1.5 pr-1.5 pl-3 text-white">
          <span className="min-w-0 font-title text-[17px]/snug tracking-wide wrap-break-word text-shadow-hud">
            {notice.text}
          </span>
          <DismissButton onClick={leave} />
        </div>
      </div>
    </div>
  );
}
