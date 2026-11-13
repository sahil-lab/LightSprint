import { Engine, TIERS } from "./engine";
import { QualityGovernor } from "./quality";
import { pinProgress, sceneAt } from "./scenes";
import type { Band } from "./scenes";

export type RenderPreference = "auto" | "live" | "still";

export type RendererInfo =
  { mode: "webgl2"; particles: number; live: boolean } | { mode: "static"; reason: string };

export type DirectorOptions = {
  canvas: HTMLCanvasElement;
  root: HTMLElement;
  reducedMotion: boolean;
  /** "auto" stops animating when frames are too slow; "live" and "still" force one mode. */
  render: RenderPreference;
  onRenderer: (info: RendererInfo) => void;
};

// The moment of the animation shown in still frames.
const STILL_TIME = 24;
const INTRO_SECONDS = 2.8;
// Longest simulated step, so a stalled tab does not jump the animation far ahead.
const MAX_STEP = 0.5;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));
const approach = (rate: number, delta: number): number => 1 - Math.exp(-rate * delta);

function scrollsInside(target: EventTarget | null, deltaY: number): boolean {
  let element = target instanceof Element ? target : null;
  while (element && element !== document.body && element !== document.documentElement) {
    if (element.scrollHeight > element.clientHeight + 1) {
      const overflow = getComputedStyle(element).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        const atTop = element.scrollTop <= 0;
        const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
        if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true;
      }
    }
    element = element.parentElement;
  }
  return false;
}

/**
 * Drives everything that moves: the WebGL scene, scroll inertia, scroll-linked CSS
 * variables, the cursor ring and hover effects.
 *
 * While live it runs a frame loop. Otherwise (reduced motion, a renderer too slow to
 * animate, or a forced preference) it draws one still frame per scene on demand and
 * leaves scrolling and anchors to the browser.
 */
export class Director {
  private readonly options: DirectorOptions;
  private readonly sections: HTMLElement[];
  private readonly hero: HTMLElement | null;
  private readonly pin: HTMLElement | null;
  private readonly cursor: HTMLElement | null;
  private readonly resizeObserver: ResizeObserver;
  private readonly revealObserver: IntersectionObserver | null;
  private readonly written = new Map<string, string>();
  private engine: Engine | null = null;
  private governor: QualityGovernor | null = null;
  private live: boolean;
  private bands: Band[] = [];
  private pinTop = 0;
  private pinHeight = 0;
  private heroHeight = 1;
  private viewport = 1;
  private scrollLimit = 1;

  private frame = 0;
  private stillFrame = 0;
  private stillDirty = true;
  private renderedScene = -1;
  private last = 0;
  private time = 0;
  private scene = 0;
  private intro: number;
  private revealed = false;

  private pointerSeen = false;
  private pointerTargetX = 0;
  private pointerTargetY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private lastClientX = 0;
  private lastClientY = 0;
  private force = 0;
  private forceTarget = 0;
  private cursorX = 0;
  private cursorY = 0;
  private cursorTargetX = 0;
  private cursorTargetY = 0;
  private magnet: HTMLElement | null = null;
  private glow: HTMLElement | null = null;

  private scrolling = false;
  private scrollTarget = 0;
  private scrollCurrent = 0;
  private scrollExpected = 0;

  private pulseAt = -1;
  private alertLevel = 0;
  private health = 1;
  private healthTarget = 1;

  constructor(options: DirectorOptions) {
    this.options = options;
    const { root, canvas, reducedMotion } = options;
    this.sections = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]"));
    this.hero = root.querySelector<HTMLElement>("[data-hero]");
    this.pin = root.querySelector<HTMLElement>("[data-pin]");
    this.cursor = root.querySelector<HTMLElement>("[data-cursor-ring]");
    this.live = !reducedMotion && options.render !== "still";
    this.intro = this.live ? 0 : 1;
    root.dataset.motion = reducedMotion ? "off" : "on";
    root.dataset.loop = this.live ? "live" : "still";

    this.createEngine();
    this.measure();

    // The page grows and shrinks as the stack status and notices load.
    this.resizeObserver = new ResizeObserver(() => {
      this.measure();
      this.requestStill();
    });
    this.resizeObserver.observe(root);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("scroll", this.onScroll, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);

    if (reducedMotion) {
      this.revealObserver = null;
    } else {
      this.revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
            entry.target.dataset.in = "true";
            this.revealObserver?.unobserve(entry.target);
          }
        },
        { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
      );
      for (const element of root.querySelectorAll("[data-reveal]")) {
        this.revealObserver.observe(element);
      }
      window.addEventListener("pointermove", this.onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", this.onPointerLeave);
    }

    if (this.live) {
      window.addEventListener("wheel", this.onWheel, { passive: false });
      document.addEventListener("click", this.onClick);
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    } else {
      this.requestStill();
    }
  }

  /** Starts the intro burst once the loader has finished. */
  reveal(): void {
    this.revealed = true;
  }

  /** A ripple across the field: used when a specification validates. */
  pulse(): void {
    if (this.live) this.pulseAt = this.time;
  }

  /**
   * A red disturbance for a rejected validation. A live scene flashes and settles by
   * itself; still frames stay tinted for as long as the rejection is shown.
   */
  setAlert(active: boolean): void {
    if (this.live) {
      if (active) this.alertLevel = 1;
      return;
    }
    this.alertLevel = active ? 1 : 0;
    this.requestStill();
  }

  /** 1 when the local stack is ready; lower values dim and desaturate the scene. */
  setHealth(value: number): void {
    this.healthTarget = clamp(value, 0, 1);
    this.requestStill();
  }

  destroy(): void {
    const { canvas, root } = this.options;
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.stillFrame);
    this.resizeObserver.disconnect();
    this.revealObserver?.disconnect();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("pointermove", this.onPointerMove);
    document.documentElement.removeEventListener("pointerleave", this.onPointerLeave);
    document.removeEventListener("click", this.onClick);
    document.removeEventListener("visibilitychange", this.onVisibility);
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.releaseHover();
    this.engine?.dispose();
    this.engine = null;
    delete root.dataset.cursor;
  }

  private createEngine(): void {
    const { canvas, root } = this.options;
    try {
      const engine = new Engine(canvas);
      // Software renderers start at the lowest level and may climb one step at most.
      const ceiling = engine.software ? 1 : TIERS.length - 1;
      const start = engine.software ? 0 : Math.min(2, ceiling);
      this.engine = engine;
      this.governor = new QualityGovernor(start, ceiling);
      root.dataset.renderer = "webgl2";
      delete root.dataset.rendererReason;
      this.applyTier(start);
    } catch (error) {
      this.showStaticBackdrop(error);
    }
  }

  /** No WebGL2, or the scene cannot be drawn: say so and show the static backdrop. */
  private showStaticBackdrop(error: unknown): void {
    const { root, onRenderer } = this.options;
    const reason = error instanceof Error ? error.message : "WebGL2 is not available.";
    this.engine = null;
    this.governor = null;
    root.dataset.renderer = "static";
    root.dataset.rendererReason = reason;
    console.warn(`LightSprint is showing its static backdrop: ${reason}`);
    onRenderer({ mode: "static", reason });
  }

  private applyTier(index: number): void {
    this.engine?.setTier(index);
    this.report();
  }

  private report(): void {
    const engine = this.engine;
    if (!engine) return;
    this.options.onRenderer({ mode: "webgl2", particles: engine.particles, live: this.live });
  }

  /** Even the lowest quality is too slow to animate: switch to still frames for good. */
  private stopAnimating(): void {
    const { root } = this.options;
    this.live = false;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    window.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("click", this.onClick);
    // Finish a glide in progress instead of leaving the page short of where it was sent.
    if (this.scrolling) window.scrollTo(0, this.scrollTarget);
    this.scrolling = false;
    this.intro = 1;
    this.pulseAt = -1;
    this.alertLevel = 0;
    root.dataset.loop = "still";
    delete root.dataset.cursor;
    this.report();
    this.requestStill();
  }

  private measure(): void {
    const scroll = window.scrollY;
    this.viewport = Math.max(1, window.innerHeight);
    this.scrollLimit = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    this.bands = this.sections.map((section) => {
      const box = section.getBoundingClientRect();
      return { top: box.top + scroll, bottom: box.bottom + scroll };
    });
    if (this.hero) this.heroHeight = Math.max(1, this.hero.getBoundingClientRect().height);
    if (this.pin) {
      const box = this.pin.getBoundingClientRect();
      this.pinTop = box.top + scroll;
      this.pinHeight = box.height;
    }
    const { canvas } = this.options;
    this.engine?.setViewport(canvas.clientWidth, canvas.clientHeight);
  }

  /**
   * Schedules one still frame. Scrolling passes `redraw = false`: the scroll-linked
   * variables always update, but the scene is drawn again only when it changes.
   */
  private requestStill(redraw = true): void {
    if (this.live) return;
    if (redraw) this.stillDirty = true;
    if (this.stillFrame) return;
    this.stillFrame = requestAnimationFrame(() => {
      this.stillFrame = 0;
      this.update(0);
    });
  }

  private readonly tick = (now: number): void => {
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    this.frame = requestAnimationFrame(this.tick);
    this.govern(elapsed);
    if (this.live) this.update(clamp(elapsed, 0.001, MAX_STEP));
  };

  private govern(elapsed: number): void {
    const governor = this.governor;
    if (!governor) return;
    const action = governor.frame(elapsed);
    if (action === "lower" || action === "raise") this.applyTier(governor.current);
    else if (action === "still" && this.options.render !== "live") this.stopAnimating();
  }

  private update(delta: number): void {
    const live = this.live;
    if (live) {
      this.time += delta;
      this.stepScroll(delta);
    }
    const scroll = window.scrollY;
    const target = sceneAt(scroll + this.viewport / 2, this.bands, this.viewport);

    if (live) {
      if (Math.abs(target - this.scene) < 0.0004) this.scene = target;
      else this.scene += (target - this.scene) * approach(5, delta);
      if (this.revealed && this.intro < 1) {
        this.intro = Math.min(1, this.intro + delta / INTRO_SECONDS);
      }
      this.pointerX += (this.pointerTargetX - this.pointerX) * approach(6, delta);
      this.pointerY += (this.pointerTargetY - this.pointerY) * approach(6, delta);
      this.force += (this.forceTarget - this.force) * approach(5, delta);
      this.forceTarget = Math.max(
        this.pointerSeen ? 0.32 : 0,
        this.forceTarget * Math.exp(-2.4 * delta),
      );
      this.alertLevel *= Math.exp(-1.2 * delta);
      this.health += (this.healthTarget - this.health) * approach(3, delta);
      this.moveCursor(delta);
    } else {
      // Still frames show whole scenes only, so nothing moves while the page scrolls.
      this.scene = Math.round(target);
      this.health = this.healthTarget;
    }

    this.writeVariables(scroll);

    if (!live) {
      if (!this.stillDirty && this.scene === this.renderedScene) return;
      this.stillDirty = false;
      this.renderedScene = this.scene;
    }
    this.draw(delta, live);
  }

  private draw(delta: number, live: boolean): void {
    const engine = this.engine;
    if (!engine) return;
    let pulse = -1;
    if (live && this.pulseAt >= 0) {
      pulse = this.time - this.pulseAt;
      if (pulse > 7) {
        this.pulseAt = -1;
        pulse = -1;
      }
    }
    try {
      engine.render({
        time: live ? this.time : STILL_TIME,
        delta,
        scene: this.scene,
        intro: this.intro,
        pointerX: live ? this.pointerX : 0,
        pointerY: live ? this.pointerY : 0,
        pointerForce: live ? this.force : 0,
        pulse,
        alert: this.alertLevel,
        health: this.health,
        trails: live,
      });
    } catch (error) {
      // A frame that cannot be drawn would otherwise fail again on every frame.
      engine.dispose();
      this.showStaticBackdrop(error);
    }
  }

  private writeVariables(scroll: number): void {
    const { root, reducedMotion } = this.options;
    this.write(root, "--page", clamp(scroll / this.scrollLimit, 0, 1), "page");
    if (this.hero) {
      this.write(this.hero, "--hero", clamp(scroll / (this.heroHeight * 0.75), 0, 1), "hero");
    }
    if (this.pin) {
      // With reduced motion the section is not pinned, so all of its text is lit.
      const progress = reducedMotion
        ? 1
        : pinProgress(scroll, this.pinTop, this.pinHeight, this.viewport);
      this.write(this.pin, "--p", progress, "pin");
    }
    const active = String(clamp(Math.round(this.scene), 0, 3));
    if (root.dataset.activeScene !== active) root.dataset.activeScene = active;
  }

  private write(element: HTMLElement, name: string, value: number, key: string): void {
    const text = value.toFixed(4);
    if (this.written.get(key) === text) return;
    this.written.set(key, text);
    element.style.setProperty(name, text);
  }

  private moveCursor(delta: number): void {
    if (!this.cursor) return;
    this.cursorX += (this.cursorTargetX - this.cursorX) * approach(16, delta);
    this.cursorY += (this.cursorTargetY - this.cursorY) * approach(16, delta);
    this.cursor.style.transform = `translate3d(${this.cursorX.toFixed(1)}px, ${this.cursorY.toFixed(1)}px, 0)`;
  }

  /** Eases the page toward the wheel target; any other scroll source takes over at once. */
  private stepScroll(delta: number): void {
    if (!this.scrolling) return;
    const remaining = this.scrollTarget - this.scrollCurrent;
    if (Math.abs(remaining) < 0.4) {
      this.scrollCurrent = this.scrollTarget;
      this.scrolling = false;
    } else {
      this.scrollCurrent += remaining * approach(9, delta);
    }
    window.scrollTo(0, this.scrollCurrent);
    this.scrollExpected = window.scrollY;
  }

  private glideTo(top: number): void {
    this.scrollCurrent = window.scrollY;
    this.scrollExpected = this.scrollCurrent;
    this.scrollTarget = clamp(top, 0, this.scrollLimit);
    this.scrolling = true;
  }

  private releaseHover(): void {
    this.magnet?.style.removeProperty("--mx");
    this.magnet?.style.removeProperty("--my");
    this.magnet = null;
    if (this.glow) delete this.glow.dataset.lit;
    this.glow = null;
  }

  private readonly onResize = (): void => {
    this.measure();
    this.requestStill();
  };

  private readonly onScroll = (): void => {
    if (this.scrolling && Math.abs(window.scrollY - this.scrollExpected) > 2) {
      this.scrolling = false;
    }
    this.requestStill(false);
  };

  private readonly onVisibility = (): void => {
    if (!this.live) return;
    if (document.hidden) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    } else if (!this.frame) {
      this.last = performance.now();
      this.governor?.settle();
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  private readonly onContextLost = (event: Event): void => {
    // Allow the browser to restore the context instead of leaving a dead canvas.
    event.preventDefault();
    this.engine = null;
    this.governor = null;
  };

  private readonly onContextRestored = (): void => {
    this.createEngine();
    this.measure();
    this.requestStill();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey || event.defaultPrevented) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (scrollsInside(event.target, event.deltaY)) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? this.viewport : 1;
    if (!this.scrolling) this.glideTo(window.scrollY);
    this.scrollTarget = clamp(this.scrollTarget + event.deltaY * unit, 0, this.scrollLimit);
  };

  private readonly onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const origin = event.target instanceof Element ? event.target : null;
    const anchor = origin?.closest<HTMLAnchorElement>('a[href^="#"]');
    const hash = anchor?.getAttribute("href");
    if (!hash || hash.length < 2) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    history.pushState(null, "", hash);
    const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    this.glideTo(target.getBoundingClientRect().top + window.scrollY - margin);
    target.focus({ preventScroll: true });
  };

  private readonly onPointerLeave = (): void => {
    this.pointerSeen = false;
    this.releaseHover();
    delete this.options.root.dataset.cursor;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const { root } = this.options;
    const mouse = event.pointerType === "mouse";
    if (this.live) {
      this.pointerTargetX = (event.clientX / window.innerWidth) * 2 - 1;
      this.pointerTargetY = 1 - (event.clientY / window.innerHeight) * 2;
      if (this.pointerSeen) {
        const travelled = Math.hypot(
          event.clientX - this.lastClientX,
          event.clientY - this.lastClientY,
        );
        this.forceTarget = Math.min(1.4, this.forceTarget + travelled * 0.012);
      } else if (mouse) {
        // Start the ring under the pointer instead of flying in from the corner.
        this.cursorX = event.clientX;
        this.cursorY = event.clientY;
      }
      this.lastClientX = event.clientX;
      this.lastClientY = event.clientY;
    }
    this.pointerSeen = true;
    if (!mouse) return;

    const origin = event.target instanceof Element ? event.target : null;
    if (this.live) {
      this.cursorTargetX = event.clientX;
      this.cursorTargetY = event.clientY;
      const cursor = origin?.closest("input, textarea")
        ? "text"
        : origin?.closest("a, button")
          ? "action"
          : "idle";
      if (root.dataset.cursor !== cursor) root.dataset.cursor = cursor;
    }

    const magnet = origin?.closest<HTMLElement>("[data-magnetic]") ?? null;
    const glow = origin?.closest<HTMLElement>("[data-glow]") ?? null;
    if (magnet !== this.magnet || glow !== this.glow) {
      this.releaseHover();
      this.magnet = magnet;
      this.glow = glow;
      if (glow) glow.dataset.lit = "true";
    }
    if (magnet) {
      const box = magnet.getBoundingClientRect();
      const x = (event.clientX - (box.left + box.width / 2)) * 0.2;
      const y = (event.clientY - (box.top + box.height / 2)) * 0.28;
      magnet.style.setProperty("--mx", `${x.toFixed(1)}px`);
      magnet.style.setProperty("--my", `${y.toFixed(1)}px`);
    }
    if (glow) {
      const box = glow.getBoundingClientRect();
      glow.style.setProperty("--gx", `${(event.clientX - box.left).toFixed(0)}px`);
      glow.style.setProperty("--gy", `${(event.clientY - box.top).toFixed(0)}px`);
    }
  };
}
