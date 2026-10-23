import type { ScreenState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

/** The full-screen flash/fade layer. game/transition.ts animates it frame by frame. */
export function Fade({ screen }: { screen: Store<ScreenState> }) {
  const color = useStore(screen, (s) => s.fadeColor);
  const opacity = useStore(screen, (s) => s.fadeOpacity);
  return <div id="fade" className="pointer-events-none fixed inset-0" style={{ background: color, opacity }} />;
}
