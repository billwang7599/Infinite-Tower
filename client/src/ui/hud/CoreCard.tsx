import { coreName } from "@infinite-tower/shared";
import { useEffect, useRef, useState } from "react";
import { BREAKTHROUGH, CoreSphere, SPHERE_PX } from "../../gfx/core/sphere.js";
import { EngravedFrame } from "../components/EngravedFrame.js";
import { LookPicture } from "../components/LookPicture.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { useGame } from "../context.js";
import { useStore } from "../useStore.js";
import { CORE_CARD_LEFT_PX, CORE_CARD_WIDTH_PX } from "./layout.js";
import { usePaintedSphere } from "./paintSphere.js";
import { RealmSeal } from "./RealmSeal.js";

const FACE = "col-start-1 row-start-1 backface-hidden";
const BAND =
  "mt-1 flex h-5 items-center justify-center gap-2 text-xs/5 font-semibold tracking-[0.24em] text-bone uppercase "
  + "text-shadow-hud";
const BREAKTHROUGH_SHOWN_MS = BREAKTHROUGH.endTime * 1000 + 1500;

export function CoreCard() {
  const { ui: { screen, you, battle, notifications } } = useGame();
  const said = notifications.said;
  const mode = useStore(screen, (s) => s.mode);
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
          <EngravedFrame className="aspect-square">
            {look && <LookPicture look={look} view="portrait" className="block size-full" />}
          </EngravedFrame>
          <div className={BAND}>
            <RealmSeal core={core} />
            <span className="truncate">{name}</span>
          </div>
        </div>
        <div className={`${FACE} rotate-y-180`}>
          <EngravedFrame>
            <canvas
              ref={canvas} id="core-sphere" width={SPHERE_PX} height={SPHERE_PX} aria-hidden
              className="block aspect-square w-full [image-rendering:pixelated]"
            />
          </EngravedFrame>
          <div className={BAND}>
            <RealmSeal core={core} />
            <span id="core-card-name" className="truncate">{core && coreName(core)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
