import { el, token } from "../dom.js";
import type { Bitmap } from "./bitmap.js";
import { composite } from "./layers.js";
import type { Editor } from "./state.js";
import { TOOLS } from "./tools.js";
import { WheelZoom, wheelPx } from "./wheel.js";

const ZOOMS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
const GRID_FROM_ZOOM = 6;
const MAJOR_GRID_PIXELS = 8;
const ONION_ALPHAS = { before: 0.3, after: 0.15 };

export function toCanvas(b: Bitmap): HTMLCanvasElement {
  const c = el("canvas");
  c.width = b.width;
  c.height = b.height;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(b.rgba), b.width, b.height), 0, 0);
  return c;
}

export class CanvasView {
  readonly canvas = el("canvas", "absolute inset-0 size-full touch-none pixelated");
  zoom = 8;
  grid = true;
  onion = true;
  hover: [number, number] | null = null;
  spaceHeld = false;
  private readonly wheel = new WheelZoom();
  private panX = 0;
  private panY = 0;
  private drag: { button: number; x: number; y: number } | null = null;

  constructor(private readonly ed: Editor, width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.onpointerdown = (e) => this.down(e);
    this.canvas.onpointermove = (e) => this.move(e);
    this.canvas.onpointerup = () => { this.drag = null; };
    this.canvas.oncontextmenu = (e) => e.preventDefault();
    this.canvas.onwheel = (e) => {
      e.preventDefault();
      const steps = this.wheel.steps(wheelPx(e), e.timeStamp);
      if (steps !== 0) this.zoomBy(steps, ...this.at(e));
    };
  }

  fit(): void {
    const { width, height } = this.ed.doc;
    const best = Math.min(this.canvas.width / width, this.canvas.height / height) * 0.9;
    this.zoom = ZOOMS.filter((z) => z <= best).at(-1) ?? 1;
    this.panX = Math.round((this.canvas.width - width * this.zoom) / 2);
    this.panY = Math.round((this.canvas.height - height * this.zoom) / 2);
    this.ed.changed();
  }

  resize(width: number, height: number): void {
    this.panX += (width - this.canvas.width) / 2;
    this.panY += (height - this.canvas.height) / 2;
    this.canvas.width = width;
    this.canvas.height = height;
    this.ed.changed(false);
  }

  zoomBy(steps: number, atX = this.canvas.width / 2, atY = this.canvas.height / 2): void {
    const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(this.zoom) + steps));
    const zoom = ZOOMS[i]!;
    this.panX = atX - ((atX - this.panX) * zoom) / this.zoom;
    this.panY = atY - ((atY - this.panY) * zoom) / this.zoom;
    this.zoom = zoom;
    this.ed.changed(false);
  }

  draw(): void {
    const g = this.canvas.getContext("2d")!;
    const { width, height } = this.ed.doc;
    const [x0, y0, z] = [Math.round(this.panX), Math.round(this.panY), this.zoom];
    this.canvas.style.cursor = this.panning() ? "grab" : "crosshair";
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.imageSmoothingEnabled = false;
    g.shadowColor = "rgba(0,0,0,0.55)";
    g.shadowBlur = 24;
    g.fillStyle = token("color-checker-a");
    g.fillRect(x0, y0, width * z, height * z);
    g.shadowColor = "transparent";
    const checker = [token("color-checker-a"), token("color-checker-b")];
    const cell = Math.max(z, 8);
    for (let y = 0; y < height * z; y += cell) {
      for (let x = 0; x < width * z; x += cell) {
        g.fillStyle = checker[((x + y) / cell) % 2]!;
        g.fillRect(x0 + x, y0 + y, Math.min(cell, width * z - x), Math.min(cell, height * z - y));
      }
    }
    if (this.onion && this.ed.mode === "animation") this.drawOnion(g, x0, y0, z);
    g.drawImage(toCanvas(composite(this.ed.doc)), x0, y0, width * z, height * z);
    if (this.grid && z >= GRID_FROM_ZOOM) this.drawGrid(g, x0, y0, z);
    g.strokeStyle = token("color-ink-600");
    g.lineWidth = 1;
    g.strokeRect(x0 - 0.5, y0 - 0.5, width * z + 1, height * z + 1);
    const sel = this.ed.selection;
    if (sel) {
      g.setLineDash([4, 3]);
      g.strokeStyle = token("color-selection");
      g.strokeRect(x0 + sel.x * z + 0.5, y0 + sel.y * z + 0.5, sel.w * z - 1, sel.h * z - 1);
      g.setLineDash([]);
    }
  }

  private drawOnion(g: CanvasRenderingContext2D, x0: number, y0: number, z: number): void {
    const { pages, page } = this.ed.project;
    for (const [at, alpha] of [[page - 1, ONION_ALPHAS.before], [page + 1, ONION_ALPHAS.after]] as const) {
      const doc = pages[at];
      if (!doc) continue;
      g.globalAlpha = alpha;
      g.drawImage(toCanvas(composite(doc)), x0, y0, doc.width * z, doc.height * z);
    }
    g.globalAlpha = 1;
  }

  private drawGrid(g: CanvasRenderingContext2D, x0: number, y0: number, z: number): void {
    const { width, height } = this.ed.doc;
    for (let i = 1; i < Math.max(width, height); i++) {
      g.fillStyle = i % MAJOR_GRID_PIXELS === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
      if (i < width) g.fillRect(x0 + i * z, y0, 1, height * z);
      if (i < height) g.fillRect(x0, y0 + i * z, width * z, 1);
    }
  }

  private panning(): boolean {
    return this.spaceHeld || this.ed.tool === "hand";
  }

  private pixelAt(e: PointerEvent): [number, number] {
    const [x, y] = this.at(e);
    return [Math.floor((x - this.panX) / this.zoom), Math.floor((y - this.panY) / this.zoom)];
  }

  private at(e: MouseEvent): [number, number] {
    const scale = this.canvas.width / (this.canvas.clientWidth || this.canvas.width);
    return [e.offsetX * scale, e.offsetY * scale];
  }

  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    const [sx, sy] = this.at(e);
    this.drag = { button: e.button, x: sx, y: sy };
    if (e.button !== 0 || this.panning()) return;
    const [x, y] = this.pixelAt(e);
    TOOLS[this.ed.tool].down(this.ed, x, y, e);
  }

  private move(e: PointerEvent): void {
    const [x, y] = this.pixelAt(e);
    const moved = !this.hover || this.hover[0] !== x || this.hover[1] !== y;
    this.hover = [x, y];
    if (!this.drag) {
      if (moved) this.ed.changed(false);
      return;
    }
    if (this.drag.button !== 0 || this.panning()) {
      const [sx, sy] = this.at(e);
      this.panX += sx - this.drag.x;
      this.panY += sy - this.drag.y;
      [this.drag.x, this.drag.y] = [sx, sy];
      this.ed.changed(false);
    } else if (moved) {
      TOOLS[this.ed.tool].move?.(this.ed, x, y, e);
    }
  }
}
