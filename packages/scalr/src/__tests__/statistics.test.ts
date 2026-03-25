/*
 # statistics.test.js
 # Scalr Statistical Operations Tests
 */

/**
 # Module Dependencies
 */

import { average, mean, standardDeviation, stDev } from '..';

/**
 # Constants
 */

const a0 = [1, 2, 3];
const a1 = [50, 25, 15];
const a2 = [500, 200, 5];

const o0 = { a: 1, b: 2, c: 3 };
const o1 = { a: 50, b: 25, c: 15 };
const o2 = { a: 500, b: 200, c: 5 };

/**
 # Tests
 */

test('Averages compute correctly for arrays.', () => {
  expect(average(a0)).toEqual(2);
  expect(average(a1)).toEqual(30);
  expect(average(a2)).toEqual(235);

  expect(mean(a0)).toEqual(2);
  expect(mean(a1)).toEqual(30);
  expect(mean(a2)).toEqual(235);
});

test('Averages compute correctly for objects.', () => {
  expect(average(o0)).toEqual(2);
  expect(average(o1)).toEqual(30);
  expect(average(o2)).toEqual(235);

  expect(mean(o0)).toEqual(2);
  expect(mean(o1)).toEqual(30);
  expect(mean(o2)).toEqual(235);
});

test('Standard Deviation computes correctly for arrays.', () => {
  expect(standardDeviation(a0)).toBeCloseTo(0.8164965809);
  expect(standardDeviation(a1)).toBeCloseTo(14.71960144);
  expect(standardDeviation(a2)).toBeCloseTo(203.5927307);

  expect(stDev(a0)).toBeCloseTo(0.8164965809);
  expect(stDev(a1)).toBeCloseTo(14.71960144);
  expect(stDev(a2)).toBeCloseTo(203.5927307);
});

test('Standard Deviation computes correctly for objects.', () => {
  expect(standardDeviation(o0)).toBeCloseTo(0.8164965809);
  expect(standardDeviation(o1)).toBeCloseTo(14.71960144);
  expect(standardDeviation(o2)).toBeCloseTo(203.5927307);

  expect(stDev(o0)).toBeCloseTo(0.8164965809);
  expect(stDev(o1)).toBeCloseTo(14.71960144);
  expect(stDev(o2)).toBeCloseTo(203.5927307);
});
