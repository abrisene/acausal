/*
 # normalize.ts
 # Normalization Utilities
 */

/**
 # Module Dependencies
 */

import * as randomjs from 'random-js';
import { WeightedDistribution } from '..';
import { CONSTANTS } from '..';

/**
 # Types
 */

export interface RandomDTO {
  seed?: number | number[];
  uses?: number;
}

/**
 # Constants
 */

// const MT_PREWARM = 2000;
const defaultDTO: RandomDTO = {};

/**
 # Class
 */

export class Random {
  private _seed: number | number[];
  private _engine: randomjs.MersenneTwister19937;

  constructor(config: RandomDTO) {
    this._seed =
      config.seed !== undefined ? config.seed : randomjs.createEntropy();
    this._engine = Array.isArray(this._seed)
      ? randomjs.MersenneTwister19937.seedWithArray(this._seed)
      : randomjs.MersenneTwister19937.seed(this._seed);
    this._engine.discard(
      config.uses !== undefined ? config.uses : CONSTANTS.MT_PREWARM
    );
  }

  get seed() {
    return this._seed;
  }

  get uses() {
    return this._engine.getUseCount();
  }

  public integer(min: number, max: number) {
    return randomjs.integer(min, max)(this._engine);
  }

  public real(min: number, max: number, inclusive?: boolean) {
    return randomjs.real(min, max, inclusive)(this._engine);
  }

  public bool(percentage = 0.5) {
    return randomjs.bool(percentage)(this._engine);
  }

  public pick<T>(source: ArrayLike<T>, begin?: number, end?: number) {
    return randomjs.pick(this._engine, source, begin, end);
  }

  /**
   * Picks a weighted key from a normalized object, ignoring masked values.
   * @param {object} object   An object containing normalized number values.
   * @param {array}  mask     Array of keys to be ignored while evaluating.
   */
  public pickWeighted(
    object: WeightedDistribution,
    mask?: string[]
  ): string | undefined {
    const value = this.real(0, 1);
    let lastValid: string;
    let result: string | undefined = undefined;
    let sum = 0;

    Object.keys(object).some(key => {
      sum += object[key];
      if (!mask || !mask.includes(key)) {
        if (sum >= value) {
          result = key;
        } else {
          lastValid = key;
        }
      } else if (sum >= value) {
        result = lastValid;
      }
      return result !== undefined;
    });

    return result;
  }

  public serialize(): RandomDTO {
    return {
      seed: this._seed,
      uses: this.uses,
    };
  }

  public clone(useCount?: number) {
    return new Random({ seed: this._seed, uses: useCount || this.uses });
  }

  public static new(seed?: number | number[], uses?: number) {
    return new Random({ seed, uses });
  }
}
