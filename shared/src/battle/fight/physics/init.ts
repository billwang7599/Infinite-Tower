/**
 * Loading the arena's physics engine: Rapier's deterministic build (the same numbers on every machine), with its
 * WebAssembly inside the package, so Node and the browser load it the same way. Await initPhysics() once before
 * making a Fight; the client does it while the title is up (game/start.ts), so a fight never waits for it.
 */
import RAPIER from "@dimforge/rapier3d-deterministic-compat";

let loading: Promise<void> | null = null;
let loaded = false;

/** Loads Rapier. Later calls get the first call's promise. */
export function initPhysics(): Promise<void> {
  loading ??= RAPIER.init().then(() => { loaded = true; });
  return loading;
}

/** Rapier, once loaded. */
export function rapier(): typeof RAPIER {
  if (!loaded) throw new Error("The arena's physics isn't loaded yet: await initPhysics() before making a Fight.");
  return RAPIER;
}
