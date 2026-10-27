/** Rapier's deterministic build (the same numbers on every machine), its WebAssembly inside the package. */
import RAPIER from "@dimforge/rapier3d-deterministic-compat";

let loading: Promise<void> | null = null;
let loaded = false;

/** Await it once before making a Fight. Later calls get the first call's promise. */
export function initPhysics(): Promise<void> {
  loading ??= RAPIER.init().then(() => { loaded = true; });
  return loading;
}

export function rapier(): typeof RAPIER {
  if (!loaded) throw new Error("The arena's physics isn't loaded yet: await initPhysics() before making a Fight.");
  return RAPIER;
}
