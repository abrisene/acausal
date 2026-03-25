/*
 # normalize.ts
 # Normalization Utilities
 */

/**
 # Module Dependencies
 */

import { ScalableObject, ScalableCollection } from './types';
import { sumArray, sumObject } from './operations';

/**
 # Types
 */

// type NormalObject = { [key: string]: number } & { [key: number]: number };

/**
 # Functions
 */

/**
 * NORMAL ARRAYS
 */

/**
 * Normalizes an array of values to the defined scaling value (default 1)
 * @param array    An array of numbers.
 * @param scale    Scale that the sum of the array should add up to.
 */
export function scaleNormalArray(array: number[], scale = 1): number[] {
  const sum = sumArray(array);
  return array.map(v => (v / sum) * scale);
}

/**
 * Normalizes an array of values to 1.
 * @param array     An array of numbers.
 */
export function normalizeArray(array: number[]) {
  return scaleNormalArray(array, 1);
}

/**
 * Validates whether or not an array of numbers is normalized to a scaled unit value (default 1).
 * @param array         An array of numbers.
 * @param scale         Scale that the sum of the array should add up to (Default 1).
 * @param tolerance     The tolerable variablity in comparison to account for floating point math.
 *                      Defaults to Number.EPSILON.
 */
export function isScaledNormalArray(
  array: number[],
  scale = 1,
  tolerance = Number.EPSILON
): boolean {
  const sum = sumArray(array);
  return sum === scale
    ? true
    : Math.abs(Math.fround(scale) - Math.fround(sum)) < tolerance;
}

/**
 * Validates whether or not an array of numbers is normalized.
 * @param array         An array of numbers.
 * @param tolerance     The tolerable variablity in comparison to account for floating point math.
 *                      Defaults to Number.EPSILON.
 */
export function isNormalizedArray(
  array: number[],
  tolerance = Number.EPSILON
): boolean {
  return isScaledNormalArray(array, 1, tolerance);
}

/**
 * NORMAL OBJECTS
 */

/**
 * Normalizes an object containing only numerical values to the defined scaling value (default 1)
 * @param object   An object containing only number values.
 * @param scale    Scale that the sum of the values of the object should add up to.
 */
export function scaleNormalObject(object: Record<string, number>, scale = 1) {
  const sum = sumObject(object);
  return Object.keys(object).reduce(
    (a, b) => ({ ...a, [b]: (object[b] / sum) * scale }),
    {} as Record<string, number>
  );
}

/**
 * Normalizes an object of values to 1.
 * @param collection  An object containing only number values.
 */
export function normalizeObject(object: ScalableObject) {
  return scaleNormalObject(object, 1);
}

/**
 * USER FACING APIs
 */

/**
 * Normalizes an object or an array of values to the defined scaling value (default 1).
 * @param collection    An object or an array of numbers.
 * @param scale         Scale that the sum of the array or object should add up to.  Defaults to 1.
 */
export function scale(collection: ScalableCollection, scale = 1) {
  let result: number[] | ScalableObject;
  if (Array.isArray(collection)) {
    result = scaleNormalArray(collection, scale);
  } else {
    result = scaleNormalObject(collection, scale);
  }
  return result;
}

/**
 * Normalizes an object or an array of values to 1.
 * @param collection  An object or an array of numbers.
 */
export function normalize(collection: ScalableCollection) {
  return scale(collection, 1);
}
