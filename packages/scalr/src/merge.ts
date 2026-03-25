/*
 # merge.ts
 # Merge Utilities
 */

/**
 # Module Dependencies
 */

import { normalizeArray, scaleNormalArray } from './normalize';
import {
  differenceArray,
  productArray,
  quotientArray,
  sumArray,
} from './operations';
import { averageArray, standardDeviationArray } from './statistics';
import { ScalableObject } from './types';

/**
 # Types
 */

/**
 # Functions
 */

/**
 * Generates a joined dictionary of all values for an array of objects.
 * @param args  The objects to join.
 * @returns     The joined dictionary.
 */
function objectToValueTable<T>(
  ...args: Record<string | number, T>[]
): Record<string, T[]> {
  return args.reduce((table, obj) => {
    Object.keys(obj).forEach(key => {
      if (!table[key]) {
        table[key] = [];
      }
      table[key].push(obj[key]);
    });
    return table;
  }, {} as Record<string, T[]>);
}

/**
 * Merges objects and resolves values for identical keys using the provided function.
 * @param fn    The function to resolve values for identical keys.
 * @param args  The objects to merge.
 * @returns     The merged object.
 */
export function mergeObjects<T = number, V = T>(
  fn: (v: T[]) => V,
  ...args: Record<string | number, T>[]
): Record<string, V> {
  // Generate the Table
  const table = objectToValueTable(...args);

  // Apply the Join Function
  return Object.keys(table).reduce(
    (obj, key) => ({ ...obj, [key]: fn(table[key]) }),
    {} as Record<string, V>
  );
}

/**
 * USER FACING APIs
 */

// NORMALIZATION

export function mergeNormalizeObjects(
  ...args: ScalableObject[]
): Record<string, number[]> {
  return mergeObjects(normalizeArray, ...args);
}

export function mergeScaleObjects(
  scale: number,
  ...args: ScalableObject[]
): Record<string, number[]> {
  const fn = (v: number[]) => scaleNormalArray(v, scale);
  return mergeObjects(fn, ...args);
}

// MATH

/**
 * Merges objects, resolving values of identical keys by summing.
 * @param args The objects to sum.
 * @returns The merged sums of the objects.
 */
export function mergeSumObjects(...args: ScalableObject[]): ScalableObject {
  return mergeObjects(sumArray, ...args);
}

/**
 * Merges objects, resolving values of identical keys by finding the difference.
 * @param args The objects to subtract.
 * @returns The merged difference of the objects.
 */
export function mergeDifferenceObjects(
  ...args: ScalableObject[]
): ScalableObject {
  return mergeObjects(differenceArray, ...args);
}

/**
 * Merges objects, resolving values of identical keys by multiplying.
 * @param args The objects to multiply.
 * @returns The merged product of the objects.
 */
export function mergeProductObjects(...args: ScalableObject[]): ScalableObject {
  return mergeObjects(productArray, ...args);
}

/**
 * Merges objects, resolving values of identical keys by multiplying.
 * @param args The objects to multiply.
 * @returns The merged product of the objects.
 */
export function mergeQuotientObjects(
  ...args: ScalableObject[]
): ScalableObject {
  return mergeObjects(quotientArray, ...args);
}

// STATISTICS

/**
 * Merges objects, resolving values of identical keys by averaging.
 * @param args The objects to average.
 * @returns The merged averages of the keys of objects.
 */
export function mergeAverageObjects(...args: ScalableObject[]): ScalableObject {
  return mergeObjects(averageArray, ...args);
}

/**
 * Merges objects, resolving values of identical keys by finding the standard deviation.
 * @param args The objects to find the standard deviations of.
 * @returns The merged averages of the keys of objects.
 */
export function mergeStandardDeviationObjects(
  ...args: ScalableObject[]
): ScalableObject {
  return mergeObjects(standardDeviationArray, ...args);
}
