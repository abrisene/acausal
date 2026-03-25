/*
 # statistics.ts
 # Statistical Operation Utilities
 */

/**
 # Module Dependencies
 */

import { ScalableObject, ScalableCollection } from './types';
import { sumArray, sumObject } from './operations';

/**
 # Functions
 */

/**
 * Finds the average of an array of numbers.
 * @param array An array of numbers.
 */
export function averageArray(array: number[]) {
  return sumArray(array) / array.length;
}

/**
 * Finds the average of an object of number values.
 * @param object An object containing only number values.
 */
export function averageObject(object: ScalableObject) {
  return sumObject(object) / Object.values(object).length;
}

/**
 * Finds the average of an array or an object of number values.
 * @param collection An object or an array containing only number values.
 */
export function average(collection: ScalableCollection) {
  return Array.isArray(collection)
    ? averageArray(collection)
    : averageObject(collection);
}

/**
 * Finds the average of an array or an object of number values.
 * Identical to average().
 * @param collection An object or an array containing only number values.
 */
export function mean(collection: ScalableCollection) {
  return average(collection);
}

/**
 * Finds the standard deviation of an array of numbers.
 * @param array An array of numbers.
 */
export function standardDeviationArray(array: number[]) {
  const mean = averageArray(array);
  const squareDiffs = array.map(v => Math.pow(v - mean, 2));
  const meanSquares = averageArray(squareDiffs);
  return Math.sqrt(meanSquares);
}

/**
 * Finds the standard deviation of an object of number values.
 * @param object An object containing only number values.
 */
export function standardDeviationObject(object: ScalableObject) {
  return standardDeviationArray(Object.values(object));
}

/**
 * Finds the standard deviation of an array or an object of number values.
 * @param collection An object or an array containing only number values.
 */
export function standardDeviation(collection: ScalableCollection) {
  return Array.isArray(collection)
    ? standardDeviationArray(collection)
    : standardDeviationObject(collection);
}

/**
 * Finds the standard deviation of an array or an object of number values.
 * Identical to standardDeviation().
 * @param collection An object or an array containing only number values.
 */
export function stDev(collection: ScalableCollection) {
  return standardDeviation(collection);
}
