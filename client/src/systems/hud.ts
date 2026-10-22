import { Boar, Health, LocalPlayer, Stamina, type System } from "@infinite-tower/shared";
import type { GameContext } from "../context.js";

/** DOM overlay: health/stamina bars, boss bar, death/victory banner. Only touches the DOM on change. */
export function hudSystem(ctx: GameContext, root: HTMLElement): System {
  root.innerHTML = `
    <div id="info"></div>
    <div id="bars">
      <div class="bar hp"><div class="lag"></div><div class="fill"></div></div>
      <div class="bar st"><div class="fill"></div></div>
    </div>
    <div id="boss"><div class="name">Wild Boar</div><div class="bar boss"><div class="lag"></div><div class="fill"></div></div></div>
    <div id="banner"><div class="title"></div><div class="sub">Press R to fight again</div></div>
    <div id="capture">Click to capture the mouse</div>`;
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
  const els = {
    info: $("#info"), hp: $(".hp .fill"), hpLag: $(".hp .lag"), st: $(".st .fill"),
    boss: $("#boss"), bossHp: $(".boss .fill"), bossLag: $(".boss .lag"),
    banner: $("#banner"), title: $("#banner .title"), capture: $("#capture"),
  };
  const cache = new Map<HTMLElement, string>();
  const set = (el: HTMLElement, key: "width" | "opacity" | "html" | "class", value: string) => {
    const id = `${key}:${value}`;
    if (cache.get(el) === id) return;
    cache.set(el, id);
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
      `<small>${fps} fps · WASD move · Mouse/arrows look · LMB/J slash · Shift/RMB/L dodge · Space jump</small>`);
    set(els.capture, "opacity", ctx.mouse.locked ? "0" : "1");

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
    set(els.banner, "class", show ? `show ${f.state}` : "");
    set(els.title, "html", f.state === "lost" ? "YOU DIED" : "PREY SLAUGHTERED");
  };
}
