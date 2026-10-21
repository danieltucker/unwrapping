/**
 * Token buckets held in this process's memory.
 *
 * In memory because an instance is one Node process (see
 * src/lib/price-check-schedule.ts for the same reasoning), and because nothing
 * about who is being limited should outlive the minute it matters in. A restart
 * forgets everything, which only ever errs towards letting events in.
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  /** The most a key can spend at once. */
  private readonly capacity: number;
  /** Tokens returned per second. */
  private readonly refillPerSecond: number;
  private readonly now: () => number;

  // Plain fields rather than parameter properties, which the tests' Node
  // can't strip: see scripts/lib/app-hooks.mjs.
  constructor(capacity: number, refillPerSecond: number, now: () => number = Date.now) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.now = now;
  }

  /** Spends `cost` tokens for `key` if it has them. All or nothing. */
  take(key: string, cost = 1): boolean {
    const now = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, at: now };
    const tokens = Math.min(
      this.capacity,
      bucket.tokens + ((now - bucket.at) / 1000) * this.refillPerSecond,
    );

    const ok = tokens >= cost;
    this.buckets.set(key, { tokens: ok ? tokens - cost : tokens, at: now });

    // Full buckets carry no information, so they're what gets dropped when the
    // map grows; a flood of one-off keys can't exhaust memory.
    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) {
        if (b.tokens + ((now - b.at) / 1000) * this.refillPerSecond >= this.capacity) {
          this.buckets.delete(k);
        }
      }
      // Still full of fresh keys: forget them all rather than grow without end.
      if (this.buckets.size > 10_000) this.buckets.clear();
    }
    return ok;
  }
}
