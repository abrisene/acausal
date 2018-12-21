/*
 # loaders.js
 # Loader Utilities
 */

/**
 # Module Dependencies
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const { dedupeArray, setDeep } = require('./common');
const { forEachAsync } = require('./async');


/**
 # Methods
 */

/**
 * Async wrapper for readdir
 * @param {string} loc  A path.
 */
const readdir = async (loc) => {
  try {
    const readdirAsync = promisify(fs.readdir);
    const dir = await readdirAsync(loc);
    return dir;
  } catch (err) {
    console.error(err);
    return undefined;
  }
};

/**
 * Loads a text file from a defined path. Can split into an array and filter data.
 * @param {string} loc        A path to a .txt file.
 * @param {string} delimiter  An optional delimiter, defaults to '\n' to parse text into an array.
 * @param {function} filter   An optional filter
 */
const readTxt = async (loc, delimiter = '\n', filter) => {
  try {
    const readFileAsync = promisify(fs.readFile);
    const txt = await readFileAsync(loc, 'utf8');
    let result;

    if (typeof delimiter === 'string') {
      result = typeof delimiter === 'string' ? txt.split(delimiter) : txt;
      result = filter && typeof filter === 'function' ? result.filter(filter) : result;
    }

    return result || txt;
  } catch (err) {
    console.error(err);
    return undefined;
  }
};

/*
const writeTxt = async (loc) => {

};

const writeJSON = async (loc) => {

};
*/

/**
 * Loads a directory of text files and returns an object containing deduped data
 * with nested keys defined by filenames.
 *
 * ex.
 *   - names.male.txt
 *   - names.female.txt
 *   - words.adjectives.txt
 *   - words.nouns.txt
 *
 * Will result in:
 * {
 *  names: { male: [...], female: [...] },
 *  words: { adjectives: [...], nouns: [...] },
 * }
 * @param {string} loc  A path to a directory containing .txt files.
 */
const loadSeeds = async (loc) => {
  try {
    const files = await readdir(loc);
    const seeds = {};

    await forEachAsync(files, async (file) => {
      let txt = await readTxt(path.join(loc, file));
      txt = dedupeArray(txt);
      const categories = file.split('.').slice(0, -1);
      setDeep(seeds, txt, categories);
    });

    return seeds;
  } catch (err) {
    console.error(err);
    return undefined;
  }
};


/**
 # Module Exports
 */

module.exports = {
  forEachAsync,
  readdir,
  readTxt,
  // writeTxt,
  // writeJSON,
  loadSeeds,
};
