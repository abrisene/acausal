/*
 # mersenne-twister.ts
 # Mersenne Twister 19937 PRNG Implementation
 # Reference: Makoto Matsumoto and Takuji Nishimura (1998)
 */

// MT19937 constants
const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

export class MersenneTwister19937 {
  private mt: Int32Array;
  private mti: number;
  private _useCount: number;

  private constructor() {
    this.mt = new Int32Array(N);
    this.mti = N + 1;
    this._useCount = 0;
  }

  static seed(seed: number): MersenneTwister19937 {
    const engine = new MersenneTwister19937();
    engine._seed(seed);
    return engine;
  }

  static seedWithArray(initKey: number[]): MersenneTwister19937 {
    const engine = new MersenneTwister19937();
    engine._seedWithArray(initKey);
    return engine;
  }

  private _seed(s: number): void {
    this.mt[0] = s >>> 0;
    for (this.mti = 1; this.mti < N; this.mti++) {
      const prev = this.mt[this.mti - 1]!;
      // Knuth TAOCP Vol2 3rd Ed. P.106 for multiplier
      this.mt[this.mti] = (Math.imul(1812433253, prev ^ (prev >>> 30)) + this.mti) >>> 0;
    }
  }

  private _seedWithArray(initKey: number[]): void {
    this._seed(19650218);
    let i = 1;
    let j = 0;
    let k = N > initKey.length ? N : initKey.length;

    for (; k > 0; k--) {
      const prev = this.mt[i - 1]!;
      this.mt[i] = ((this.mt[i]! ^ Math.imul(prev ^ (prev >>> 30), 1664525)) + initKey[j]! + j) >>> 0;
      i++;
      j++;
      if (i >= N) {
        this.mt[0] = this.mt[N - 1]!;
        i = 1;
      }
      if (j >= initKey.length) j = 0;
    }

    for (k = N - 1; k > 0; k--) {
      const prev = this.mt[i - 1]!;
      this.mt[i] = ((this.mt[i]! ^ Math.imul(prev ^ (prev >>> 30), 1566083941)) - i) >>> 0;
      i++;
      if (i >= N) {
        this.mt[0] = this.mt[N - 1]!;
        i = 1;
      }
    }

    this.mt[0] = 0x80000000;
  }

  next(): number {
    let y: number;
    const mag01 = [0, MATRIX_A];

    if (this.mti >= N) {
      let kk: number;

      for (kk = 0; kk < N - M; kk++) {
        y = (this.mt[kk]! & UPPER_MASK) | (this.mt[kk + 1]! & LOWER_MASK);
        this.mt[kk] = this.mt[kk + M]! ^ (y >>> 1) ^ mag01[y & 0x1]!;
      }
      for (; kk < N - 1; kk++) {
        y = (this.mt[kk]! & UPPER_MASK) | (this.mt[kk + 1]! & LOWER_MASK);
        this.mt[kk] = this.mt[kk + (M - N)]! ^ (y >>> 1) ^ mag01[y & 0x1]!;
      }
      y = (this.mt[N - 1]! & UPPER_MASK) | (this.mt[0]! & LOWER_MASK);
      this.mt[N - 1] = this.mt[M - 1]! ^ (y >>> 1) ^ mag01[y & 0x1]!;

      this.mti = 0;
    }

    y = this.mt[this.mti++]!;

    // Tempering
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;

    this._useCount++;
    return y | 0; // Return as signed int32
  }

  discard(count: number): this {
    for (let i = 0; i < count; i++) {
      this.next();
    }
    return this;
  }

  getUseCount(): number {
    return this._useCount;
  }
}

/**
 * Generate entropy for seeding
 */
export function createEntropy(): number[] {
  return [Date.now(), (Math.random() * 0x100000000) >>> 0];
}

/**
 * Generate a uniform integer in [min, max] from the engine.
 * Uses rejection sampling to avoid modulo bias.
 */
export function integer(min: number, max: number): (engine: MersenneTwister19937) => number {
  return (engine: MersenneTwister19937): number => {
    const range = max - min;
    if (range === 0) return min;
    if (range === 0xffffffff) return (engine.next() >>> 0) + min;

    const rangeU = (range >>> 0) + 1;
    // Rejection sampling to avoid modulo bias
    const limit = (-rangeU >>> 0) % rangeU >>> 0;

    let value: number;
    do {
      value = engine.next() >>> 0;
    } while (value < limit);

    return (value % rangeU) + min;
  };
}

/**
 * Generate a uniform real in [min, max) or [min, max].
 * Uses 53-bit resolution for doubles.
 */
export function real(min: number, max: number, inclusive = false): (engine: MersenneTwister19937) => number {
  return (engine: MersenneTwister19937): number => {
    const a = engine.next() >>> 5; // 27 bits
    const b = engine.next() >>> 6; // 26 bits
    const denom = inclusive ? 0x1fffffffffffff : 0x20000000000000; // 2^53 - 1 or 2^53
    const value = (a * 0x4000000 + b) / denom;
    return value * (max - min) + min;
  };
}

/**
 * Pick a random element from an array-like source.
 */
export function pick<T>(engine: MersenneTwister19937, source: ArrayLike<T>, begin?: number, end?: number): T {
  const start = begin ?? 0;
  const stop = end ?? source.length;
  const index = integer(start, stop - 1)(engine);
  return source[index]!;
}
