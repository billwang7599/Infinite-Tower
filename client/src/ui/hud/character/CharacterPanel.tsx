import { useState } from "react";
import type { ShownStat } from "@infinite-tower/shared";
import type { OverworldHudState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { PanelFrame } from "../PanelFrame.js";
import { CoreTab } from "./CoreTab.js";
import { RelationshipsTab } from "./RelationshipsTab.js";
import { StatsTab } from "./StatsTab.js";
import { CHARACTER_TABS, type CharacterTab } from "./panelTabs.js";
import { Tabs } from "./Tabs.js";

interface PanelProps {
  hud: Store<OverworldHudState>;
  statPoint: (stat: ShownStat, add: boolean) => void;
  close: () => void;
  shownWidth: (px: number) => void;
}

const WIDTH_PX = 680;
const BODY_HEIGHT_PX = 400;

export function CharacterPanel({ hud, statPoint, close, shownWidth }: PanelProps) {
  const core = useStore(hud, (s) => s.core);
  const byFire = useStore(hud, (s) => s.byFire);
  const character = useStore(hud, (s) => s.character);
  const faith = useStore(hud, (s) => s.faith);
  const [shown, show] = useState<CharacterTab>("stats");
  return (
    <PanelFrame
      id="character-panel" title={character?.name ?? "Character"} titleId="character-name"
      width={WIDTH_PX} shownWidth={shownWidth} close={close}
    >
      <Tabs id="character-tabs" tabs={CHARACTER_TABS} shown={shown} show={show} />
      {core && (
        <div id={`character-${shown}`} role="tabpanel" style={{ height: BODY_HEIGHT_PX }}>
          {shown === "stats" && <StatsTab character={character} core={core} byFire={byFire} statPoint={statPoint} />}
          {shown === "core" && <CoreTab core={core} />}
          {shown === "relationships" && <RelationshipsTab faith={faith} />}
        </div>
      )}
    </PanelFrame>
  );
}
