/** Components every mode uses. */
import { defineComponent } from "./ecs.js";

/** Marks the player controlled on this machine: the field walker and the arena fighter both carry it. */
export const LocalPlayer = defineComponent<true>("LocalPlayer");
