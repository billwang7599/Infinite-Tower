import type { ScreenState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

/** A startup failure (e.g. the server is down), shown over everything. */
export function ErrorMessage({ screen }: { screen: Store<ScreenState> }) {
  const error = useStore(screen, (s) => s.error);
  if (error === null) return null;
  return (
    <pre id="error" className="fixed inset-x-0 top-0 m-0 p-4 font-mono text-sm whitespace-pre-wrap text-[#f88]">
      {error}
    </pre>
  );
}
