/*
 # merge.test.js
 # Scalr Merge Function Tests
 */

/**
 # Module Dependencies
 */

import {
  mergeAverageObjects,
  mergeDifferenceObjects,
  mergeNormalizeObjects,
  mergeObjects,
  mergeProductObjects,
  mergeQuotientObjects,
  mergeScaleObjects,
  mergeStandardDeviationObjects,
  mergeSumObjects,
} from '../merge';

/**
 # Constants
 */

const a0 = { a: 0, b: 0, c: 0 };
const a1 = { a: 1, b: 1, c: 1 };
const a2 = { a: 2, b: 2, c: 2 };
const a3 = { a: 3, b: 3, c: 3 };

const b0 = { a: 10 };
const b1 = { b: 10 };
const b2 = { c: 10 };

const c0 = { a: 20, b: 20, c: 20, d: 20 };
const c1 = { a: 20, b: 20 };
const c2 = { c: 20, d: 20 };

/**
 # Tests
 */

test('Objects are merged correctly.', () => {
  expect(mergeObjects(v => v, c1, c2)).toEqual({
    a: [20],
    b: [20],
    c: [20],
    d: [20],
  });
  expect(mergeObjects(v => v, b0, b1, b2)).toEqual({
    a: [10],
    b: [10],
    c: [10],
  });
  expect(mergeObjects(v => v, a0, a1)).toEqual({
    a: [0, 1],
    b: [0, 1],
    c: [0, 1],
  });
});

// Normalization & Scaling

test('Merged objects normalize properly.', () => {
  expect(mergeNormalizeObjects(a1, a1)).toEqual({
    a: [0.5, 0.5],
    b: [0.5, 0.5],
    c: [0.5, 0.5],
  });
});

test('Merged objects scale properly.', () => {
  expect(mergeScaleObjects(2, a1, a1)).toEqual({
    a: [1, 1],
    b: [1, 1],
    c: [1, 1],
  });
});

// Math

test('Merged objects sum properly.', () => {
  expect(mergeSumObjects(a0, a1)).toEqual(a1);
  expect(mergeSumObjects(a0, a1, a2)).toEqual(a3);
  expect(mergeSumObjects(c1, c2)).toEqual(c0);
});

test('Merged objects subtract properly.', () => {
  expect(mergeDifferenceObjects(a0, a1)).toEqual({ a: -1, b: -1, c: -1 });
});

test('Merged objects multiply properly.', () => {
  expect(mergeProductObjects(a0, a1)).toEqual(a0);
  expect(mergeProductObjects(a1, a2)).toEqual(a2);
});

test('Merged objects divide properly.', () => {
  expect(mergeQuotientObjects(a2, a2)).toEqual(a1);
});

// Statistics

test('Merged objects average properly.', () => {
  expect(mergeAverageObjects(a2, a2)).toEqual({ a: 2, b: 2, c: 2 });
  expect(mergeAverageObjects(a1, a2, a3)).toEqual({ a: 2, b: 2, c: 2 });
});

test('Merged objects find the standard deviation properly.', () => {
  expect(mergeStandardDeviationObjects(a1, a2, a3)).toEqual({
    a: 0.816496580927726,
    b: 0.816496580927726,
    c: 0.816496580927726,
  });
});
