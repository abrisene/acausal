/*
 # common.js
 # Common Utilities
 */

/**
 # Module Dependencies
 */

// const { promisify } = require('util');


/**
 # Methods
 */

const normalizeArray = (array, scale = 1) => {
  const sum = array.reduce((a, b) => a + b);
  return array.map(a => (a / sum) * scale);
};

const normalizeObject = (object, scale = 1) => {
  const sum = Object.keys(object).reduce((a, b) => a + object[b], 0);
  return Object.keys(object).reduce((a, b) => ({ ...a, [b]: (object[b] / sum) * scale }), {});
};

const normalizeWeights = (object, scale = 1) => {
  const sum = Object.keys(object).reduce((a, b) => a + object[b], 0);
  let accumulator = 0;
  return Object.keys(object).reduce((a, b) => {
    accumulator += (object[b] / sum) * scale;
    return { ...a, [b]: accumulator };
  }, {});
};

const pickWeight = (object = {}, value, mask = []) => {
  const keys = Object.keys(object);
  let result;
  let lastValid;
  let accumulator = 0;

  keys.some((key, index) => {
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
