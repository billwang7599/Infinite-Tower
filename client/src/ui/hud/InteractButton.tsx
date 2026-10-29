import { NO_FOCUS } from "../components/noFocus.js";
import type { Interaction } from "../state.js";
import { REST_BUTTON_BOTTOM_PX, REST_BUTTON_HEIGHT_PX } from "./layout.js";

const INTERACTIONS = {
  rest: { id: "rest-button", label: "Rest by the fire" },
  joinFight: { id: "join-fight-button", label: "Join the fight" },
  openPile: { id: "open-pile-button", label: "Open the pile" },
} as const;

export function InteractButton({ interaction, interact }: { interaction: Interaction | null; interact: () => void }) {
  if (!interaction) return null;
  const { id, label } = INTERACTIONS[interaction];
  return (
    <button
      type="button" id={id} {...NO_FOCUS} onClick={interact}
      style={{ bottom: REST_BUTTON_BOTTOM_PX, height: REST_BUTTON_HEIGHT_PX }}
      className={
        "pointer-events-auto absolute left-1/2 -translate-x-1/2 cursor-pointer rounded-sm border "
        + "border-victory/60 bg-black/60 px-5 py-2 font-title text-lg tracking-[0.08em] text-victory "
        + "transition-colors hover:bg-black/80"
      }
    >
      {label}
    </button>
  );
}
