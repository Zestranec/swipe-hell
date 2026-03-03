/**
 * Mulberry32 — fast 32-bit seeded PRNG.
 * Produces deterministic sequences from any integer seed.
 */
export class RNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [0, max). */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Returns a new RNG forked from the current state (non-destructive branching). */
  fork(): RNG {
    return new RNG(this.nextInt(2147483647));
  }
}
