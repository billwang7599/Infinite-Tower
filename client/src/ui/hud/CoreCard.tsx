import { coreName } from "@infinite-tower/shared";
import { useEffect, useRef, useState } from "react";
import { coreLight, REALM_LOOKS } from "../../gfx/core/light.js";
import { BREAKTHROUGH, CoreSphere, SPHERE_PX } from "../../gfx/core/sphere.js";
import type { Mode } from "../../game/transition.js";
import { LookPicture } from "../components/LookPicture.js";
import { NO_FOCUS } from "../components/noFocus.js";
import type { GameEvent } from "../notifications/say.js";
import type { BattleHudState, YouState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { CORE_CARD_LEFT_PX, CORE_CARD_WIDTH_PX } from "./layout.js";
import { usePaintedSphere } from "./paintSphere.js";

const FACE =
  "col-start-1 row-start-1 overflow-hidden rounded-sm bg-black ring-1 ring-victory/50 backface-hidden "
  + "group-hover:ring-victory";
const BAND =
  "h-5 truncate border-t border-victory/30 px-1 text-center font-title text-[11px]/5 tracking-[0.14em] "
  + "text-victory uppercase";
const BREAKTHROUGH_SHOWN_MS = BREAKTHROUGH.endTime * 1000 + 1500;

interface CoreCardProps {
  mode: Mode | null;
  you: Store<YouState>;
  battle: Store<BattleHudState>;
  said: Store<{ event: GameEvent | null }>;
}

export function CoreCard({ mode, you, battle, said }: CoreCardProps) {
  const look = useStore(you, (s) => s.character?.look);
  const name = useStore(you, (s) => s.character?.name);
  const savedCore = useStore(you, (s) => s.core);
  const battleCore = useStore(battle, (s) => s.core);
  const core = mode === "battle" ? battleCore ?? savedCore : savedCore;
  const [sphere] = useState(() => new CoreSphere());
  const [turned, setTurned] = useState(false);
  const [breakthroughAt, setBreakthroughAt] = useState<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const showCore = turned || breakthroughAt !== null;

  useEffect(() => {
    if (core) sphere.show(core);
  }, [core, sphere]);

  useEffect(() => said.subscribe(() => {
    const event = said.get().event;
    if (event?.kind !== "breakthrough") return;
    const now = performance.now();
    sphere.breakthrough(now / 1000, event.core);
    setBreakthroughAt(now);
  }), [said, sphere]);

  useEffect(() => {
    if (breakthroughAt === null) return;
    const timer = setTimeout(() => setBreakthroughAt(null), BREAKTHROUGH_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [breakthroughAt]);

  usePaintedSphere(canvas, sphere, showCore);

  const glyph = core ? REALM_LOOKS[coreLight(core.steps).realm].glyph : "";
  return (
    <button
      type="button" id="core-card" data-face={showCore ? "core" : "portrait"} {...NO_FOCUS}
      aria-label={showCore ? "Show your portrait" : "Show your core"}
      onClick={() => {
        setTurned(!showCore);
        setBreakthroughAt(null);
      }}
      style={{ left: CORE_CARD_LEFT_PX, width: CORE_CARD_WIDTH_PX }}
      className="group pointer-events-auto absolute bottom-4 cursor-pointer perspective-midrange"
    >
      <div
        className={`grid transition-transform duration-600 transform-3d motion-reduce:transition-none ${
          showCore ? "rotate-y-180" : ""
        }`}
      >
        <div className={FACE}>
          <div className="aspect-square bg-linear-to-b from-night to-black">
            {look && <LookPicture look={look} view="portrait" className="size-full" />}
          </div>
          <div className={BAND}>{name}</div>
        </div>
        <div className={`${FACE} rotate-y-180`}>
          <canvas
            ref={canvas} id="core-sphere" width={SPHERE_PX} height={SPHERE_PX} aria-hidden
            className="aspect-square w-full [image-rendering:pixelated]"
          />
          <div id="core-card-name" className={BAND}>{core && `${coreName(core)} ${glyph}`}</div>
        </div>
      </div>
    </button>
  );
}
