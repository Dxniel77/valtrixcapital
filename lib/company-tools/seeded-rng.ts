/** Small deterministic PRNG — same seed yields the same sequence for every user. */
export interface SeededRng {
  next: () => number;
  int: (max: number) => number;
}

export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(max: number) {
      if (max <= 0) return 0;
      return Math.floor(this.next() * max);
    },
  };
}
