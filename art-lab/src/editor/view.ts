import { el } from "../dom.js";
import type { Bitmap } from "./bitmap.js";
import { composite } from "./layers.js";
import type { Editor } from "./state.js";
import { TOOLS } from "./tools.js";

const ZOOMS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
const GRID_FROM_ZOOM = 6;
const MAJOR_GRID_PIXELS = 8;

export function toCanvas(b: Bitmap): HTMLCanvasElement {
  const c = el("canvas");
  c.width = b.width;
  c.height = b.height;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(b.rgba), b.width, b.height), 0, 0);
  return c;
}

export class CanvasView {
  readonly canvas = el("canvas", "background:#15161e;border:1px solid #2c2e40;cursor:crosshair;touch-action:none");
  zoom = 8;
  grid = true;
  hover: [number, number] | null = null;
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
      this.zoomBy(e.deltaY < 0 ? 1 : -1, ...this.at(e));
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
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.imageSmoothingEnabled = false;
    const cell = Math.max(z, 8);
    for (let y = 0; y < height * z; y += cell) {
      for (let x = 0; x < width * z; x += cell) {
        g.fillStyle = ((x + y) / cell) % 2 === 0 ? "#2a2b36" : "#33343f";
        g.fillRect(x0 + x, y0 + y, Math.min(cell, width * z - x), Math.min(cell, height * z - y));
      }
    }
    g.drawImage(toCanvas(composite(this.ed.doc)), x0, y0, width * z, height * z);
    if (this.grid && z >= GRID_FROM_ZOOM) this.drawGrid(g, x0, y0, z);
    g.strokeStyle = "#4a4e66";
    g.lineWidth = 1;
    g.strokeRect(x0 - 0.5, y0 - 0.5, width * z + 1, height * z + 1);
    const sel = this.ed.selection;
    if (sel) {
      g.setLineDash([4, 3]);
      g.strokeStyle = "#f0d070";
      g.strokeRect(x0 + sel.x * z + 0.5, y0 + sel.y * z + 0.5, sel.w * z - 1, sel.h * z - 1);
      g.setLineDash([]);
    }
  }

  private drawGrid(g: CanvasRenderingContext2D, x0: number, y0: number, z: number): void {
    const { width, height } = this.ed.doc;
    for (let i = 1; i < Math.max(width, height); i++) {
      g.fillStyle = i % MAJOR_GRID_PIXELS === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
      if (i < width) g.fillRect(x0 + i * z, y0, 1, height * z);
      if (i < height) g.fillRect(x0, y0 + i * z, width * z, 1);
    }
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
    if (e.button !== 0 || this.ed.tool === "hand") return;
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
    if (this.drag.button !== 0 || this.ed.tool === "hand") {
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
