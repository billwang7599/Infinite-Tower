import { useMemo } from "react";
import { CAMERA_TURN_TIME } from "../../modes/overworld/facing.js";
import type { OverworldHudState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { COMPASS, compassMarks, stripShiftPx, type CompassMark } from "./compassMarks.js";

const EDGE_FADE = "linear-gradient(to right, transparent, black 20%, black 80%, transparent)";

export function Compass({ hud, top }: { hud: Store<OverworldHudState>; top: number }) {
  const turns = useStore(hud, (s) => s.cameraTurns);
  const marks = useMemo(() => compassMarks(turns), [turns]);
  return (
    <div
      id="compass" aria-hidden
      className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-full bg-black/40"
      style={{ top, width: COMPASS.widthPx, height: COMPASS.heightPx, maskImage: EDGE_FADE }}
    >
      <div
        className="absolute inset-y-0 left-1/2 transition-transform ease-in-out"
        style={{ transform: `translateX(${stripShiftPx(turns)}px)`, transitionDuration: `${CAMERA_TURN_TIME}s` }}
      >
        {marks.map((mark) => <Mark key={mark.deg} mark={mark} />)}
      </div>
      <div className="absolute top-0 left-1/2 h-1 w-0.5 -translate-x-1/2 bg-victory" />
      <div className="absolute bottom-0 left-1/2 h-1 w-0.5 -translate-x-1/2 bg-victory" />
    </div>
  );
}

function Mark({ mark }: { mark: CompassMark }) {
  const left = mark.deg * COMPASS.pxPerDeg;
  if (mark.label.length === 2) {
    return <div className="absolute top-1/2 h-2 w-px -translate-1/2 bg-white/45" style={{ left }} />;
  }
  return (
    <div
      className={
        "absolute top-1/2 -translate-1/2 font-title text-[13px] leading-none "
        + (mark.label === "N" ? "text-victory" : "text-white/85")
      }
      style={{ left }}
    >
      {mark.label}
    </div>
  );
}
