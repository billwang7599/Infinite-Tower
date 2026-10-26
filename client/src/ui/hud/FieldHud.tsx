import type { Cell } from "@infinite-tower/shared";
import { useState, type ReactNode } from "react";
import type { KeyBindings } from "../../settings/bindings.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { PlayerBars } from "../components/PlayerBars.js";
import type { FieldHudState, SettingsScreenState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { CharacterPanel } from "./character/CharacterPanel.js";
import { HudLayer } from "./HudLayer.js";
import { BagIcon, GearIcon, PersonIcon } from "./icons.js";
import { InventoryPanel } from "./inventory/InventoryPanel.js";
import { usePanelKeys, type Panel } from "./panelKeys.js";

type HudProps = { hud: Store<FieldHudState> };

interface FieldHudProps extends HudProps {
  bindings: KeyBindings;
  settingsScreen: Store<SettingsScreenState>;
  openSettings: () => void;
  rest: () => void;
  useItem: (at: Cell) => void;
}

/** One side panel at a time (character or inventory); neither blocks walking. */
export function FieldHud(props: FieldHudProps) {
  const { hud, bindings, settingsScreen, openSettings, rest, useItem } = props;
  const [panel, setPanel] = useState<Panel | null>(null);
  const toggle = (p: Panel) => setPanel((open) => (open === p ? null : p));
  const close = () => setPanel(null);
  usePanelKeys(bindings, [settingsScreen], toggle);

  return (
    <HudLayer id="field-hud">
      <PlayerStatus hud={hud} />
      <div className="absolute top-3 right-4 flex items-center gap-3">
        <LevelName hud={hud} />
        <HudButton id="inventory-button" label="Inventory" onClick={() => toggle("inventory")}>
          <BagIcon />
        </HudButton>
        <HudButton id="character-button" label="Character" onClick={() => toggle("character")}>
          <PersonIcon />
        </HudButton>
        <HudButton id="settings-button" label="Settings" onClick={openSettings}>
          <GearIcon />
        </HudButton>
      </div>
      <RestButton hud={hud} rest={rest} />
      {panel === "character" && <CharacterPanel hud={hud} close={close} />}
      {panel === "inventory" && <InventoryPanel hud={hud} use={useItem} close={close} />}
    </HudLayer>
  );
}

function PlayerStatus({ hud }: HudProps) {
  const name = useStore(hud, (s) => s.character?.name);
  const hpFraction = useStore(hud, (s) => s.hpFraction);
  const staminaFraction = useStore(hud, (s) => s.staminaFraction);
  const wins = useStore(hud, (s) => s.wins);
  return (
    <div className="absolute top-3 left-4">
      {name && <div id="field-name" className="mb-1 font-title text-[15px] tracking-wide">{name}</div>}
      <PlayerBars hpFraction={hpFraction} staminaFraction={staminaFraction} />
      <div id="field-wins" className="text-[13px] font-normal">
        Boars defeated: <span className="font-semibold text-victory">{wins}</span>
      </div>
    </div>
  );
}

/** Only by a campfire. Names what it does, not a key: the key is in Settings. */
function RestButton({ hud, rest }: HudProps & { rest: () => void }) {
  const near = useStore(hud, (s) => s.nearCampfire);
  if (!near) return null;
  return (
    <button
      type="button" id="rest-button" {...NO_FOCUS} onClick={rest}
      className={
        "pointer-events-auto absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer rounded-sm border "
        + "border-victory/60 bg-black/60 px-5 py-2 font-title text-lg tracking-[0.08em] text-victory "
        + "transition-colors hover:bg-black/80"
      }
    >
      Rest by the fire
    </button>
  );
}

function LevelName({ hud }: HudProps) {
  const name = useStore(hud, (s) => s.levelName);
  return <div id="field-level" className="font-title text-[17px] font-medium tracking-wide">{name}</div>;
}

interface HudButtonProps {
  id: string;
  label: string;
  onClick: () => void;
  children: ReactNode;
}

function HudButton({ id, label, onClick, children }: HudButtonProps) {
  return (
    <button
      type="button" id={id} aria-label={label} {...NO_FOCUS} onClick={onClick}
      className={
        "pointer-events-auto flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/40 "
        + "text-white/80 transition-colors hover:bg-black/60 hover:text-white"
      }
    >
      {children}
    </button>
  );
}
