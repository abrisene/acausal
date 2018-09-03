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

const dedupeArray = array => array.reduce((a, b) => {
  return a.includes(b) ? a : [...a, b];
});


const setDeep = (object, value, keyPath) => {
  const keys = typeof keyPath === 'string' ? keyPath.split('.') : keyPath;

  if (keys.length > 1) {
    const p = keys.shift();
    if (object[p] == null || typeof object[p] !== 'object') {
      object[p] = {};
    }
    setDeep(object[p], value, keys);
  } else {
    object[keys[0]] = value;
  }
};

/**
 # Module Exports
 */

module.exports = {
  dedupeArray,
  setDeep,
};
