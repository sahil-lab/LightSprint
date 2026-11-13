export type QualityAction = "hold" | "lower" | "raise" | "still";

const WINDOW_FRAMES = 40;
const WINDOW_SECONDS = 1.5;
const MIN_FRAMES = 3;
const SETTLE_FRAMES = 12;
const SETTLE_SECONDS = 0.6;
// Frame durations in seconds: comfortably 60 per second, under about 37, under about 15.
const FAST_FRAME = 0.0185;
const SLOW_FRAME = 0.027;
const STILL_FRAME = 0.066;
const FAST_WINDOWS = 3;
const STILL_WINDOWS = 2;

/**
 * Decides from measured frame times when to change quality level, and when even the
 * lowest level is too slow to animate at all.
 */
export class QualityGovernor {
  private level: number;
  private ceiling: number;
  private samples: number[] = [];
  private total = 0;
  private settleFrames = SETTLE_FRAMES;
  private settleSeconds = SETTLE_SECONDS;
  private fastWindows = 0;
  private stillWindows = 0;

  constructor(level: number, ceiling: number) {
    this.ceiling = Math.max(0, ceiling);
    this.level = Math.min(Math.max(0, level), this.ceiling);
  }

  get current(): number {
    return this.level;
  }

  /** Discards the next few frames. Call after a pause, when timings are not representative. */
  settle(): void {
    this.samples = [];
    this.total = 0;
    this.settleFrames = SETTLE_FRAMES;
    this.settleSeconds = SETTLE_SECONDS;
  }

  /** Records one frame's duration in seconds and returns the change it calls for. */
  frame(seconds: number): QualityAction {
    if (this.settleFrames > 0 && this.settleSeconds > 0) {
      this.settleFrames -= 1;
      this.settleSeconds -= seconds;
      return "hold";
    }
    this.samples.push(seconds);
    this.total += seconds;
    const full = this.samples.length >= WINDOW_FRAMES;
    const longEnough = this.total >= WINDOW_SECONDS && this.samples.length >= MIN_FRAMES;
    if (!full && !longEnough) return "hold";

    // The median ignores a single long frame, such as a garbage collection pause.
    this.samples.sort((a, b) => a - b);
    const median = this.samples[this.samples.length >> 1] ?? 0;
    this.samples = [];
    this.total = 0;

    if (median > STILL_FRAME) {
      this.fastWindows = 0;
      if (this.level > 0) {
        this.level = 0;
        this.ceiling = 0;
        this.settle();
        return "lower";
      }
      this.stillWindows += 1;
      return this.stillWindows >= STILL_WINDOWS ? "still" : "hold";
    }
    this.stillWindows = 0;
    if (median > SLOW_FRAME && this.level > 0) {
      // Never climb back to a level that has already proven too slow.
      this.level -= 1;
      this.ceiling = this.level;
      this.fastWindows = 0;
      this.settle();
      return "lower";
    }
    if (median < FAST_FRAME && this.level < this.ceiling) {
      this.fastWindows += 1;
      if (this.fastWindows < FAST_WINDOWS) return "hold";
      this.fastWindows = 0;
      this.level += 1;
      this.settle();
      return "raise";
    }
    this.fastWindows = 0;
    return "hold";
  }
}
