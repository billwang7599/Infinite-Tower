/**
 * The title screen, shown on load before anything connects. "Play" runs the caller's `join` (connecting to
 * the server); if that fails, the error shows here and Play becomes Retry. "Controls" opens the controls
 * page. Keyboard first (MENU_KEYS in ui/menu.ts), mouse works too. Closing fades it out over the field.
 */
import { MENU_KEYS, Menu, has } from "../menu.js";
import { backdropSvg } from "./backdrop.js";
import { controlsHtml, keyName } from "./controls.js";

export interface TitleScreen {
  /** Wait for Play, then run `join`. On failure, show the error and wait for the next try. */
  play<T>(join: () => Promise<T>): Promise<T>;
  /** One line under the menu: progress, or an error. */
  status(text: string, tone?: "info" | "error"): void;
  /** Fade out, then remove. */
  close(): void;
}

const FADE_MS = 700;
const STATUS = "mt-6 min-h-5 max-w-md text-sm";
const RISE = "animate-rise motion-reduce:animate-none";

const cap = (code: string) => `<kbd class="keycap">${keyName(code)}</kbd>`;
const HINTS = `${cap(MENU_KEYS.up[0])}${cap(MENU_KEYS.down[0])}<span class="mr-4 ml-1">select</span>`
  + `${cap(MENU_KEYS.choose[0])}<span class="mr-4 ml-1">choose</span>`
  + `${cap(MENU_KEYS.back[0])}<span class="ml-1">back</span>`;

export function openTitleScreen(parent: HTMLElement = document.body): TitleScreen {
  const root = document.createElement("div");
  root.id = "title-screen";
  root.className = "fixed inset-0 z-20 overflow-hidden bg-night font-ui text-white select-none transition-opacity duration-700";
  root.innerHTML = `
    ${backdropSvg()}
    <div class="pointer-events-none absolute inset-0 bg-linear-to-r from-black/75 via-black/20 to-transparent"></div>
    <main class="absolute inset-y-0 left-[8vw] flex flex-col justify-center">
      <header class="${RISE}">
        <p class="mb-4 text-[13px] tracking-[0.5em] text-white/55 uppercase">A climb without end</p>
        <h1 class="font-title text-[clamp(48px,7.5vw,104px)] leading-[0.92] font-normal tracking-[0.06em] text-victory text-shadow-title">
          Infinite<br>Tower
        </h1>
      </header>
      <div data-menu class="mt-12 ${RISE} [animation-delay:250ms]"></div>
      <p id="title-status" class="${STATUS}"></p>
    </main>
    <footer class="absolute bottom-6 left-[8vw] flex items-center gap-1 text-xs text-white/50">${HINTS}</footer>
    <div id="title-controls" hidden class="absolute inset-0 animate-fade-in bg-black/55 backdrop-blur-sm motion-reduce:animate-none">
      <div data-dismiss class="flex size-full items-center justify-center p-6">
        <div class="max-h-full overflow-y-auto rounded-xl border border-white/10 bg-night/90 px-9 py-7 shadow-2xl">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="font-title text-3xl tracking-[0.12em]">Controls</h2>
            <button data-back type="button" class="flex cursor-pointer items-center gap-2 text-sm text-white/60 hover:text-white">
              ${cap(MENU_KEYS.back[0])} Back
            </button>
          </div>
          ${controlsHtml()}
        </div>
      </div>
    </div>`;
  parent.append(root);

  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
  const statusEl = $("#title-status"), controls = $("#title-controls");
  let onPlay = () => {};
  let busy = false;

  const showControls = (open: boolean) => { controls.hidden = !open; };
  const menu = new Menu([
    { label: "Play", choose: () => onPlay() },
    { label: "Controls", choose: () => showControls(true) },
  ]);
  $("[data-menu]").append(menu.el);
  $("[data-back]").addEventListener("click", () => showControls(false));
  $("[data-dismiss]").addEventListener("click", (e) => { if (e.target === e.currentTarget) showControls(false); });

  const setBusy = (b: boolean) => {
    busy = b;
    menu.el.classList.toggle("opacity-40", b);
    menu.el.classList.toggle("pointer-events-none", b);
  };
  const status = (text: string, tone: "info" | "error" = "info") => {
    statusEl.textContent = text;
    statusEl.className = `${STATUS} ${tone === "error" ? "text-[#ff8f86]" : "text-white/70"}`;
  };

  const onKey = (e: KeyboardEvent) => {
    let used = false;
    if (!controls.hidden) {
      used = has(MENU_KEYS.back, e.code) || has(MENU_KEYS.choose, e.code);
      if (used && !e.repeat) showControls(false);
    } else if (!busy) {
      used = menu.key(e.code, e.repeat);
    }
    if (used) e.preventDefault();
  };
  window.addEventListener("keydown", onKey);

  return {
    play(join) {
      return new Promise((resolve) => {
        onPlay = async () => {
          if (busy) return;
          setBusy(true);
          status("Connecting…");
          try {
            const joined = await join();
            onPlay = () => {};
            resolve(joined);
          } catch (err) {
            setBusy(false);
            menu.setLabel(0, "Retry");
            status(err instanceof Error ? err.message : String(err), "error");
          }
        };
      });
    },
    status,
    close() {
      window.removeEventListener("keydown", onKey);
      root.classList.add("opacity-0", "pointer-events-none");
      setTimeout(() => root.remove(), FADE_MS);
    },
  };
}
