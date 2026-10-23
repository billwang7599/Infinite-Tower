import { Boar, Health, LocalPlayer, Stamina, type System } from "@infinite-tower/shared";
import type { GameContext } from "../context.js";

const BANNER = "absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-1200 "
  + "bg-[linear-gradient(transparent_38%,#000b_45%,#000b_58%,transparent_65%)]";
const TITLE = "title font-title text-6xl font-normal tracking-[6px]";

/** DOM overlay: health/stamina bars, boss bar, death/victory banner. Only touches the DOM on change. */
export function hudSystem(ctx: GameContext, root: HTMLElement): System {
  root.innerHTML = `
    <div id="info" class="absolute top-3 left-4"></div>
    <div class="absolute top-10 left-4 w-75">
      <div class="bar hp"><div class="lag bar-layer bg-chip"></div><div class="fill bar-layer bg-linear-to-b from-hp to-hp-dark"></div></div>
      <div class="bar st w-[70%]"><div class="fill bar-layer bg-linear-to-b from-stamina to-stamina-dark"></div></div>
    </div>
    <div id="boss" class="absolute bottom-12 left-1/2 w-[min(640px,70vw)] -translate-x-1/2 transition-opacity duration-600">
      <div class="mb-1 font-title text-[17px] font-medium tracking-wide">Wild Boar</div>
      <div class="bar boss"><div class="lag bar-layer bg-chip"></div><div class="fill bar-layer bg-linear-to-b from-boss to-boss-dark"></div></div>
    </div>
    <div id="banner" class="${BANNER} opacity-0">
      <div class="${TITLE}"></div>
      <div class="mt-2 font-normal opacity-80">Press Enter to continue</div>
    </div>
    <div id="lock" class="absolute top-3 right-4 text-right text-[13px] font-normal"></div>`;
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
  const els = {
    info: $("#info"), hp: $(".hp .fill"), hpLag: $(".hp .lag"), st: $(".st .fill"),
    boss: $("#boss"), bossHp: $(".boss .fill"), bossLag: $(".boss .lag"),
    banner: $("#banner"), title: $("#banner .title"), lock: $("#lock"),
  };
  const cache = new Map<HTMLElement, Map<string, string>>();
  const set = (el: HTMLElement, key: "width" | "opacity" | "html" | "class", value: string) => {
    let props = cache.get(el);
    if (!props) cache.set(el, (props = new Map()));
    if (props.get(key) === value) return;
    props.set(key, value);
    if (key === "html") el.innerHTML = value;
    else if (key === "class") el.className = value;
    else el.style[key] = value;
  };

  // Souls-style damage chip: a pale bar that catches up with the real one after a moment.
  const lag = { hp: 1, boss: 1, hpHold: 0, bossHold: 0 };
  const lagStep = (cur: number, real: number, hold: number, dt: number): [number, number] => {
    if (real >= cur) return [real, 0];
    if (hold < 0.6) return [cur, hold + dt];
    return [Math.max(real, cur - dt * 0.8), hold];
  };

  let fpsTimer = 0, fps = 0;
  return (world, dt) => {
    fpsTimer += dt;
    if (fpsTimer > 0.5) { fps = Math.round(ctx.scene.getEngine().getFps()); fpsTimer = 0; }
    set(els.info, "html",
      `<small class="text-[13px] font-normal opacity-75">${fps} fps · WASD move · Mouse or H/L camera · Click/J slash · Right-click/K dodge · Middle-click/; lock-on · Space jump</small>`);
    set(els.lock, "html", (ctx.view.lock ? "<span class=\"text-victory\">◎ Locked on</span> (; to free the camera)" : "Free camera (; to lock on)")
      + (ctx.mouse.locked ? "" : "<br><span class=\"opacity-60\">Click to use the mouse / trackpad</span>"));

    const me = world.first(LocalPlayer, Health, Stamina);
    if (me) {
      const [, , h, s] = me;
      const real = h.hp / h.max;
      [lag.hp, lag.hpHold] = lagStep(lag.hp, real, lag.hpHold, dt);
      set(els.hp, "width", `${(real * 100).toFixed(1)}%`);
      set(els.hpLag, "width", `${(lag.hp * 100).toFixed(1)}%`);
      set(els.st, "width", `${((s.value / s.max) * 100).toFixed(1)}%`);
    }

    const boar = world.first(Boar, Health);
    set(els.boss, "opacity", boar && boar[2].hp > 0 ? "1" : "0");
    if (boar) {
      const real = boar[2].hp / boar[2].max;
      [lag.boss, lag.bossHold] = lagStep(lag.boss, real, lag.bossHold, dt);
      set(els.bossHp, "width", `${(real * 100).toFixed(1)}%`);
      set(els.bossLag, "width", `${(lag.boss * 100).toFixed(1)}%`);
    }

    const f = ctx.fight;
    const show = f.state !== "fighting" && f.time > 1.0;
    set(els.banner, "class", `${BANNER} ${show ? "opacity-100" : "opacity-0"}`);
    set(els.title, "class", `${TITLE} ${f.state === "lost" ? "text-died" : "text-victory"}`);
    set(els.title, "html", f.state === "lost" ? "YOU DIED" : "PREY SLAUGHTERED");
  };
}
