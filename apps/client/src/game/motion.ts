import { gsap } from "gsap";
/** Owns delayed callbacks/tweens. Pixi objects are disposed, so teardown kills without reverting destroyed transforms. */
export class BoardMotion {
  readonly context = gsap.context(() => {});
  private media = gsap.matchMedia();
  reduced = false;
  constructor() {
    this.media.add({ always: "(min-width: 0px)", reduce: "(prefers-reduced-motion: reduce)" }, context => {
      this.reduced = !!context.conditions?.reduce;
      if (this.reduced) for (const tween of this.context.getTweens()) {
        if (tween.repeat() === -1) tween.kill(); else if (tween.isActive()) tween.progress(1);
      }
    });
  }
  run(action: () => void) { this.context.add(action); }
  destroy() { this.context.kill(); this.media.revert(); }
}
