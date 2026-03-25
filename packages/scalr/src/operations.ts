/*
 # operations.ts
 # Mathematical Operation Utilities
 */

/**
 # Module Dependencies
 */

import { ScalableObject, ScalableCollection } from './types';

/**
 # Functions
 */

/**
 * Finds the sum of an array of numbers.
 * @param array An array of numbers.
 */
export function sumArray(array: number[]) {
  return array.reduce((a, b) => a + b, 0);
}

/**
 * Finds the sum of an object of number values.
 * @param object An array of numbers.
 */
export function sumObject(object: ScalableObject) {
  return sumArray(Object.values(object));
}

/**
 * Finds the sum of an array or an object of number values.
 * @param collection An object or an array containing only number values.
 */
export function sum(collection: ScalableCollection) {
  return Array.isArray(collection)
    ? sumArray(collection)
    : sumObject(collection);
}

/**
 * Finds the difference of an array of numbers.
 * The first value populates the initial value, while any subsequent are subtracted.
 * @param array An array of numbers.
 */
export function differenceArray(array: number[]) {
  return array.reduce((a, b, i) => (i === 0 ? b : a - b), 0);
}

/**
 * Finds the difference of an object of number values.
 * The first value populates the initial value, while any subsequent are subtracted.
 * Sorts the keys before subtraction to determine ordering and ensure consistency.
 * @param object An object containing only number values.
 */
export function differenceObject(object: ScalableObject) {
  return Object.keys(object)
    .sort((a, b) => 0 - (b > a ? 1 : -1))
    .reduce((a, b, i) => (i === 0 ? object[b] : a - object[b]), 0);
}

/**
 * Finds the difference of an array or an object of number values.
 * For objects this sorts the keys before subtraction to ensure consistent result.
 * @param collection An object or an array containing only number values.
 */
export function difference(collection: ScalableCollection) {
  return Array.isArray(collection)
    ? differenceArray(collection)
    : differenceObject(collection);
}

/**
 * Finds the product of an array of numbers.
 * @param array An array of numbers.
 */
export function productArray(array: number[]) {
  return array.reduce((a, b) => a * b, 1);
}

/**
 * Finds the product of an object of number values.
 * @param object An object containing only number values.
 */
export function productObject(object: ScalableObject) {
  return productArray(Object.values(object));
}

/**
 * Finds the product of an array or an object of number values.
 * @param collection An object or an array containing only number values.
 */
export function product(collection: ScalableCollection) {
  return Array.isArray(collection)
    ? productArray(collection)
    : productObject(collection);
}

/**
 * Finds the quotient of an array of numbers.
 * @param array An array of numbers.
 */
export function quotientArray(array: number[]) {
  return array.reduce((a, b, i) => (i === 0 ? b : a / b), 0);
}

/**
 * Finds the quotient of an object of number values.
 * The first value populates the initial value, while any subsequent are used to calculate the quotient.
 * Sorts the keys before division to ensure consistent result.
 * @param object An object containing only number values.
 */
export function quotientObject(object: ScalableObject) {
  return Object.keys(object)
    .sort((a, b) => 0 - (b > a ? 1 : -1))
    .reduce((a, b, i) => (i === 0 ? object[b] : a / object[b]), 0);
}

/**
 * Finds the quotient of an array or an object of number values.
 * The first value populates the initial value, while any subsequent are used to calculate the quotient.
 * For objects this sorts the keys before division to ensure consistent result.
 * @param collection An object or an array containing only number values.
 */
export function quotient(collection: ScalableCollection) {
  return Array.isArray(collection)
    ? quotientArray(collection)
    : quotientObject(collection);
}
