/*
 # async.js
 # Async Utilities
 */

/**
 # Module Dependencies
 */

// const { promisify } = require('util');


/**
 # Methods
 */

/**
 * Asynchronous forEach implementation.
 * @param {array} array   Array to iterate over.
 * @param {*} fn          Function to apply to each item in the array.
 */
const forEachAsync = async (array, fn) => {
  for (const entry of array) {
    await fn(entry);
  }
};


/**
 # Module Exports
 */

module.exports = {
  forEachAsync,
};
