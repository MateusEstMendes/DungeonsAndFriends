import { Application } from "pixi.js";
export class PixiApp {
  readonly app = new Application();
  private disposed = false;
  private ready = false;
  async init(host: HTMLElement) {
    await this.app.init({ resizeTo: host, background: 0x09090b, antialias: true, autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2), preference: ["webgl", "webgpu"], preferWebGLVersion: 2 });
    this.app.ticker.maxFPS = 60;
    this.ready = true;
    if (this.disposed) { this.destroy(); return false; }
    this.app.canvas.setAttribute("aria-label", "Tabuleiro hexagonal. Toque para mover; arraste para explorar; use a roda ou dois dedos para ampliar.");
    this.app.canvas.setAttribute("role", "img");
    host.appendChild(this.app.canvas); return true;
  }
  destroy() {
    this.disposed = true;
    if (this.ready) { this.ready = false; this.app.destroy({ removeView: true, releaseGlobalResources: false }, { children: true, texture: false }); }
  }
}
