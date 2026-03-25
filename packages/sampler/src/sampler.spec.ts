/*
 # sampler.spec.ts
 # RandomSampler Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RandomSampler } from './sampler';

describe('RandomSampler', () => {
  describe('constructor and basic properties', () => {
    it('should create with default config', () => {
      const sampler = new RandomSampler();
      expect(sampler).toBeDefined();
      expect(sampler.seed).toBeDefined();
      expect(typeof sampler.uses).toBe('number');
      expect(sampler.engine).toBeDefined();
    });

    it('should create with specific seed', () => {
      const sampler = new RandomSampler({ seed: 42 });
      expect(sampler.seed).toBe(42);
    });

    it('should create with array seed', () => {
      const sampler = new RandomSampler({ seed: [1, 2, 3, 4] });
      expect(sampler.seed).toEqual([1, 2, 3, 4]);
    });
  });

  describe('basic random methods', () => {
    it('should produce consistent sequences with same seed', () => {
      const s1 = new RandomSampler({ seed: 42 });
      const s2 = new RandomSampler({ seed: 42 });
      expect(s1.next()).toBe(s2.next());
      expect(s1.next()).toBe(s2.next());
      expect(s1.next()).toBe(s2.next());
    });

    it('should generate float values in range', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        const value = sampler.float(5, 10);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThan(10);
      }
    });

    it('should generate integer values in range', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        const value = sampler.int(1, 6);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('should generate boolean values with correct probability', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const trueCount = Array.from({ length: 1000 }, () => sampler.bool(0.7)).filter(Boolean).length;
      expect(trueCount).toBeGreaterThan(640);
      expect(trueCount).toBeLessThan(760);
    });
  });

  describe('array methods', () => {
    const testArray = ['a', 'b', 'c', 'd', 'e'];
    let sampler: RandomSampler;

    beforeEach(() => {
      sampler = new RandomSampler({ seed: 42 });
    });

    it('should pick elements from array', () => {
      const choice = sampler.choice(testArray);
      expect(testArray).toContain(choice);
    });

    it('should pick multiple choices with replacement', () => {
      const choices = sampler.choices(testArray, 10);
      expect(choices).toHaveLength(10);
      choices.forEach(choice => expect(testArray).toContain(choice));
    });

    it('should shuffle array', () => {
      const shuffled = sampler.shuffle(testArray);
      expect(shuffled).toHaveLength(testArray.length);
      expect([...shuffled].sort()).toEqual([...testArray].sort());
    });

    it('should sample without replacement', () => {
      const s = sampler.sample(testArray, 3);
      expect(s).toHaveLength(3);
      expect(new Set(s).size).toBe(3);
      s.forEach(item => expect(testArray).toContain(item));
    });

    it('should return full shuffled array when count >= length', () => {
      const s = sampler.sample(testArray, 10);
      expect(s).toHaveLength(testArray.length);
      expect([...s].sort()).toEqual([...testArray].sort());
    });
  });

  describe('weighted choice', () => {
    it('should respect weights', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const weights = { a: 0.1, b: 0.8, c: 0.1 };
      const counts: Record<string, number> = { a: 0, b: 0, c: 0 };

      for (let i = 0; i < 1000; i++) {
        const pick = sampler.weightedChoice(weights);
        if (pick) counts[pick]!++;
      }

      expect(counts.b).toBeGreaterThan(counts.a!);
      expect(counts.b).toBeGreaterThan(counts.c!);
    });

    it('should respect mask', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const weights = { a: 0.5, b: 0.5 };
      const choice = sampler.weightedChoice(weights, ['a']);
      expect(choice).toBe('b');
    });
  });

  describe('normal distribution', () => {
    it('should produce values centered on mu', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: 2000 }, () => sampler.normal(100, 10));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(mean).toBeGreaterThan(97);
      expect(mean).toBeLessThan(103);
    });

    it('should produce values with correct spread', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: 2000 }, () => sampler.normal(0, 1));
      const variance = values.reduce((sum, v) => sum + v * v, 0) / values.length;
      // Variance should be close to 1 (sigma^2)
      expect(variance).toBeGreaterThan(0.8);
      expect(variance).toBeLessThan(1.2);
    });
  });

  describe('truncated normal distribution', () => {
    it('should clamp values within bounds', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 500; i++) {
        const value = sampler.truncatedNormal(5, 3, 1, 10);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    it('should produce values centered on mu when bounds are wide', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: 2000 }, () => sampler.truncatedNormal(5, 1, 0, 10));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(mean).toBeGreaterThan(4.7);
      expect(mean).toBeLessThan(5.3);
    });
  });

  describe('exponential distribution', () => {
    it('should produce positive values', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        expect(sampler.exponential(1)).toBeGreaterThan(0);
      }
    });
  });

  describe('poisson distribution', () => {
    it('should produce non-negative integers', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        const value = sampler.poisson(3);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('should use normal approximation for large lambda', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: 500 }, () => sampler.poisson(50));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(mean).toBeGreaterThan(45);
      expect(mean).toBeLessThan(55);
    });
  });

  describe('binomial distribution', () => {
    it('should produce integers in [0, n]', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        const value = sampler.binomial(10, 0.5);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(10);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });

  describe('geometric distribution', () => {
    it('should produce positive integers', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        const value = sampler.geometric(0.3);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });

  describe('beta distribution', () => {
    it('should produce values in [0, 1]', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        const value = sampler.beta(2, 5);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    it('should produce values centered appropriately', () => {
      const sampler = new RandomSampler({ seed: 42 });
      // Beta(2, 5) has mean = 2/(2+5) ≈ 0.286
      const values = Array.from({ length: 2000 }, () => sampler.beta(2, 5));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(mean).toBeGreaterThan(0.24);
      expect(mean).toBeLessThan(0.34);
    });
  });

  describe('gamma distribution', () => {
    it('should produce positive values', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        expect(sampler.gamma(2, 1)).toBeGreaterThan(0);
      }
    });

    it('should handle k < 1', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        expect(sampler.gamma(0.5, 1)).toBeGreaterThan(0);
      }
    });
  });

  describe('weibull distribution', () => {
    it('should produce positive values', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        expect(sampler.weibull(1.5)).toBeGreaterThan(0);
      }
    });
  });

  describe('cauchy distribution', () => {
    it('should produce real values', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        expect(typeof sampler.cauchy()).toBe('number');
        expect(isFinite(sampler.cauchy())).toBe(true);
      }
    });
  });

  describe('logistic distribution', () => {
    it('should produce real values', () => {
      const sampler = new RandomSampler({ seed: 42 });
      for (let i = 0; i < 100; i++) {
        const value = sampler.logistic();
        expect(typeof value).toBe('number');
        expect(isFinite(value)).toBe(true);
      }
    });
  });

  describe('sampleDistribution', () => {
    it('should dispatch to correct distribution method', () => {
      const sampler = new RandomSampler({ seed: 42 });

      const normal = sampler.sampleDistribution({ type: 'normal', mu: 0, sigma: 1 });
      expect(typeof normal).toBe('number');

      const uniform = sampler.sampleDistribution({ type: 'uniform', min: 0, max: 1 });
      expect(uniform).toBeGreaterThanOrEqual(0);
      expect(uniform).toBeLessThan(1);

      const poisson = sampler.sampleDistribution({ type: 'poisson', lambda: 5 });
      expect(Number.isInteger(poisson)).toBe(true);
      expect(poisson).toBeGreaterThanOrEqual(0);

      const bernoulli = sampler.sampleDistribution({ type: 'bernoulli', p: 0.5 });
      expect(bernoulli === 0 || bernoulli === 1).toBe(true);

      const logNormal = sampler.sampleDistribution({ type: 'logNormal', mu: 0, sigma: 0.5 });
      expect(logNormal).toBeGreaterThan(0);

      const exponential = sampler.sampleDistribution({ type: 'exponential', lambda: 2 });
      expect(exponential).toBeGreaterThan(0);

      const binomial = sampler.sampleDistribution({ type: 'binomial', n: 10, p: 0.5 });
      expect(Number.isInteger(binomial)).toBe(true);
      expect(binomial).toBeGreaterThanOrEqual(0);
      expect(binomial).toBeLessThanOrEqual(10);

      const geometric = sampler.sampleDistribution({ type: 'geometric', p: 0.3 });
      expect(Number.isInteger(geometric)).toBe(true);
      expect(geometric).toBeGreaterThanOrEqual(1);

      const beta = sampler.sampleDistribution({ type: 'beta', alpha: 2, beta: 5 });
      expect(beta).toBeGreaterThanOrEqual(0);
      expect(beta).toBeLessThanOrEqual(1);

      const gamma = sampler.sampleDistribution({ type: 'gamma', k: 2, theta: 1 });
      expect(gamma).toBeGreaterThan(0);

      const weibull = sampler.sampleDistribution({ type: 'weibull', k: 1.5, a: 1, b: 0 });
      expect(weibull).toBeGreaterThanOrEqual(0);

      const cauchy = sampler.sampleDistribution({ type: 'cauchy', a: 0, b: 1 });
      expect(typeof cauchy).toBe('number');
      expect(isFinite(cauchy)).toBe(true);

      const logistic = sampler.sampleDistribution({ type: 'logistic', a: 0, b: 1 });
      expect(typeof logistic).toBe('number');
      expect(isFinite(logistic)).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should clone with same seed', () => {
      const original = new RandomSampler({ seed: 42 });
      const cloned = original.clone();
      expect(cloned.seed).toBe(original.seed);
      expect(cloned).not.toBe(original);
    });

    it('should clone with specific use count', () => {
      const original = new RandomSampler({ seed: 42 });
      original.next();
      const cloned = original.clone(0);
      expect(cloned.uses).not.toBe(original.uses);
    });

    it('should serialize state', () => {
      const sampler = new RandomSampler({ seed: 42 });
      sampler.next();
      const serialized = sampler.serialize();
      expect(serialized.seed).toBe(42);
      expect(typeof serialized.uses).toBe('number');
    });

    it('should create via static method', () => {
      const sampler = RandomSampler.create(42);
      expect(sampler.seed).toBe(42);
    });
  });

  describe('reproducibility', () => {
    it('should produce identical sequences with same seed', () => {
      const s1 = new RandomSampler({ seed: 12345 });
      const s2 = new RandomSampler({ seed: 12345 });

      const seq1 = Array.from({ length: 10 }, () => s1.next());
      const seq2 = Array.from({ length: 10 }, () => s2.next());
      expect(seq1).toEqual(seq2);
    });

    it('should produce different sequences with different seeds', () => {
      const s1 = new RandomSampler({ seed: 12345 });
      const s2 = new RandomSampler({ seed: 54321 });

      const seq1 = Array.from({ length: 10 }, () => s1.next());
      const seq2 = Array.from({ length: 10 }, () => s2.next());
      expect(seq1).not.toEqual(seq2);
    });

    it('should produce identical normal samples with same seed', () => {
      const s1 = new RandomSampler({ seed: 99 });
      const s2 = new RandomSampler({ seed: 99 });

      const seq1 = Array.from({ length: 10 }, () => s1.normal(170, 7));
      const seq2 = Array.from({ length: 10 }, () => s2.normal(170, 7));
      expect(seq1).toEqual(seq2);
    });
  });

  describe('statistical validation', () => {
    const N = 10_000;

    function sampleStats(values: number[]) {
      const n = values.length;
      const mean = values.reduce((s, v) => s + v, 0) / n;
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
      return { mean, variance };
    }

    it('normal(100, 15): mean ~ 100, variance ~ 225', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.normal(100, 15));
      const { mean, variance } = sampleStats(values);
      expect(mean).toBeGreaterThan(98);
      expect(mean).toBeLessThan(102);
      expect(variance).toBeGreaterThan(200);
      expect(variance).toBeLessThan(250);
    });

    it('exponential(2): mean ~ 0.5, variance ~ 0.25', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.exponential(2));
      const { mean, variance } = sampleStats(values);
      expect(mean).toBeGreaterThan(0.45);
      expect(mean).toBeLessThan(0.55);
      expect(variance).toBeGreaterThan(0.2);
      expect(variance).toBeLessThan(0.3);
    });

    it('uniform(10, 20): mean ~ 15, variance ~ 8.33', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.uniform(10, 20));
      const { mean, variance } = sampleStats(values);
      expect(mean).toBeGreaterThan(14.5);
      expect(mean).toBeLessThan(15.5);
      expect(variance).toBeGreaterThan(7.5);
      expect(variance).toBeLessThan(9.2);
    });

    it('poisson(5): mean ~ 5, variance ~ 5, all non-negative integers', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.poisson(5));
      const { mean, variance } = sampleStats(values);
      expect(mean).toBeGreaterThan(4.7);
      expect(mean).toBeLessThan(5.3);
      expect(variance).toBeGreaterThan(4.5);
      expect(variance).toBeLessThan(5.5);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    it('binomial(20, 0.3): mean ~ 6, variance ~ 4.2, integers in [0, 20]', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.binomial(20, 0.3));
      const { mean, variance } = sampleStats(values);
      expect(mean).toBeGreaterThan(5.5);
      expect(mean).toBeLessThan(6.5);
      expect(variance).toBeGreaterThan(3.7);
      expect(variance).toBeLessThan(4.7);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(20);
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    it('geometric(0.25): mean ~ 4, all integers >= 1', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.geometric(0.25));
      const { mean } = sampleStats(values);
      expect(mean).toBeGreaterThan(3.6);
      expect(mean).toBeLessThan(4.4);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    it('beta(2, 5): mean ~ 0.286, variance ~ 0.0255', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.beta(2, 5));
      const { mean, variance } = sampleStats(values);
      expect(mean).toBeGreaterThan(0.26);
      expect(mean).toBeLessThan(0.31);
      expect(variance).toBeGreaterThan(0.022);
      expect(variance).toBeLessThan(0.03);
    });

    it('gamma(3, 2): mean ~ 6, variance ~ 12', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.gamma(3, 2));
      const { mean, variance } = sampleStats(values);
      expect(mean).toBeGreaterThan(5.5);
      expect(mean).toBeLessThan(6.5);
      expect(variance).toBeGreaterThan(10.5);
      expect(variance).toBeLessThan(13.5);
    });

    it('logNormal(0, 0.5): mean ~ 1.133, all values > 0', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.logNormal(0, 0.5));
      const { mean } = sampleStats(values);
      // Theoretical mean = exp(mu + sigma^2/2) = exp(0.125) ~ 1.133
      expect(mean).toBeGreaterThan(1.05);
      expect(mean).toBeLessThan(1.22);
      for (const v of values) {
        expect(v).toBeGreaterThan(0);
      }
    });

    it('weibull(2, 1): mean ~ 0.886, all values >= 0', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.weibull(2, 1));
      const { mean } = sampleStats(values);
      // Theoretical mean = a * Gamma(1 + 1/k) = 1 * Gamma(1.5) = sqrt(pi)/2 ~ 0.886
      expect(mean).toBeGreaterThan(0.83);
      expect(mean).toBeLessThan(0.94);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    });

    it('cauchy(0, 1): median ~ 0 (mean/variance undefined)', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.cauchy(0, 1));
      // Cauchy has no defined mean/variance; verify median is close to location parameter
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)]!;
      expect(median).toBeGreaterThan(-0.5);
      expect(median).toBeLessThan(0.5);
    });

    it('logistic(0, 1): mean ~ 0, variance ~ pi^2/3 ~ 3.29', () => {
      const sampler = new RandomSampler({ seed: 42 });
      const values = Array.from({ length: N }, () => sampler.logistic(0, 1));
      const { mean, variance } = sampleStats(values);
      expect(mean).toBeGreaterThan(-0.3);
      expect(mean).toBeLessThan(0.3);
      expect(variance).toBeGreaterThan(2.8);
      expect(variance).toBeLessThan(3.8);
    });
  });
});
