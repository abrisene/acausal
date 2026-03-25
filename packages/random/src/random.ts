/*
 # random.ts
 # Random Number Generator Service
 */

/**
 # Module Dependencies
 */

import { MersenneTwister19937, createEntropy, integer, real, pick } from './mersenne-twister';
import { WeightedDistribution } from './types';
import { CONSTANTS } from './constants';

/**
 # Types
 */

export interface RandomDTO {
  seed?: number | number[];
  uses?: number;
}

/**
 # Class
 */

export class Random {
  private _seed: number | number[];
  private _engine: MersenneTwister19937;

  constructor(config: RandomDTO) {
    this._seed = config.seed !== undefined ? config.seed : createEntropy();
    this._engine = Array.isArray(this._seed)
      ? MersenneTwister19937.seedWithArray(this._seed)
      : MersenneTwister19937.seed(this._seed);
    this._engine.discard(config.uses !== undefined ? config.uses : CONSTANTS.MT_PREWARM);
  }

  get seed() {
    return this._seed;
  }

  get uses() {
    return this._engine.getUseCount();
  }

  /** @internal */
  public integer(min: number, max: number) {
    return integer(min, max)(this._engine);
  }

  /** @internal */
  public real(min: number, max: number, inclusive?: boolean) {
    return real(min, max, inclusive)(this._engine);
  }

  /**
   * Generate a random integer in [min, max] (inclusive).
   */
  public int(min: number, max: number) {
    return this.integer(min, max);
  }

  /**
   * Generate a random float in [min, max).
   */
  public float(min: number, max: number, inclusive?: boolean) {
    return this.real(min, max, inclusive);
  }

  public bool(percentage = 0.5) {
    return this.real(0, 1) < percentage;
  }

  public pick<T>(source: ArrayLike<T>, begin?: number, end?: number) {
    return pick(this._engine, source, begin, end);
  }

  /**
   * Picks a weighted key from a normalized object, ignoring masked values.
   * @param {object} object   An object containing normalized number values.
   * @param {array}  mask     Array of keys to be ignored while evaluating.
   */
  public pickWeighted(object: WeightedDistribution, mask?: string[]): string | undefined {
    const keys = Object.keys(object);

    // Compute sum of unmasked, positive weights
    let totalWeight = 0;
    for (const key of keys) {
      const weight = object[key];
      if (weight === undefined || weight <= 0) continue;
      if (mask && mask.includes(key)) continue;
      totalWeight += weight;
    }
    if (totalWeight <= 0) return undefined;

    // Draw proportional to unmasked weights
    const value = this.real(0, 1) * totalWeight;
    let sum = 0;
    for (const key of keys) {
      const weight = object[key];
      if (weight === undefined || weight <= 0) continue;
      if (mask && mask.includes(key)) continue;
      sum += weight;
      if (sum >= value) return key;
    }
    return undefined;
  }

  public clone(useCount?: number) {
    return new Random({ seed: this._seed, uses: useCount ?? this.uses });
  }

  public serialize(): RandomDTO {
    return {
      seed: this._seed,
      uses: this.uses,
    };
  }

  public static new(seed?: number | number[], uses?: number) {
    return new Random({ seed, uses });
  }
}
