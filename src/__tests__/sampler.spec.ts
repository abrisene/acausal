/*
 # sampler.spec.ts
 # RandomSampler Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RandomSampler } from '../services/sampler';

describe('RandomSampler', () => {
  describe('constructor and basic properties', () => {
    it('should create with default config', () => {
      const sampler = new RandomSampler();
      expect(sampler).toBeDefined();
      expect(sampler.seed).toBeDefined();
      expect(typeof sampler.uses).toBe('number');
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
      const trueCount = Array.from({ length: 1000 }, () => sampler.bool(0.7))
        .filter(Boolean).length;
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
      const values = Array.from({ length: 2000 }, () =>
        sampler.truncatedNormal(5, 1, 0, 10)
      );
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
});
