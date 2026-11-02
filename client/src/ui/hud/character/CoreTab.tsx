import { coreName, inscriptionSlots, type CoreState } from "@infinite-tower/shared";
import { useEffect, useRef, useState } from "react";
import { coreLight, REALM_LOOKS } from "../../../gfx/core/light.js";
import { CoreSphere, SPHERE_PX } from "../../../gfx/core/sphere.js";
import { INSCRIPTION_TEXT, inscriptionName, inscriptionRarity } from "../inscriptions.js";
import { RARITY_NAME, RARITY_TEXT } from "../inventory/itemInfo.js";
import { usePaintedSphere } from "../paintSphere.js";

const SPHERE_SHOWN_PX = SPHERE_PX * 5;

export function CoreTab({ core }: { core: CoreState }) {
  const [sphere] = useState(() => new CoreSphere());
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => sphere.show(core), [core, sphere]);
  usePaintedSphere(canvas, sphere, true);
  return (
    <div className="flex h-full gap-6">
      <figure className="flex shrink-0 flex-col items-center gap-2">
        <canvas
          ref={canvas} id="character-sphere" width={SPHERE_PX} height={SPHERE_PX} aria-hidden
          style={{ width: SPHERE_SHOWN_PX, height: SPHERE_SHOWN_PX }}
          className="rounded-sm bg-black ring-1 ring-victory/40 [image-rendering:pixelated]"
        />
        <figcaption className="font-title text-base tracking-wide text-victory">
          {coreName(core)} {REALM_LOOKS[coreLight(core.steps).realm].glyph}
        </figcaption>
      </figure>
      <section id="character-rings" className="flex min-w-0 flex-1 flex-col text-sm">
        <div className="flex items-baseline justify-between border-b border-white/10 pb-1 text-white/70">
          <span className="text-xs tracking-[0.12em] uppercase">Rings</span>
          <span className="text-xs tabular-nums">{core.inscriptions.length} / {inscriptionSlots(core)}</span>
        </div>
        {core.inscriptions.length === 0 && (
          <p className="mt-2 text-xs text-white/45 italic">
            Nothing carved yet. The Collegium carves sigils into a core.
          </p>
        )}
        <ul className="mt-2 flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          {core.inscriptions.map((id) => {
            const rarity = inscriptionRarity(id);
            return (
              <li key={id} data-inscription={id}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`font-semibold ${RARITY_TEXT[rarity]}`}>{inscriptionName(id)}</span>
                  <span className={`text-[11px] tracking-wide uppercase opacity-70 ${RARITY_TEXT[rarity]}`}>
                    {RARITY_NAME[rarity]}
                  </span>
                </span>
                <span className="text-xs text-white/60">{INSCRIPTION_TEXT[id]}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
