import {
  coreStats, type CoinId, type ItemId, type ShopView, type ShownStat, type Skill, type Spot, type UseSpot,
  type WeaponId,
} from "@infinite-tower/shared";
import { useMemo, type ReactNode } from "react";
import type { Actions } from "../../core/actions.js";
import type { HudSettings } from "../../settings/hud.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { BUTTON } from "../components/styles.js";
import { PlayerBars } from "../components/PlayerBars.js";
import { useAction } from "../components/useAction.js";
import { SkillbookScreen } from "../skills/SkillbookScreen.js";
import type {
  OverworldPanel, OverworldHudState, OverworldPanelState, PingState, SettingsScreenState, SkillsState,
} from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { CharacterPanel } from "./character/CharacterPanel.js";
import { HudLayer } from "./HudLayer.js";
import { BagIcon, BookIcon, GearIcon, PersonIcon } from "./icons.js";
import { InventoryPanel } from "./inventory/InventoryPanel.js";
import { InteractButton } from "./InteractButton.js";
import { Ping } from "./Ping.js";

type HudProps = { hud: Store<OverworldHudState> };

interface OverworldHudProps extends HudProps {
  input: Actions;
  ping: Store<PingState>;
  hudSettings: HudSettings;
  settingsScreen: Store<SettingsScreenState>;
  panels: Store<OverworldPanelState>;
  togglePanel: (panel: OverworldPanel) => void;
  closePanel: () => void;
  openSettings: () => void;
  interact: () => void;
  useItem: (at: UseSpot) => void;
  moveItem: (from: Spot, to: Spot, turned: boolean) => void;
  tooWeak: (item: WeaponId) => void;
  skills: Store<SkillsState>;
  skillbookScreen: Store<{ open: boolean }>;
  saveSkill: (page: number, skill: Skill) => void;
  challenge: Store<{ from: string | null }>;
  challengeNearest: () => void;
  answerChallenge: (accept: boolean) => void;
  toggleQuestbook: () => void;
  statPoint: (stat: ShownStat, add: boolean) => void;
  shop: Store<{ view: ShopView | null }>;
  buy: (item: ItemId) => void;
  sell: (at: UseSpot, count: number) => void;
  exchange: (from: CoinId, to: CoinId) => void;
}

/** One side panel at a time (character or inventory). The bag stops you walking while it's open; see state.ts. */
export function OverworldHud(props: OverworldHudProps) {
  const { hud, input, settingsScreen, panels, togglePanel: toggle, closePanel: close, openSettings, interact } = props;
  const panel = useStore(panels, (s) => s.open);
  const bookOpen = useStore(props.skillbookScreen, (s) => s.open);
  const gear = useStore(hud, (s) => s.gear);
  const core = useStore(hud, (s) => s.core);
  const stats = useMemo(() => core && coreStats(core), [core]);
  const fullHp = useStore(hud, (s) => s.hpFraction >= 1);
  const using = useStore(hud, (s) => s.using);
  const interaction = useStore(hud, (s) => s.interaction);
  const shop = useStore(props.shop, (s) => s.view);
  const showBook = (open: boolean) => props.skillbookScreen.set({ open });
  useAction(input, ["character", "inventory"], (panel, repeat) => {
    if (!repeat) toggle(panel);
  });
  useAction(input, ["interact"], (_action, repeat) => {
    if (!repeat) interact();
  });
  useAction(input, ["challenge"], (_action, repeat) => {
    if (!repeat) props.challengeNearest();
  });

  return (
    <HudLayer id="overworld-hud">
      <PlayerStatus hud={hud} />
      <div className="absolute top-3 right-4 flex items-center gap-3">
        <LevelName hud={hud} />
        <Ping ping={props.ping} hud={props.hudSettings} />
        <HudButton id="inventory-button" label="Inventory" onClick={() => toggle("inventory")}>
          <BagIcon />
        </HudButton>
        <HudButton id="character-button" label="Character" onClick={() => toggle("character")}>
          <PersonIcon />
        </HudButton>
        <HudButton id="questbook-button" label="Questbook" onClick={props.toggleQuestbook}>
          <BookIcon />
        </HudButton>
        <HudButton id="settings-button" label="Settings" onClick={openSettings}>
          <GearIcon />
        </HudButton>
      </div>
      <InteractButton interaction={interaction} interact={interact} />
      <ChallengeNotice challenge={props.challenge} input={input} answer={props.answerChallenge} />
      {panel === "character" && <CharacterPanel hud={hud} statPoint={props.statPoint} close={close} />}
      {panel === "inventory" && (
        <InventoryPanel
          gear={gear} stats={stats} canHeal={!fullHp} using={using} input={input} settingsScreen={settingsScreen}
          use={props.useItem} move={props.moveItem} tooWeak={props.tooWeak} openSkillbook={() => showBook(true)}
          close={close} trade={shop && { shop, buy: props.buy, sell: props.sell, exchange: props.exchange }}
        />
      )}
      {panel === "inventory" && bookOpen && (
        <SkillbookScreen skills={props.skills} input={input} save={props.saveSkill} close={() => showBook(false)} />
      )}
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
      {name && <div id="overworld-name" className="mb-1 font-title text-[15px] tracking-wide">{name}</div>}
      <PlayerBars hpFraction={hpFraction} staminaFraction={staminaFraction} />
      <div id="overworld-wins" className="text-[13px] font-normal">
        Foes defeated: <span className="font-semibold text-victory">{wins}</span>
      </div>
    </div>
  );
}

interface ChallengeNoticeProps {
  challenge: Store<{ from: string | null }>;
  input: Actions;
  answer: (accept: boolean) => void;
}

function ChallengeNotice(props: ChallengeNoticeProps) {
  const from = useStore(props.challenge, (s) => s.from);
  useAction(props.input, ["acceptChallenge", "declineChallenge"], (action, repeat) => {
    if (repeat || from === null) return false;
    props.answer(action === "acceptChallenge");
  });
  if (from === null) return null;
  return (
    <div
      id="challenge-notice"
      className={
        "pointer-events-auto absolute top-24 left-1/2 -translate-x-1/2 rounded-sm border border-victory/50 "
        + "bg-black/75 px-5 py-3 text-center"
      }
    >
      <div className="mb-2 font-title text-lg tracking-wide">{from} challenges you to a duel</div>
      <div className="flex justify-center gap-3">
        <button type="button" {...NO_FOCUS} className={BUTTON.primary} onClick={() => props.answer(true)}>
          Accept
        </button>
        <button type="button" {...NO_FOCUS} className={BUTTON.plain} onClick={() => props.answer(false)}>
          Decline
        </button>
      </div>
    </div>
  );
}

function LevelName({ hud }: HudProps) {
  const name = useStore(hud, (s) => s.levelName), floor = useStore(hud, (s) => s.levelFloor);
  return (
    <div id="overworld-level" className="font-title text-[17px] font-medium tracking-wide">
      {floor !== null && <span className="mr-2 text-[14px] opacity-70">Floor {floor}</span>}
      {name}
    </div>
  );
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
