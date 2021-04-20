/*
 # random.test.js
 # Random Class Test
 */

/**
 # Module Dependencies
 */

import { Random } from '..';

/**
 # Constants
 */

const engineA = new Random({});
const engineB = new Random({ ...engineA.serialize() });
const engineC = new Random({ seed: 25 });

const seqA: number[] = [];
const seqB: number[] = [];
const seqC: number[] = [];

for (let i = 0; i < 10; i += 1) {
  seqA.push(engineA.real(0, 1));
  seqB.push(engineB.real(0, 1));
  seqC.push(engineC.real(0, 1));
}

/**
 # Tests
 */

test('Seeded engines maintain parity.', () => {
  expect(seqA).toEqual(seqB);
});

test('Different seeds yield different results.', () => {
  expect(seqA).not.toEqual(seqC);
});
