/*
 # random.test.js
 # Random Class Test
 */

/**
 # Module Dependencies
 */

import { CONSTANTS, Random } from '..';

/**
 # Constants
 */

/**
 # Tests
 */

describe('Random engine class', () => {
  it('can create new random engines', () => {
    const engA = new Random({});
    expect(engA).toHaveProperty('seed');
    expect(engA.uses).toEqual(CONSTANTS.MT_PREWARM);

    const engB = new Random({ seed: 25 });
    expect(engB.seed).toEqual(25);
    expect(engB.uses).toEqual(CONSTANTS.MT_PREWARM);

    const engC = new Random({ seed: 50, uses: 500 });
    expect(engC.seed).toEqual(50);
    expect(engC.uses).toEqual(500);

    const engD = Random.new(50, 500);
    expect(engD).toEqual(engC);
  });
  it('can define a seed that yields reproducable results', () => {
    const engA = new Random({ seed: 250 });
    const engB = new Random({ seed: 250 });
    const engC = new Random({ seed: 15 });

    const seqA: number[] = [];
    const seqB: number[] = [];
    const seqC: number[] = [];

    for (let i = 0; i < 100; i += 1) {
      seqA.push(engA.real(0, 1));
      seqB.push(engB.real(0, 1));
      seqC.push(engC.real(0, 1));
    }

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });
  it('can be instantiated with a number of prewarmed uses', () => {
    const engA = new Random({ seed: 250, uses: 100 });
    const engB = new Random({ seed: 250, uses: 100 });
    const engC = new Random({ seed: 250, uses: 500 });

    const seqA: number[] = [];
    const seqB: number[] = [];
    const seqC: number[] = [];

    for (let i = 0; i < 50; i += 1) {
      seqA.push(engA.real(0, 1));
      seqB.push(engB.real(0, 1));
      seqC.push(engC.real(0, 1));
    }

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });
  it('can clone existing random engines', () => {
    const engA = new Random({ seed: 250, uses: 100 });
    const engB = engA.clone();
    const engC = engA.clone(101);

    expect(engA).toEqual(engB);
    expect(engA.seed).toEqual(engC.seed);
    expect(engC.uses).toEqual(101);

    const seqA: number[] = [];
    const seqB: number[] = [];

    for (let i = 0; i < 50; i += 1) {
      seqA.push(engA.real(0, 1));
      seqB.push(engB.real(0, 1));
    }

    expect(seqA).toEqual(seqB);
  });
  it('can be serialized / deserialized from a dto', () => {
    const dto = { seed: 250, uses: 50000 };
    const engA = new Random(dto);
    expect(engA.serialize()).toEqual(dto);
  });
  it('can generate random integers', () => {
    const engA = new Random({ seed: 250, uses: 100 });
    const engB = new Random({ seed: 250, uses: 100 });
    const engC = new Random({ seed: 250, uses: 500 });

    for (let i = 1; i < 50; i += 1) {
      const pullA = engA.integer(0, i);
      const pullB = engB.integer(i, i + 50);
      const pullC = engC.integer(i + 1, i * 3);

      expect(Number.isInteger(pullA)).toBe(true);
      expect(Number.isInteger(pullB)).toBe(true);
      expect(Number.isInteger(pullC)).toBe(true);

      expect(pullA >= 0 && pullA <= i).toBe(true);
      expect(pullB >= i && pullB <= i + 50).toBe(true);
      expect(pullC >= i + 1 && pullC <= i * 3).toBe(true);
    }
  });
  it('can generate random real numbers', () => {
    const engA = new Random({ seed: 250, uses: 100 });
    const engB = new Random({ seed: 250, uses: 100 });
    const engC = new Random({ seed: 250, uses: 500 });

    for (let i = 1; i < 50; i += 1) {
      const pullA = engA.real(0, i);
      const pullB = engB.real(i, i + 2, true);
      const pullC = engC.real(i + 1, i * 3);

      expect(Number.isInteger(pullA)).toBe(false);
      expect(Number.isInteger(pullB)).toBe(false);
      expect(Number.isInteger(pullC)).toBe(false);

      expect(pullA >= 0 && pullA <= i).toBe(true);
      expect(pullB >= i && pullB < i + 50).toBe(true);
      expect(pullC >= i + 1 && pullC < i * 3).toBe(true);
    }
  });
  it('can generate random booleans', () => {
    const engA = new Random({ seed: 250, uses: 100 });

    for (let i = 1; i < 50; i += 1) {
      expect([true, false]).toContain(engA.bool());
      expect([true, false]).toContain(engA.bool(0.25));
      expect(engA.bool(0)).toEqual(false);
      expect(engA.bool(1)).toEqual(true);
    }
  });
  it('can pick a random item from an array', () => {
    const engA = new Random({ seed: 250, uses: 100 });
    const seqA = ['a', 'b', 'c', 'd', 'e', 'f'];
    const seqB = seqA.slice(2, 4);

    for (let i = 1; i < 50; i += 1) {
      expect(seqA).toContain(engA.pick(seqA));
      expect(seqB).toContain(engA.pick(seqA, 2, 4));
    }
  });
  it('can pick a key from a weighted distribution object', () => {
    const engA = new Random({ seed: 250, uses: 100 });
    const seqA = { a: 0.2, b: 0.2, c: 0.6 };

    for (let i = 1; i < 50; i += 1) {
      expect(Object.keys(seqA)).toContain(engA.pickWeighted(seqA));
      expect(['a', 'b']).toContain(engA.pickWeighted(seqA, ['c']));
    }
  });
});
