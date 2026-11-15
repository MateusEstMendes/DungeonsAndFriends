import { Application } from "pixi.js";
export class PixiApp {
  readonly app = new Application();
  private events = new AbortController();
  private contextLost = (event: Event) => { event.preventDefault(); this.app.ticker.stop(); this.app.canvas.setAttribute('data-context-lost', 'true'); this.app.canvas.dispatchEvent(new CustomEvent('df-context-status', { detail: true })); };
  private contextRestored = () => { if (this.disposed) return; this.app.ticker.start(); this.app.canvas.removeAttribute('data-context-lost'); this.app.canvas.dispatchEvent(new CustomEvent('df-context-status', { detail: false })); };
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
    this.app.canvas.addEventListener('webglcontextlost', this.contextLost, { signal: this.events.signal });
    this.app.canvas.addEventListener('webglcontextrestored', this.contextRestored, { signal: this.events.signal });
    host.appendChild(this.app.canvas); return true;
  }
  destroy() {
    this.disposed = true; this.events.abort();
    if (this.ready) { this.ready = false; this.app.destroy({ removeView: true, releaseGlobalResources: false }, { children: true, texture: false }); }
  }
}
