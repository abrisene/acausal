/*
 # sampler.ts
 # RandomSampler - Statistical Distribution Sampling
 #
 # Provides sampling from common probability distributions (normal, exponential,
 # Poisson, binomial, geometric, beta, gamma) built on top of the seeded Random
 # class for deterministic reproducibility.
 */

/**
 # Module Dependencies
 */

import { Random, RandomDTO } from './random';
import { WeightedDistribution } from '../types';

/**
 # Types
 */

export type RandomSamplerDTO = RandomDTO;

/**
 * Distribution parameter types for data-driven sampling.
 * Each type can be used with `RandomSampler.sampleDistribution()`.
 */

export interface UniformParams {
  type: 'uniform';
  min: number;
  max: number;
}

export interface NormalParams {
  type: 'normal';
  mu: number;
  sigma: number;
}

export interface LogNormalParams {
  type: 'logNormal';
  mu: number;
  sigma: number;
}

export interface ExponentialParams {
  type: 'exponential';
  lambda: number;
}

export interface PoissonParams {
  type: 'poisson';
  lambda: number;
}

export interface BinomialParams {
  type: 'binomial';
  n: number;
  p: number;
}

export interface GeometricParams {
  type: 'geometric';
  p: number;
}

export interface BetaParams {
  type: 'beta';
  alpha: number;
  beta: number;
}

export interface GammaParams {
  type: 'gamma';
  k: number;
  theta?: number;
}

export interface BernoulliParams {
  type: 'bernoulli';
  p: number;
}

export interface WeibullParams {
  type: 'weibull';
  k: number;
  a?: number;
  b?: number;
}

export interface CauchyParams {
  type: 'cauchy';
  a?: number;
  b?: number;
}

export interface LogisticParams {
  type: 'logistic';
  a?: number;
  b?: number;
}

export type DistributionParams =
  | UniformParams
  | NormalParams
  | LogNormalParams
  | ExponentialParams
  | PoissonParams
  | BinomialParams
  | GeometricParams
  | BetaParams
  | GammaParams
  | BernoulliParams
  | WeibullParams
  | CauchyParams
  | LogisticParams;

/**
 # Class
 */

/**
 * RandomSampler provides statistical distribution sampling methods built on
 * top of the seeded MT19937 Random class. All methods are deterministic given
 * the same seed and use count.
 *
 * @example
 * ```typescript
 * const sampler = new RandomSampler({ seed: 42 });
 *
 * // Sample from distributions
 * sampler.normal(170, 7);         // height ~ N(170, 7)
 * sampler.uniform(1, 10);         // skin tone ~ U(1, 10)
 * sampler.weightedChoice({ red: 55, auburn: 25, strawberry_blonde: 20 });
 *
 * // Data-driven sampling
 * sampler.sampleDistribution({ type: 'normal', mu: 170, sigma: 7 });
 * ```
 */
export class RandomSampler {
  private _engine: Random;

  constructor(config: RandomSamplerDTO = {}) {
    this._engine = new Random({
      seed: config.seed,
      uses: config.uses,
    });
  }

  /**
   * Get the underlying Random instance.
   */
  get engine(): Random {
    return this._engine;
  }

  /**
   * Get the current seed.
   */
  get seed() {
    return this._engine.seed;
  }

  /**
   * Get the number of PRNG uses.
   */
  get uses(): number {
    return this._engine.uses;
  }

  // ===========================================================================
  // Basic Random
  // ===========================================================================

  /**
   * Generate a random float in [0, 1).
   */
  next(): number {
    return this._engine.real(0, 1);
  }

  /**
   * Generate a random float in [min, max).
   */
  float(min = 0, max = 1): number {
    return this._engine.real(min, max);
  }

  /**
   * Generate a random integer in [min, max] (inclusive).
   */
  int(min: number, max: number): number {
    return this._engine.integer(min, max);
  }

  /**
   * Generate a random boolean with given probability of true.
   */
  bool(probability = 0.5): boolean {
    return this._engine.bool(probability);
  }

  // ===========================================================================
  // Array Operations
  // ===========================================================================

  /**
   * Pick a random element from an array.
   */
  choice<T>(array: T[]): T {
    return this._engine.pick(array);
  }

  /**
   * Pick multiple random elements from an array (with replacement).
   */
  choices<T>(array: T[], count: number): T[] {
    const result: T[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.choice(array));
    }
    return result;
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm. Returns a new array.
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  /**
   * Sample from an array without replacement.
   */
  sample<T>(array: T[], count: number): T[] {
    if (count >= array.length) {
      return this.shuffle(array);
    }
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, count);
  }

  /**
   * Pick a weighted key from an object. Weights do not need to be normalized.
   */
  weightedChoice(weights: WeightedDistribution, mask?: string[]): string | undefined {
    return this._engine.pickWeighted(weights, mask);
  }

  // ===========================================================================
  // Continuous Distributions
  // ===========================================================================

  /**
   * Sample from a normal (Gaussian) distribution using Box-Muller transform.
   * Consumes exactly 2 uniform draws per call.
   *
   * @param mu - Mean (default 0)
   * @param sigma - Standard deviation (default 1)
   */
  normal(mu = 0, sigma = 1): number {
    if (sigma < 0) throw new RangeError('normal: sigma must be >= 0');
    if (sigma === 0) return mu;
    const u1 = 1 - this.next(); // (0, 1] — avoids log(0) singularity
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * sigma + mu;
  }

  /**
   * Sample from a truncated normal distribution.
   * Uses clamping (not rejection) for deterministic draw count.
   *
   * @param mu - Mean
   * @param sigma - Standard deviation
   * @param min - Lower bound (clamp)
   * @param max - Upper bound (clamp)
   */
  truncatedNormal(mu: number, sigma: number, min: number, max: number): number {
    if (sigma < 0) throw new RangeError('truncatedNormal: sigma must be >= 0');
    if (min > max) throw new RangeError('truncatedNormal: min must be <= max');
    return Math.max(min, Math.min(max, this.normal(mu, sigma)));
  }

  /**
   * Sample from a log-normal distribution.
   *
   * @param mu - Mean of the underlying normal distribution
   * @param sigma - Standard deviation of the underlying normal distribution
   */
  logNormal(mu = 0, sigma = 1): number {
    if (sigma < 0) throw new RangeError('logNormal: sigma must be >= 0');
    return Math.exp(this.normal(mu, sigma));
  }

  /**
   * Sample from an exponential distribution.
   *
   * @param lambda - Rate parameter (default 1)
   */
  exponential(lambda = 1): number {
    if (!(lambda > 0)) throw new RangeError('exponential: lambda must be > 0');
    return -Math.log(1 - this.next()) / lambda;
  }

  /**
   * Sample from a uniform distribution.
   *
   * @param min - Minimum value (default 0)
   * @param max - Maximum value (default 1)
   */
  uniform(min = 0, max = 1): number {
    if (min > max) throw new RangeError('uniform: min must be <= max');
    return this.float(min, max);
  }

  /**
   * Sample from a gamma distribution using Marsaglia and Tsang's method.
   *
   * @param k - Shape parameter (must be > 0)
   * @param theta - Scale parameter (default 1)
   */
  gamma(k: number, theta = 1): number {
    if (!(k > 0)) throw new RangeError('gamma: shape k must be > 0');
    if (!(theta > 0)) throw new RangeError('gamma: scale theta must be > 0');
    if (k < 1) {
      // For k < 1, use the transformation: Gamma(k) = Gamma(k+1) * U^(1/k)
      return this.gamma(k + 1, theta) * Math.pow(this.next(), 1 / k);
    }

    // Marsaglia and Tsang's method for k >= 1
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    for (;;) {
      let x: number;
      let v: number;

      do {
        x = this.normal();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = this.next();

      if (u < 1 - 0.0331 * (x * x) * (x * x)) {
        return d * v * theta;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v * theta;
      }
    }
  }

  /**
   * Sample from a beta distribution.
   *
   * @param alpha - Shape parameter alpha (must be > 0)
   * @param beta - Shape parameter beta (must be > 0)
   */
  beta(alpha: number, beta: number): number {
    if (!(alpha > 0)) throw new RangeError('beta: alpha must be > 0');
    if (!(beta > 0)) throw new RangeError('beta: beta must be > 0');
    const x = this.gamma(alpha);
    const y = this.gamma(beta);
    return x / (x + y);
  }

  // ===========================================================================
  // Discrete Distributions
  // ===========================================================================

  /**
   * Sample from a Poisson distribution.
   * Uses Knuth's algorithm for small lambda, normal approximation for large.
   *
   * @param lambda - Expected number of occurrences
   */
  poisson(lambda: number): number {
    if (!(lambda >= 0)) throw new RangeError('poisson: lambda must be >= 0');
    if (lambda < 30) {
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;

      do {
        k++;
        p *= this.next();
      } while (p > L);

      return k - 1;
    } else {
      return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
    }
  }

  /**
   * Sample from a binomial distribution.
   *
   * @param n - Number of trials
   * @param p - Probability of success per trial
   */
  binomial(n: number, p: number): number {
    if (n < 0 || !Number.isInteger(n)) throw new RangeError('binomial: n must be a non-negative integer');
    if (p < 0 || p > 1) throw new RangeError('binomial: p must be in [0, 1]');
    let successes = 0;
    for (let i = 0; i < n; i++) {
      if (this.bool(p)) {
        successes++;
      }
    }
    return successes;
  }

  /**
   * Sample from a geometric distribution.
   * Returns the number of trials until first success.
   *
   * @param p - Probability of success per trial
   */
  geometric(p: number): number {
    if (!(p > 0) || p > 1) throw new RangeError('geometric: p must be in (0, 1]');
    return Math.floor(Math.log(1 - this.next()) / Math.log(1 - p)) + 1;
  }

  /**
   * Sample from a Weibull distribution.
   *
   * @param k - Shape parameter
   * @param a - Scale parameter (default 1)
   * @param b - Location parameter (default 0)
   */
  weibull(k: number, a = 1, b = 0): number {
    if (!(k > 0)) throw new RangeError('weibull: shape k must be > 0');
    if (!(a > 0)) throw new RangeError('weibull: scale a must be > 0');
    return a * Math.pow(-Math.log(1 - this.next()), 1 / k) + b;
  }

  /**
   * Sample from a Cauchy distribution.
   *
   * @param a - Location parameter (default 0)
   * @param b - Scale parameter (default 1)
   */
  cauchy(a = 0, b = 1): number {
    if (!(b > 0)) throw new RangeError('cauchy: scale b must be > 0');
    return a + b * Math.tan(Math.PI * (this.next() - 0.5));
  }

  /**
   * Sample from a logistic distribution.
   *
   * @param a - Location parameter (default 0)
   * @param b - Scale parameter (default 1)
   */
  logistic(a = 0, b = 1): number {
    if (!(b > 0)) throw new RangeError('logistic: scale b must be > 0');
    const u = 1 - this.next(); // (0, 1] — avoids log(0) singularity
    return a + b * Math.log(u / (1 - u));
  }

  // ===========================================================================
  // Data-Driven Sampling
  // ===========================================================================

  /**
   * Sample from a distribution described by a parameter object.
   * Enables data-driven distribution definitions (e.g., from YAML config).
   *
   * @example
   * ```typescript
   * sampler.sampleDistribution({ type: 'normal', mu: 170, sigma: 7 });
   * sampler.sampleDistribution({ type: 'uniform', min: 1, max: 10 });
   * ```
   */
  sampleDistribution(params: DistributionParams): number {
    switch (params.type) {
      case 'uniform':
        return this.uniform(params.min, params.max);
      case 'normal':
        return this.normal(params.mu, params.sigma);
      case 'logNormal':
        return this.logNormal(params.mu, params.sigma);
      case 'exponential':
        return this.exponential(params.lambda);
      case 'poisson':
        return this.poisson(params.lambda);
      case 'binomial':
        return this.binomial(params.n, params.p);
      case 'geometric':
        return this.geometric(params.p);
      case 'beta':
        return this.beta(params.alpha, params.beta);
      case 'gamma':
        return this.gamma(params.k, params.theta);
      case 'bernoulli':
        return this.bool(params.p) ? 1 : 0;
      case 'weibull':
        return this.weibull(params.k, params.a, params.b);
      case 'cauchy':
        return this.cauchy(params.a, params.b);
      case 'logistic':
        return this.logistic(params.a, params.b);
    }
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Clone the sampler, optionally resetting use count.
   */
  clone(useCount?: number): RandomSampler {
    return new RandomSampler({
      seed: this.seed,
      uses: useCount ?? this.uses,
    });
  }

  /**
   * Serialize the sampler state for storage/transfer.
   */
  serialize(): RandomSamplerDTO {
    return {
      seed: this.seed,
      uses: this.uses,
    };
  }

  /**
   * Create a new RandomSampler with optional seed.
   */
  static create(seed?: number | number[], uses?: number): RandomSampler {
    return new RandomSampler({ seed, uses });
  }
}
