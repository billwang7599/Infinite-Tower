import type { CoreState, Gear, ShopView, UseSpot } from "@infinite-tower/shared";
import { coreStats } from "@infinite-tower/shared";
import { useMemo, type ReactNode } from "react";
import { useGame } from "../context.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { PlayerBars } from "../components/PlayerBars.js";
import { useAction } from "../components/useAction.js";
import { SkillbookScreen } from "../skills/SkillbookScreen.js";
import type { Interaction, Panel, StatusIcon, UiState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { CharacterPanel } from "./character/CharacterPanel.js";
import { HudLayer } from "./HudLayer.js";
import { InventoryPanel } from "./inventory/InventoryPanel.js";
import { REST_BUTTON_BOTTOM_PX, REST_BUTTON_HEIGHT_PX } from "./layout.js";
import { Ping } from "./Ping.js";
import { StatusRow } from "./StatusRow.js";

interface ModeHudState {
  hpFraction: number;
  staminaFraction: number;
  hp?: number;
  hpMax?: number;
  statuses?: readonly StatusIcon[];
  interaction: Interaction | null;
}

export interface BagView {
  gear: Gear;
  using: UseSpot | null;
  canHeal: boolean;
  shop?: ShopView | null;
  writingPage?: number | null;
}

export interface HudMode {
  hud: (ui: UiState) => Store<ModeHudState>;
  panels: readonly Panel[];
  useBag: () => BagView;
  bagOpens?: (ui: UiState) => boolean;
}

interface HudProps {
  id: string;
  mode: HudMode;
  aboveBars?: ReactNode;
  beforePing?: ReactNode;
  afterPing?: ReactNode;
  children?: ReactNode;
}

export function Hud({ id, mode, aboveBars, beforePing, afterPing, children }: HudProps) {
  const { ui, input, actions } = useGame();
  const hud = mode.hud(ui);
  const open = useStore(ui.panel, (s) => s.open);
  const interaction = useStore(hud, (s) => s.interaction);
  const shownWidth = (widthPx: number) => ui.panel.set({ widthPx });
  useAction(input, ["character", "inventory"], (panel, repeat) => {
    if (repeat || !mode.panels.includes(panel)) return;
    if (panel === open || panel !== "inventory" || (mode.bagOpens?.(ui) ?? true)) ui.togglePanel(panel);
  });
  useAction(input, ["interact"], (_action, repeat) => {
    if (!repeat) actions.interact();
  });
  return (
    <HudLayer id={id}>
      <div className="absolute top-3 left-4">
        {aboveBars}
        <Vitals hud={hud} />
      </div>
      <div className="absolute top-3 right-4 flex items-center gap-3">
        {beforePing}
        <Ping />
        {afterPing}
      </div>
      {children}
      <InteractButton interaction={interaction} interact={actions.interact} />
      {open === "character" && mode.panels.includes("character") && (
        <CharacterPanel close={ui.closePanel} shownWidth={shownWidth} />
      )}
      {mode.panels.includes("inventory") && <Bag useBag={mode.useBag} shownWidth={shownWidth} />}
    </HudLayer>
  );
}

function Vitals({ hud }: { hud: Store<ModeHudState> }) {
  const hpFraction = useStore(hud, (s) => s.hpFraction);
  const staminaFraction = useStore(hud, (s) => s.staminaFraction);
  const hp = useStore(hud, (s) => s.hp);
  const hpMax = useStore(hud, (s) => s.hpMax);
  const statuses = useStore(hud, (s) => s.statuses);
  return (
    <>
      <PlayerBars hpFraction={hpFraction} staminaFraction={staminaFraction} hp={hp} hpMax={hpMax} />
      {statuses && <StatusRow id="my-statuses" icons={statuses} className="mt-1 w-75" />}
    </>
  );
}

function Bag({ useBag, shownWidth }: { useBag: () => BagView; shownWidth: (px: number) => void }) {
  const { ui } = useGame();
  const open = useStore(ui.panel, (s) => s.open === "inventory");
  const bookOpen = useStore(ui.skillbookScreen, (s) => s.open);
  const core = useStore(ui.you, (s) => s.core);
  const stats = useMemo(() => core && coreStats(core), [core]);
  const { gear, using, canHeal, shop, writingPage } = useBag();
  if (!open) return null;
  return (
    <>
      <InventoryPanel
        gear={gear} stats={stats} canHeal={canHeal} using={using} close={ui.closePanel}
        trade={tradeOf(shop, core)} shownWidth={shownWidth}
      />
      {bookOpen && <SkillbookScreen writingPage={writingPage} />}
    </>
  );
}

const tradeOf = (shop: ShopView | null | undefined, core: CoreState | null) => (shop && core ? { shop, core } : null);

const INTERACTIONS = {
  rest: { id: "rest-button", label: "Rest by the fire" },
  joinFight: { id: "join-fight-button", label: "Join the fight" },
  openPile: { id: "open-pile-button", label: "Open the pile" },
  talk: { id: "talk-button", label: "Talk" },
  look: { id: "look-button", label: "Look" },
  bindPad: { id: "bind-pad-button", label: "Bind to this pad" },
} as const;

function InteractButton({ interaction, interact }: { interaction: Interaction | null; interact: () => void }) {
  if (!interaction) return null;
  const { id, label } = INTERACTIONS[interaction];
  return (
    <button
      type="button" id={id} {...NO_FOCUS} onClick={interact}
      style={{ bottom: REST_BUTTON_BOTTOM_PX, height: REST_BUTTON_HEIGHT_PX }}
      className={
        "pointer-events-auto absolute left-1/2 -translate-x-1/2 cursor-pointer clip-pointed bg-stone/85 px-9 "
        + "text-sm tracking-[0.3em] uppercase transition-colors [--point:12px] hover:bg-stone hover:text-cinnabar"
      }
    >
      {label}
    </button>
  );
}
