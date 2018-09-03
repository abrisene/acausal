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

const readTxt = async (loc, delimiter = '\n') => {
  try {
    const readFileAsync = promisify(fs.readFile);
    const txt = await readFileAsync(loc, 'utf8');
    return typeof delimiter === 'string' ? txt.split(delimiter) : txt;
  } catch (err) {
    console.error(err);
    return undefined;
  }
};

/*const writeTxt = async (loc) => {

};

const writeJSON = async (loc) => {

};*/

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
