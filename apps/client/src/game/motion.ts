import { gsap } from "gsap";
/** Owns all delayed callbacks/tweens; scene teardown reverts the entire context. */
export class BoardMotion {
  readonly context = gsap.context(() => {});
  private media = gsap.matchMedia();
  reduced = false;
  constructor() {
    this.media.add({ always: "(min-width: 0px)", reduce: "(prefers-reduced-motion: reduce)" }, context => {
      this.reduced = !!context.conditions?.reduce;
      if (this.reduced) for (const tween of this.context.getTweens()) {
        if (tween.repeat() === -1) tween.kill(); else tween.progress(1);
      }
    });
  }
  run(action: () => void) { this.context.add(action); }
  destroy() { this.context.revert(); this.media.revert(); }
}
