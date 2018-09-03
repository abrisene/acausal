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
