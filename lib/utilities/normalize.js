/*
 # normalize.js
 # Normalization Utilities
 */

/**
 # Module Dependencies
 */

/**
 # Methods
 */

/**
 * Normalizes an array of values to the defined scaling value (default 1)
 * @param {array} array     An array of integers.
 * @param {number} scale    Scale that the sum of the array should add up to.
 */
const normalizeArray = (array, scale = 1) => {
  const sum = array.reduce((a, b) => a + b);
  return array.map(a => (a / sum) * scale);
};

/**
 * Normalizes an object containing only numerical values to the defined scaling value (default 1)
 * @param {object} object   An object containing only number values.
 * @param {number} scale    Scale that the sum of the values of the object should add up to.
 */
const normalizeObject = (object, scale = 1) => {
  const sum = Object.keys(object).reduce((a, b) => a + object[b], 0);
  return Object.keys(object).reduce((a, b) => ({ ...a, [b]: (object[b] / sum) * scale }), {});
};

/**
 * Returns a object normalized to the defined scale (default 1) with each value representing the
 * sum of all previously observed values. Key order is NOT guaranteed.
 *
 * ex. { a: 0.2, b: 0.2, c: 0.6 } => { a: 0.2, b: 0.4, c: 1 }
 *
 * @param {object} object   Object containing only number values.
 * @param {number} scale    Scale that the sum of the values of the object should add up to.
 */
const normalizeWeights = (object, scale = 1) => {
  const sum = Object.keys(object).reduce((a, b) => a + object[b], 0);
  let accumulator = 0;
  return Object.keys(object).reduce((a, b) => {
    accumulator += (object[b] / sum) * scale;
    return { ...a, [b]: accumulator };
  }, {});
};

/**
 * Picks a weight from an object normalizeObject() method, ignoring masked values.
 * This works in a manner identical to normalizeWeights(), but does it in-place
 * as it checks each value in the object.
 * @param {object} object   An object containing only number values.
 * @param {number} value    Number to evaluate the object's keys against.
 * @param {array} mask      Array of keys to be ignored while evaluating.
 */
const pickWeight = (object = {}, value, mask = []) => {
  const keys = Object.keys(object);
  let result;
  let lastValid;
  let accumulator = 0;

  keys.some((key) => {
    accumulator += object[key];

    if (!mask.includes(key)) {
      if (accumulator >= value) {
        result = key;
      } else {
        lastValid = key;
      }
    } else if (accumulator >= value) {
      result = lastValid;
    }

    return result;
  });

  return result;
};

/**
 # Module Exports
 */

module.exports = {
  normalizeArray,
  normalizeObject,
  normalizeWeights,
  pickWeight,
};
