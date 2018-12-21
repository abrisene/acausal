/*
 # common.js
 # Common Utilities
 */

/**
 # Module Dependencies
 */

/**
 # Methods
 */

/**
 * Dedupes an array
 * @param {array} array   Array to be deduped.
 */
const dedupeArray = array => array.reduce((a, b, index) => (a.includes(b, index) ? a : [...a, b]));


/**
 * Sets a value within an object using a defined path of keys.
 * @param {object} object           The object in which the value will be set.
 * @param {*} value                 The new value to set.
 * @param {array | string} keyPath  A string of keys (key1.key2) or an array
 *                                  indicating the path to the value.
 */
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
