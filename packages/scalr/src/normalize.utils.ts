import { ScalableCollection, ScalableObject } from './types';
import { isScaledNormalArray } from './normalize';

/**
 * Validates whether or not an object of values is normalized.
 * @param object        An object containing only number values.
 * @param scale         Scale that the sum of the array should add up to (default 1).
 * @param tolerance     The tolerable variablity in comparison to account for floating point math.
 *                      Defaults to Number.EPSILON.
 */

export function isScaledNormalObject(
  object: ScalableObject,
  scale = 1,
  tolerance = Number.EPSILON
): boolean {
  return isScaledNormalArray(Object.values(object), scale, tolerance);
}
/**
 * Validates whether or not an object of values is normalized.
 * @param object        An object containing only number values.
 * @param tolerance     The tolerable variablity in comparison to account for floating point math.
 *                      Defaults to Number.EPSILON.
 */

export function isNormalizedObject(
  object: ScalableObject,
  tolerance = Number.EPSILON
): boolean {
  return isScaledNormalArray(Object.values(object), 1, tolerance);
}

/**
 * Validates whether or not an array or object is scaled to a defined value (default 1).
 * @param collection    An object or an array containing only number values.
 * @param scale         Scale that the sum of the array should add up to (default 1).
 * @param tolerance     The tolerable variablity in comparison to account for floating point math.
 *                      Defaults to Number.EPSILON.
 */
export function isScaled(
  collection: ScalableCollection,
  scale = 1,
  tolerance = Number.EPSILON
) {
  return Array.isArray(collection)
    ? isScaledNormalArray(collection, scale, tolerance)
    : isScaledNormalObject(collection, scale, tolerance);
}

/**
 * Validates whether or not an array or object of values is normalized.
 * @param object        An object or an array containing only number values.
 * @param tolerance     The tolerable variablity in comparison to account for floating point math.
 *                      Defaults to Number.EPSILON.
 */
export function isNormalized(
  collection: ScalableCollection,
  tolerance = Number.EPSILON
) {
  return Array.isArray(collection)
    ? isScaledNormalArray(collection, 1, tolerance)
    : isScaledNormalObject(collection, 1, tolerance);
}
