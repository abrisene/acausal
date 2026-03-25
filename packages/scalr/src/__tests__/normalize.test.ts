/*
 # index.test.js
 # Scalr Index Test
 */

/**
 # Module Dependencies
 */

import {
  scaleNormalArray,
  scaleNormalObject,
  normalizeArray,
  normalizeObject,
  scale,
  normalize,
  sumArray,
  sumObject,
  isScaled,
  isScaledNormalArray,
  isScaledNormalObject,
  isNormalized,
  isNormalizedArray,
  isNormalizedObject,
} from '..';

/**
 # Constants
 */

const arrayA = [1, 1, 1];
const arrayB = [1, 2, 3];

const arrayNrmA = normalizeArray(arrayA);
const arrayNrmB = normalizeArray(arrayB);

const arrayScA = scaleNormalArray(arrayA, 6);

const objA = { a: 1, b: 1, c: 1 };
const objB = { a: 1, b: 2, c: 3 };

const objNrmA = normalizeObject(objA);
const objNrmB = normalizeObject(objB);

const objScA = scaleNormalObject(objA, 6);

const arrayFloatA = [5.33, 5.2];

/**
 # Tests
 */

test('Arrays normalize properly.', () => {
  expect(sumArray(arrayNrmA)).toBeCloseTo(1);
  expect(sumArray(arrayNrmB)).toBeCloseTo(1);
});

test('Objects normalize properly.', () => {
  expect(sumObject(objNrmA)).toBeCloseTo(1);
  expect(sumObject(objNrmB)).toBeCloseTo(1);
});

test('Arrays scale properly.', () => {
  expect(sumArray(arrayScA)).toBeCloseTo(6);
});

test('Objects scale properly.', () => {
  expect(sumObject(objScA)).toBeCloseTo(6);
});

test('Generic normalization works with arbitrary arrays and objects.', () => {
  // Arrays
  expect(normalizeArray(arrayA)).toStrictEqual(arrayNrmA);
  expect(normalizeArray(arrayB)).toStrictEqual(arrayNrmB);

  expect(normalize(arrayA)).toStrictEqual(arrayNrmA);
  expect(normalize(arrayB)).toStrictEqual(arrayNrmB);

  expect(scaleNormalArray(arrayA)).toStrictEqual(arrayNrmA);
  expect(scaleNormalArray(arrayB)).toStrictEqual(arrayNrmB);

  expect(scale(arrayA)).toStrictEqual(arrayNrmA);
  expect(scale(arrayB)).toStrictEqual(arrayNrmB);

  // Objects
  expect(normalizeObject(objA)).toStrictEqual(objNrmA);
  expect(normalizeObject(objB)).toStrictEqual(objNrmB);

  expect(normalize(objA)).toStrictEqual(objNrmA);
  expect(normalize(objB)).toStrictEqual(objNrmB);

  expect(scaleNormalObject(objA)).toStrictEqual(objNrmA);
  expect(scaleNormalObject(objB)).toStrictEqual(objNrmB);

  expect(scale(objA)).toStrictEqual(objNrmA);
  expect(scale(objB)).toStrictEqual(objNrmB);
});

test('Generic scaling works with arbitrary arrays and objects.', () => {
  expect(scale(arrayA, 6)).toStrictEqual(arrayScA);
  expect(scale(objA, 6)).toStrictEqual(objScA);
});

test('Validation functions detect scaled structures properly.', () => {
  // Arrays
  expect(isScaledNormalArray(scaleNormalArray(arrayA, 6), 6)).toEqual(true);
  expect(isScaledNormalArray(scaleNormalArray(arrayB, 25.33), 25.33)).toEqual(
    true
  );
  expect(isScaledNormalArray(scaleNormalArray(arrayA, 600.5), 600.5)).toEqual(
    true
  );
  expect(isScaledNormalArray(scaleNormalArray(arrayB, 0.3355), 0.3355)).toEqual(
    true
  );

  expect(isScaled(scale(arrayA, 6), 6)).toEqual(true);
  expect(isScaled(scale(arrayB, 25.33), 25.33)).toEqual(true);
  expect(isScaled(scale(arrayA, 600.5), 600.5)).toEqual(true);
  expect(isScaled(scale(arrayB, 0.3355), 0.3355)).toEqual(true);

  // Objects
  expect(isScaledNormalObject(scaleNormalObject(objA, 6), 6)).toEqual(true);
  expect(isScaledNormalObject(scaleNormalObject(objB, 25.33), 25.33)).toEqual(
    true
  );
  expect(isScaledNormalObject(scaleNormalObject(objA, 600.5), 600.5)).toEqual(
    true
  );
  expect(isScaledNormalObject(scaleNormalObject(objB, 0.3355), 0.3355)).toEqual(
    true
  );

  expect(isScaled(scale(objA, 6), 6)).toEqual(true);
  expect(isScaled(scale(objB, 25.33), 25.33)).toEqual(true);
  expect(isScaled(scale(objA, 600.5), 600.5)).toEqual(true);
  expect(isScaled(scale(objB, 0.3355), 0.3355)).toEqual(true);

  // Tolerance
  expect(isScaled(arrayScA, 6, 0)).toEqual(true);
  expect(isScaled(objScA, 6, 0)).toEqual(true);
});

test('Validation functions detect normalized structures properly.', () => {
  // Arrays
  expect(isNormalizedArray(arrayNrmA)).toEqual(true);
  expect(isNormalizedArray(arrayNrmB)).toEqual(true);

  expect(isScaledNormalArray(arrayNrmA)).toEqual(true);
  expect(isScaledNormalArray(arrayNrmB)).toEqual(true);

  expect(isNormalized(arrayNrmA)).toEqual(true);
  expect(isNormalized(arrayNrmB)).toEqual(true);

  expect(isScaled(arrayNrmA)).toEqual(true);
  expect(isScaled(arrayNrmB)).toEqual(true);

  // Objects
  expect(isNormalizedObject(objNrmA)).toEqual(true);
  expect(isNormalizedObject(objNrmB)).toEqual(true);

  expect(isScaledNormalObject(objNrmA)).toEqual(true);
  expect(isScaledNormalObject(objNrmB)).toEqual(true);

  expect(isNormalized(objNrmA)).toEqual(true);
  expect(isNormalized(objNrmB)).toEqual(true);

  expect(isScaled(objNrmA)).toEqual(true);
  expect(isScaled(objNrmB)).toEqual(true);

  // Tolerance
  expect(isNormalized(arrayNrmA, 0)).toEqual(true);
  expect(isNormalized(arrayNrmB, 0)).toEqual(true);

  expect(isScaled(arrayNrmA, 1, 0)).toEqual(true);
  expect(isScaled(arrayNrmB, 1, 0)).toEqual(true);
});

test('Validation functions can handle floating point edge cases.', () => {
  expect(isScaled(arrayFloatA, 10.53)).toEqual(true);
});
