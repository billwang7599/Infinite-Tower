/**
 * Behind the title: the scene (Scene.tsx), a low-poly tower of glowing glass and gold in a dark world of stone
 * tiles, with the screen's finish over it: while it's seen from outside, faint shafts of moonlight and embers
 * drifting up; always, a little film grain and a heavy vignette.
 */
import { seededRandom } from "@infinite-tower/shared";
import { memo, type CSSProperties } from "react";
import type { Stage } from "../sequence.js";
import { Scene } from "./Scene.js";

const STILL_IF_REDUCED = "motion-reduce:animate-none";
const HEXAGON = "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)";
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E"
  + "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' "
  + "stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E"
  + "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const VIGNETTE = "radial-gradient(120% 90% at 62% 45%, #0000 45%, #00000080 80%, #000000d0 100%)";

const rand = seededRandom(5);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const looping = (seconds: number): CSSProperties =>
  ({ animationDuration: `${seconds}s`, animationDelay: `-${between(0, seconds)}s` });

const SHAFTS = [{ left: 30, width: 7 }, { left: 44, width: 12 }, { left: 63, width: 5 }, { left: 82, width: 10 }];
const FLAKES = Array.from({ length: 22 }, () => ({
  left: between(0, 100), top: between(30, 100), size: between(5, 13), style: looping(between(12, 22)),
}));

export const Backdrop = memo(function Backdrop({ stage, still }: { stage: Stage; still: boolean }) {
  const outside = stage === "menu" || stage === "fade";
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-black">
      <Scene stage={stage} still={still} />

      <div className={`absolute inset-0 transition-opacity duration-500 ${outside ? "" : "opacity-0"}`}>
        {SHAFTS.map((s, i) => (
          <div key={i}
            className={`absolute top-0 h-[60%] -skew-x-[28deg] animate-breathe mix-blend-screen blur-xl ${
              STILL_IF_REDUCED}`}
            style={{
              left: `${s.left}%`, width: `${s.width}%`, animationDuration: `${7 + i * 2}s`,
              background: "linear-gradient(to bottom, #b8c8ff26, #b8c8ff00)",
            }} />
        ))}
        {FLAKES.map((f, i) => (
          <span key={i} className={`absolute animate-mote bg-[#f0c25e] opacity-0 ${STILL_IF_REDUCED}`} style={{
            left: `${f.left}%`, top: `${f.top}%`, width: f.size, height: f.size * 0.87, clipPath: HEXAGON, ...f.style,
          }} />
        ))}
      </div>

      <div className="absolute inset-0" style={{ background: VIGNETTE }} />
      <div className="absolute inset-0 opacity-[0.1] mix-blend-screen" style={{ backgroundImage: GRAIN }} />
    </div>
  );
});
