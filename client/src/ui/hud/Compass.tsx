import { useMemo } from "react";
import { useGame } from "../context.js";
import { useStore } from "../useStore.js";
import { COMPASS, compassMarks, stripShiftPx, type CompassMark } from "./compassMarks.js";

const EDGE_FADE = "linear-gradient(to right, transparent, black 20%, black 80%, transparent)";

export function Compass({ top }: { top: number }) {
  const turns = useStore(useGame().ui.overworld, (s) => s.cameraTurns);
  const marks = useMemo(() => compassMarks(turns), [turns]);
  return (
    <div
      id="compass" aria-hidden
      className="absolute left-1/2 -translate-x-1/2 overflow-hidden"
      style={{ top, width: COMPASS.widthPx, height: COMPASS.heightPx, maskImage: EDGE_FADE }}
    >
      <div className="absolute inset-y-0 left-1/2" style={{ transform: `translateX(${stripShiftPx(turns)}px)` }}>
        {marks.map((mark) => <Mark key={mark.deg} mark={mark} />)}
      </div>
      <div className="absolute top-0 left-1/2 h-1 w-px -translate-x-1/2 bg-cinnabar" />
      <div className="absolute bottom-0 left-1/2 h-1 w-px -translate-x-1/2 bg-cinnabar" />
    </div>
  );
}

function Mark({ mark }: { mark: CompassMark }) {
  const left = mark.deg * COMPASS.pxPerDeg;
  if (mark.label.length === 2) {
    return <div className="absolute top-1/2 h-2 w-px -translate-1/2 bg-bone/45" style={{ left }} />;
  }
  return (
    <div
      className={
        "absolute top-1/2 -translate-1/2 text-[11px] leading-none "
        + (mark.label === "N" ? "text-cinnabar" : "text-bone")
      }
      style={{ left }}
    >
      {mark.label}
    </div>
  );
}
